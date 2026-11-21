// Neon Bay's rules and state, with no drawing and no browser in it: a seeded city of
// road-grid blocks and buildings, a player on foot or behind a wheel, traffic that drives
// the grid, pedestrians, police that answer a wanted level, cash pickups and delivery
// missions. step() advances one fixed step under a control object and returns what
// happened as bit flags. Every random choice comes from the seeded generator handed in,
// so a seed replays exactly.

import {
  CAR, CASH, CITY, MISSION, PED, PLAYER, POLICE, SCORE, TRAFFIC, WANTED, WORLD,
} from './config.js';
import { rngHelpers } from './random.js';

export const EVENT_COIN = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_DELIVERY = 8;
export const EVENT_CRIME = 16;
export const EVENT_ENTER_CAR = 32;

export const OVER_WASTED = 'wasted';
export const OVER_BUSTED = 'busted';

const TAU = Math.PI * 2;

export function angleWrap(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** The centre of the intersection at grid column c, row r. */
export function nodePos(c, r) {
  return { x: c * CITY.pitch + CITY.road / 2, y: r * CITY.pitch + CITY.road / 2 };
}

/** The grid node nearest a point, clamped into the city. */
export function nearestNode(x, y) {
  const c = Math.min(CITY.cols - 1, Math.max(0, Math.round((x - CITY.road / 2) / CITY.pitch)));
  const r = Math.min(CITY.rows - 1, Math.max(0, Math.round((y - CITY.road / 2) / CITY.pitch)));
  return { c, r };
}

/** Breadth-first path over the intersection grid; returns a list of {c, r} including both ends. */
export function findPath(from, to) {
  const key = (c, r) => r * CITY.cols + c;
  const prev = new Map([[key(from.c, from.r), null]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head];
    if (cur.c === to.c && cur.r === to.r) break;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dc, dr] of dirs) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (nc < 0 || nr < 0 || nc >= CITY.cols || nr >= CITY.rows) continue;
      const k = key(nc, nr);
      if (prev.has(k)) continue;
      prev.set(k, cur);
      queue.push({ c: nc, r: nr });
    }
  }
  const path = [];
  let cur = to;
  if (!prev.has(key(cur.c, cur.r))) return path;
  while (cur !== null && cur !== undefined) {
    path.push(cur);
    cur = prev.get(key(cur.c, cur.r));
  }
  path.reverse();
  return path;
}

export function createWorld(random) {
  const rng = rngHelpers(random);

  // ---- the city: one building, park or parking lot per block, decided by the seed ----
  const buildings = [];
  const parks = [];
  const lots = [];
  for (let r = 0; r < CITY.rows; r += 1) {
    for (let c = 0; c < CITY.cols; c += 1) {
      const bx = c * CITY.pitch + CITY.road;
      const by = r * CITY.pitch + CITY.road;
      const size = CITY.pitch - CITY.road;
      const roll = random();
      if (roll < 0.14) {
        parks.push({ x: bx, y: by, w: size, h: size });
      } else if (roll < 0.26) {
        lots.push({ x: bx, y: by, w: size, h: size });
      } else {
        const inset = rng.range(10, 26);
        buildings.push({
          x: bx + inset, y: by + inset, w: size - inset * 2, h: size - inset * 2,
          hue: rng.int(0, 5), floors: rng.int(2, 6),
        });
      }
    }
  }

  function hitsBuilding(x, y, radius) {
    for (const b of buildings) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
    }
    return null;
  }

  /** Push a circle at (x, y) out of every building; returns the push strength (0 when clear). */
  function pushOutOfBuildings(pos, radius) {
    let pushed = 0;
    for (const b of buildings) {
      const nx = Math.min(b.x + b.w, Math.max(b.x, pos.x));
      const ny = Math.min(b.y + b.h, Math.max(b.y, pos.y));
      const dx = pos.x - nx;
      const dy = pos.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.y = ny + (dy / d) * radius;
        pushed = Math.max(pushed, radius - d);
      } else {
        // Centre inside the building: leave by the nearest face.
        const left = pos.x - b.x;
        const right = b.x + b.w - pos.x;
        const top = pos.y - b.y;
        const bottom = b.y + b.h - pos.y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) pos.x = b.x - radius;
        else if (min === right) pos.x = b.x + b.w + radius;
        else if (min === top) pos.y = b.y - radius;
        else pos.y = b.y + b.h + radius;
        pushed = radius;
      }
    }
    return pushed;
  }

  function clampToWorld(pos, radius) {
    pos.x = Math.min(WORLD.width - radius, Math.max(radius, pos.x));
    pos.y = Math.min(WORLD.height - radius, Math.max(radius, pos.y));
  }

  /** A random point on a sidewalk: just inside a block edge, clear of buildings. */
  function sidewalkPoint() {
    for (let tries = 0; tries < 24; tries += 1) {
      const c = rng.int(0, CITY.cols - 1);
      const r = rng.int(0, CITY.rows - 1);
      const bx = c * CITY.pitch + CITY.road;
      const by = r * CITY.pitch + CITY.road;
      const size = CITY.pitch - CITY.road;
      const side = rng.int(0, 3);
      const along = rng.range(8, size - 8);
      const p = {
        x: side === 0 ? bx + along : side === 1 ? bx + along : side === 2 ? bx + 6 : bx + size - 6,
        y: side === 0 ? by + 6 : side === 1 ? by + size - 6 : by + along,
      };
      if (!hitsBuilding(p.x, p.y, 14)) return p;
    }
    const n = nodePos(1, 1);
    return { x: n.x + 60, y: n.y + 60 };
  }

  // ---- entities ----
  let carSerial = 0;
  function makeCar(x, y, angle, kind) {
    carSerial += 1;
    return {
      id: carSerial, x, y, angle, speed: 0, kind,
      color: rng.pick(['#d64545', '#3f7fd1', '#e8e8ec', '#39b56a', '#e8a13a', '#8d6fd1', '#2fb3a6', '#d16bb0']),
      health: 100, node: null, target: null, stuck: 0, ramCooldown: 0, contactCooldown: 0, flash: random() * TAU,
    };
  }

  const player = {
    x: 0, y: 0, angle: -Math.PI / 2, health: PLAYER.maxHealth, car: null, bust: 0, walkCycle: 0,
  };
  const cars = [];
  const peds = [];
  const pickups = [];
  const state = {
    player, cars, peds, pickups, buildings, parks, lots,
    cash: 0, score: 0, deliveries: 0, crimes: 0, time: 0, crime: 0, stars: 0,
    mission: null, missionTimer: 0, over: null, message: '', messageTime: 0,
    startedAt: 0,
  };

  function playerPos() {
    return player.car !== null ? player.car : player;
  }

  function commitCrime(points) {
    state.crime = Math.min(WANTED.perStar * WANTED.maxStars, state.crime + points);
    state.crimes += 1;
  }

  function damagePlayer(amount) {
    if (state.over !== null) return;
    player.health -= amount;
    if (player.health <= 0) {
      player.health = 0;
      state.over = OVER_WASTED;
    }
  }

  function spawnMission() {
    const p = playerPos();
    let best = null;
    let bestD = -1;
    for (let tries = 0; tries < 16; tries += 1) {
      const c = rng.int(0, CITY.cols - 1);
      const r = rng.int(0, CITY.rows - 1);
      const n = nodePos(c, r);
      const d = Math.sqrt(dist2(p.x, p.y, n.x, n.y));
      if (d > bestD) { bestD = d; best = n; }
      if (d >= MISSION.minDistance) { best = n; break; }
    }
    state.mission = best;
    state.missionTimer = MISSION.seconds;
  }

  function spawnPickup(at) {
    const p = at ?? sidewalkPoint();
    pickups.push({ x: p.x, y: p.y, spin: random() * TAU });
  }

  function spawnPed(at) {
    const p = at ?? sidewalkPoint();
    peds.push({
      x: p.x, y: p.y, angle: random() * TAU, shirt: rng.int(0, 5),
      target: sidewalkPoint(), state: 'walk', timer: rng.range(0, 2), down: 0, walkCycle: random() * TAU,
    });
  }

  function spawnTrafficCar() {
    const c = rng.int(0, CITY.cols - 1);
    const r = rng.int(0, CITY.rows - 1);
    const n = nodePos(c, r);
    const car = makeCar(n.x, n.y, 0, 'traffic');
    car.node = { c, r };
    car.target = pickNextNode(car.node, null);
    aimCarAtNode(car, car.target);
    cars.push(car);
  }

  function pickNextNode(node, avoid) {
    const options = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dc, dr] of dirs) {
      const nc = node.c + dc;
      const nr = node.r + dr;
      if (nc < 0 || nr < 0 || nc >= CITY.cols || nr >= CITY.rows) continue;
      if (avoid !== null && nc === avoid.c && nr === avoid.r && (node.c !== avoid.c || node.r !== avoid.r)) {
        // Prefer not to U-turn, but allow it when it is the only way.
        options.push({ c: nc, r: nr, uturn: true });
      } else {
        options.push({ c: nc, r: nr, uturn: false });
      }
    }
    const forward = options.filter((o) => !o.uturn);
    const pool = forward.length > 0 && random() < 0.85 ? forward : options;
    return pool[Math.floor(random() * pool.length) % pool.length];
  }

  /** Lane offset for right-hand traffic, given a heading unit vector. */
  function laneOffset(dx, dy) {
    return { x: -dy * 20, y: dx * 20 };
  }

  function aimCarAtNode(car, node) {
    const n = nodePos(node.c, node.r);
    const dx = Math.sign(n.x - car.x);
    const dy = Math.sign(n.y - car.y);
    const off = laneOffset(dx, dy);
    car.aimX = n.x + off.x;
    car.aimY = n.y + off.y;
  }

  function spawnPolice() {
    const p = playerPos();
    let bestNode = null;
    let bestD = Infinity;
    for (let r = 0; r < CITY.rows; r += 1) {
      for (let c = 0; c < CITY.cols; c += 1) {
        const n = nodePos(c, r);
        const d = Math.sqrt(dist2(p.x, p.y, n.x, n.y));
        if (d >= POLICE.spawnDistance * 0.6 && d < bestD) { bestD = d; bestNode = n; }
      }
    }
    const at = bestNode ?? nodePos(0, 0);
    const car = makeCar(at.x + rng.range(-20, 20), at.y + rng.range(-20, 20), 0, 'police');
    car.color = '#eef1f5';
    cars.push(car);
  }

  function reset() {
    cars.length = 0;
    peds.length = 0;
    pickups.length = 0;
    const spawn = nodePos(5, 4);
    player.x = spawn.x + 30;
    player.y = spawn.y + 52;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.maxHealth;
    player.car = null;
    player.bust = 0;
    // A parked car waits beside the spawn, ready for the first drive.
    const starter = makeCar(spawn.x - 6, spawn.y + 86, -Math.PI / 2, 'parked');
    cars.push(starter);
    for (const lot of lots) {
      for (let i = 0; i < TRAFFIC.parkedPerLot; i += 1) {
        const car = makeCar(
          lot.x + 30 + (i % 2) * 92 + rng.range(-6, 6),
          lot.y + 44 + Math.floor(i / 2) * 84 + rng.range(-6, 6),
          rng.chance(0.5) ? 0 : Math.PI, 'parked',
        );
        cars.push(car);
      }
    }
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (let i = 0; i < PED.count; i += 1) spawnPed();
    for (let i = 0; i < CASH.count; i += 1) spawnPickup();
    state.cash = 0;
    state.score = 0;
    state.deliveries = 0;
    state.crimes = 0;
    state.time = 0;
    state.crime = 0;
    state.stars = 0;
    state.over = null;
    state.message = '';
    state.messageTime = 0;
    spawnMission();
  }

  // ---- per-step updates ----

  function driveCar(car, dt, throttle, steer, topSpeed, accel) {
    const targetSpeed = throttle > 0 ? topSpeed : throttle < 0 ? -CAR.maxReverse : 0;
    const rate = throttle !== 0 ? accel : CAR.brake;
    if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + rate * dt);
    else car.speed = Math.max(targetSpeed, car.speed - rate * dt);
    if (throttle === 0) {
      // Rolling drag settles the car to a stop.
      car.speed -= car.speed * Math.min(1, 1.6 * dt);
      if (Math.abs(car.speed) < 2) car.speed = 0;
    }
    const steerAuthority = Math.min(1, Math.abs(car.speed) / 90);
    car.angle += steer * CAR.turnRate * steerAuthority * dt * (car.speed < 0 ? -1 : 1);
    const vx = Math.cos(car.angle) * car.speed;
    const vy = Math.sin(car.angle) * car.speed;
    car.x += vx * dt;
    car.y += vy * dt;
    clampToWorld(car, CAR.radius);
    const before = Math.abs(car.speed);
    const pushed = pushOutOfBuildings(car, CAR.radius);
    if (pushed > 0) {
      if (before > 150) {
        car.health -= (before - 150) / 12;
        if (car === player.car) {
          damagePlayer((before - 150) / 10);
        }
      }
      car.speed = -car.speed * 0.22;
    }
  }

  function stepPlayer(dt, control) {
    let events = 0;
    if (control.interact) {
      if (player.car !== null) {
        const car = player.car;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
        pushOutOfBuildings(player, PLAYER.radius);
        clampToWorld(player, PLAYER.radius);
        if (car.kind === 'traffic') car.kind = 'parked';
        if (car.speed === 0 && car.kind === 'police') car.kind = 'parked';
        player.car = null;
      } else {
        let nearest = null;
        let nearestD = PLAYER.enterRange * PLAYER.enterRange;
        for (const car of cars) {
          if (car.kind === 'police' && cars.some((c) => c === car && c.speed > 4)) continue;
          const d = dist2(player.x, player.y, car.x, car.y);
          if (d < nearestD) { nearestD = d; nearest = car; }
        }
        if (nearest !== null) {
          if (nearest.kind === 'traffic') {
            commitCrime(WANTED.crime.carjack);
            events |= EVENT_CRIME;
            state.message = 'CARJACKED!';
            state.messageTime = 2;
          } else if (nearest.kind === 'parked') {
            commitCrime(WANTED.crime.stealParked);
          }
          nearest.kind = 'player';
          player.car = nearest;
          events |= EVENT_ENTER_CAR;
        }
      }
    }

    if (player.car !== null) {
      const car = player.car;
      driveCar(car, dt, control.moveY, control.moveX, CAR.maxSpeed, CAR.accel);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      if (car.health <= 0) {
        car.health = 0;
        damagePlayer(14 * dt * 4);
        car.speed *= 0.98;
      }
    } else {
      const run = control.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const mag = Math.hypot(control.moveX, control.moveY);
      if (mag > 0.01) {
        const nx = control.moveX / Math.max(1, mag);
        const ny = control.moveY / Math.max(1, mag);
        player.x += nx * run * dt;
        player.y += ny * run * dt;
        player.angle = Math.atan2(ny, nx);
        player.walkCycle += dt * 10;
      }
      pushOutOfBuildings(player, PLAYER.radius);
      clampToWorld(player, PLAYER.radius);
    }
    return events;
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.kind !== 'traffic') continue;
      const n = nodePos(car.target.c, car.target.r);
      const dx = car.aimX - car.x;
      const dy = car.aimY - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 30) {
        const arrived = car.target;
        const previous = car.node;
        car.node = arrived;
        car.target = pickNextNode(arrived, previous);
        aimCarAtNode(car, car.target);
      }
      const desired = Math.atan2(dy, dx);
      const diff = angleWrap(desired - car.angle);
      const steer = Math.max(-1, Math.min(1, diff * 2.4));
      // Slow for anything solid ahead.
      let blocked = false;
      const aheadX = car.x + Math.cos(car.angle) * 58;
      const aheadY = car.y + Math.sin(car.angle) * 58;
      for (const other of cars) {
        if (other === car) continue;
        if (dist2(aheadX, aheadY, other.x, other.y) < 34 * 34) { blocked = true; break; }
      }
      if (!blocked && player.car === null && dist2(aheadX, aheadY, player.x, player.y) < 30 * 30) blocked = true;
      driveCar(car, dt, blocked ? 0 : 1, steer, TRAFFIC.speed, 200);
    }
  }

  function stepPolice(dt) {
    let events = 0;
    const wanted = state.stars;
    const police = cars.filter((c) => c.kind === 'police');
    if (wanted > 0 && police.length < wanted && random() < 0.03) spawnPolice();
    if (wanted === 0) {
      for (const car of police) car.kind = 'parked';
      return events;
    }
    const p = playerPos();
    for (const car of police) {
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      const d = Math.hypot(dx, dy);
      const desired = Math.atan2(dy, dx);
      const diff = angleWrap(desired - car.angle);
      const steer = Math.max(-1, Math.min(1, diff * 2.6));
      const top = POLICE.maxSpeed * (0.82 + state.stars * 0.05);
      const throttle = d > 46 ? 1 : 0.25;
      const speedBefore = Math.abs(car.speed);
      driveCar(car, dt, throttle, steer, top, POLICE.accel);
      // Ramming the player's car hurts; crowding a player on foot builds the bust meter.
      if (player.car !== null && d < CAR.radius * 2 + 4 && speedBefore > 120 && car.ramCooldown <= 0) {
        damagePlayer(POLICE.ramDamage);
        car.ramCooldown = POLICE.ramCooldown;
        events |= EVENT_HIT;
      }
      if (player.car === null && d < 52) {
        player.bust += dt / POLICE.bustSeconds;
        if (player.bust >= 1 && state.over === null) {
          state.over = OVER_BUSTED;
          events |= EVENT_OVER;
        }
      }
      if (car.ramCooldown > 0) car.ramCooldown -= dt;
    }
    if (player.car !== null || !police.some((c) => dist2(c.x, c.y, player.x, player.y) < 52 * 52)) {
      player.bust = Math.max(0, player.bust - dt * 0.7);
    }
    return events;
  }

  function stepPeds(dt) {
    let events = 0;
    const p = playerPos();
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          const at = sidewalkPoint();
          ped.x = at.x; ped.y = at.y; ped.target = sidewalkPoint(); ped.state = 'walk';
        }
        continue;
      }
      const threatD2 = dist2(ped.x, ped.y, p.x, p.y);
      const playerFast = player.car !== null && Math.abs(player.car.speed) > 130;
      if (playerFast && threatD2 < 110 * 110) ped.state = 'flee';
      else if (threatD2 > 150 * 150) ped.state = 'walk';
      let tx;
      let ty;
      let speed;
      if (ped.state === 'flee') {
        tx = ped.x + (ped.x - p.x);
        ty = ped.y + (ped.y - p.y);
        speed = PED.fleeSpeed;
      } else {
        if (Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 12) ped.target = sidewalkPoint();
        tx = ped.target.x;
        ty = ped.target.y;
        speed = PED.speed;
      }
      const dx = tx - ped.x;
      const dy = ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        ped.x += (dx / d) * speed * dt;
        ped.y += (dy / d) * speed * dt;
        ped.angle = Math.atan2(dy, dx);
        ped.walkCycle += dt * 8;
      }
      pushOutOfBuildings(ped, PED.radius);
      clampToWorld(ped, PED.radius);
      // A car strike knocks a pedestrian down and is a serious crime.
      for (const car of cars) {
        if (Math.abs(car.speed) > 60 && dist2(ped.x, ped.y, car.x, car.y) < (CAR.radius + PED.radius) ** 2) {
          ped.down = 6;
          if (car.kind === 'player') {
            commitCrime(WANTED.crime.hitPed);
            state.message = 'PEDESTRIAN DOWN!';
            state.messageTime = 2;
            events |= EVENT_CRIME;
          }
          break;
        }
      }
    }
    return events;
  }

  function stepCarContact(dt) {
    let events = 0;
    // Player car versus the rest of the world: bumps cost paint, and hitting police costs more.
    if (player.car !== null) {
      const mine = player.car;
      for (const other of cars) {
        if (other === mine) continue;
        const rr = CAR.radius * 2;
        if (dist2(mine.x, mine.y, other.x, other.y) >= rr * rr) continue;
        const closing = Math.abs(mine.speed) + Math.abs(other.speed);
        // Separate the pair.
        const dx = other.x - mine.x;
        const dy = other.y - mine.y;
        const d = Math.hypot(dx, dy) || 1;
        const overlap = (rr - d) / 2;
        other.x += (dx / d) * overlap;
        other.y += (dy / d) * overlap;
        mine.x -= (dx / d) * overlap;
        mine.y -= (dy / d) * overlap;
        if (closing > 90 && mine.contactCooldown <= 0) {
          mine.contactCooldown = 0.5;
          other.health -= closing / 22;
          mine.health -= closing / 30;
          if (other.kind === 'police') {
            commitCrime(WANTED.crime.hitPolice);
            damagePlayer(4);
            events |= EVENT_CRIME | EVENT_HIT;
          } else if (other.kind === 'traffic') {
            commitCrime(WANTED.crime.hitCar);
            events |= EVENT_CRIME;
          }
        }
        mine.speed *= 0.55;
        if (other.kind === 'traffic' || other.kind === 'police') other.speed *= 0.55;
      }
      if (mine.contactCooldown > 0) mine.contactCooldown -= dt;
    }
    return events;
  }

  function stepPickupsAndMission(dt) {
    let events = 0;
    const p = playerPos();
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pk = pickups[i];
      pk.spin += dt * 3;
      if (dist2(p.x, p.y, pk.x, pk.y) < CASH.radius * CASH.radius) {
        pickups.splice(i, 1);
        state.cash += CASH.value;
        state.score += SCORE.cashPickup;
        events |= EVENT_COIN;
        spawnPickup();
      }
    }
    if (state.mission !== null) {
      state.missionTimer -= dt;
      if (dist2(p.x, p.y, state.mission.x, state.mission.y) < MISSION.radius * MISSION.radius) {
        const bonus = Math.round(state.missionTimer) * 4;
        state.cash += MISSION.reward + bonus;
        state.score += SCORE.delivery + bonus;
        state.deliveries += 1;
        state.message = `DELIVERY! +$${MISSION.reward + bonus}`;
        state.messageTime = 2.6;
        events |= EVENT_DELIVERY;
        spawnMission();
      } else if (state.missionTimer <= 0) {
        state.message = 'DELIVERY MISSED';
        state.messageTime = 2;
        spawnMission();
      }
    }
    return events;
  }

  function stepWanted(dt) {
    const p = playerPos();
    let seen = false;
    for (const car of cars) {
      if (car.kind === 'police' && dist2(car.x, car.y, p.x, p.y) < WANTED.sightRange * WANTED.sightRange) {
        seen = true;
        break;
      }
    }
    state.crime = Math.max(0, state.crime - (seen ? WANTED.decaySeen : WANTED.decayHidden) * dt);
    state.stars = Math.min(WANTED.maxStars, Math.floor(state.crime / WANTED.perStar));
    if (state.stars === 0 && state.crime < 4) player.bust = 0;
    // Slow recovery only while nobody is looking for you.
    if (state.stars === 0 && player.health > 0 && player.health < PLAYER.maxHealth) {
      player.health = Math.min(PLAYER.maxHealth, player.health + PLAYER.regenPerSecond * dt);
    }
  }

  /**
   * One fixed step. `control` is { moveX, moveY, run, interact }: on foot, moveX/moveY are a
   * direction; in a car, moveY is the throttle (-1..1) and moveX the steering (-1..1).
   * Returns EVENT_* flags. Once the run is over the world freezes.
   */
  function step(dt, control) {
    if (state.over !== null) return EVENT_OVER;
    let events = 0;
    state.time += dt;
    state.score += SCORE.secondSurvived * dt;
    if (state.messageTime > 0) state.messageTime -= dt;
    events |= stepPlayer(dt, control);
    stepTraffic(dt);
    events |= stepPolice(dt);
    events |= stepPeds(dt);
    events |= stepCarContact(dt);
    events |= stepPickupsAndMission(dt);
    stepWanted(dt);
    if (state.over !== null) events |= EVENT_OVER;
    return events;
  }

  reset();
  return { state, reset, step, commitCrime, damagePlayer, playerPos };
}
