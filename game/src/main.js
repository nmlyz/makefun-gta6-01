// Neon Bay — main game: loop, state machine, driving, wanted, police, missions.
import { CFG, MISSION_DEFS } from './config.js';
import { makeRng, range, pick, clamp, angleDiff, angleTo } from './random.js';
import { generateWorld, updateTraffic, updatePeds, resolveCircleRect, randomRoadSpot, spawnParkedCar } from './world.js';
import { createInput } from './input.js';
import * as R from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput();
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;

export function createGame(seedValue) {
  const rng = makeRng(seedValue);
  const world = generateWorld(seedValue);
  const start = randomRoadSpot(rng, world);
  const g = {
    seed: seedValue, rng, world, state: 'title', time: 0, timeLeft: CFG.missionTimeLimit,
    money: 0, score: 0, health: CFG.playerHealth, wanted: 0, heat: 0, heatTimer: 0,
    player: { x: start.x, y: start.y, angle: -Math.PI / 2, speed: 0 },
    car: null, cars: [], police: [], particles: [], parked: [],
    cam: { x: start.x, y: start.y },
    mission: null, missionIndex: 0, missionLabel: 'NO MISSION — press ENTER',
    objective: 'Press ENTER to take a mission from Mara Sol.',
    muted: false, flash: 0, message: '', messageT: 0, bustedKind: 'busted',
    saveKey: 'neon-bay-save-v1'
  };
  for (let i = 0; i < 5; i++) g.parked.push(spawnParkedCar(rng, world, start.x, start.y));
  g.cars = world.cars;
  return g;
}
export function startMission(g) {
  const type = CFG.missionTypes[g.missionIndex % CFG.missionTypes.length];
  g.missionIndex++;
  const def = MISSION_DEFS[type];
  const rng = g.rng;
  const target = randomRoadSpot(rng, g.world);
  const pickup = randomRoadSpot(rng, g.world);
  g.mission = { type, def, target, pickup, stage: type === 'taxi' ? 'pickup' : 'collect', collected: 0, need: type === 'courier' ? 3 : 1, packages: [] };
  if (type === 'courier') {
    for (let i = 0; i < 3; i++) { const s = randomRoadSpot(rng, g.world); g.mission.packages.push({ x: s.x, y: s.y, got: false }); }
  }
  if (type === 'getaway') { g.wanted = Math.max(g.wanted, 3); g.heat = 100; }
  g.timeLeft = CFG.missionTimeLimit;
  g.missionLabel = def.name;
  g.objective = def.desc;
  g.message = def.name + ' — ' + def.desc; g.messageT = 4;
}
export function completeMission(g) {
  const pay = g.mission.def.pay + (g.wanted > 0 ? 25 * g.wanted : 0);
  g.money += pay; g.score += pay * 2 + 100;
  g.message = 'MISSION COMPLETE! +$' + pay; g.messageT = 4;
  g.mission = null; g.missionLabel = 'NO MISSION — press ENTER';
  g.objective = 'Mission complete! Press ENTER for the next job from Mara Sol.';
  g.wanted = Math.max(0, g.wanted - 1);
  saveGame(g);
}
export function saveGame(g) {
  try { localStorage.setItem(g.saveKey, JSON.stringify({ money: g.money, score: g.score, missions: g.missionIndex })); } catch (e) { /* storage unavailable */ }
}
export function loadSave(g) {
  try {
    const s = JSON.parse(localStorage.getItem(g.saveKey) || 'null');
    if (s) { g.money = s.money || 0; g.score = s.score || 0; g.missionIndex = s.missions || 0; }
  } catch (e) { /* ignore */ }
}
export function nearestCar(g, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of g.parked) {
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export function spawnPolice(g) {
  const need = Math.min(CFG.policeMax, g.wanted + 1);
  while (g.police.length < need) {
    const a = g.rng() * Math.PI * 2;
    const d = 500 + g.rng() * 200;
    g.police.push({ x: clamp(g.player.x + Math.cos(a) * d, 60, CFG.worldW - 60), y: clamp(g.player.y + Math.sin(a) * d, 60, CFG.worldH - 60), angle: 0, speed: 0, color: '#1e3a8a', w: 44, h: 22 });
  }
}
export function updatePlayer(g, dt) {
  const p = g.player, inp = input;
  if (g.car) {
    const car = g.car;
    const accel = inp.up ? CFG.carAccel : inp.down ? -CFG.carAccel * 0.6 : 0;
    car.speed += accel * dt;
    if (!inp.up && !inp.down) car.speed *= Math.max(0, 1 - dt * 1.2);
    if (inp.action) car.speed *= Math.max(0, 1 - dt * 4);
    car.speed = clamp(car.speed, -CFG.carReverse, CFG.carMaxSpeed);
    const steer = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * CFG.carTurn * dt * dir * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 30, CFG.worldW - 30); car.y = clamp(car.y, 30, CFG.worldH - 30);
    resolveCircleRect(car, 20, g.world.buildings);
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    if (Math.abs(car.speed) > 260 && (inp.left || inp.right)) {
      g.particles.push({ x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20, life: 0.4, max: 0.4, size: 4, color: '#8a93b8' });
    }
    if (Math.abs(car.speed) > 380) { g.heat += dt * 2; }
  } else {
    let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my); mx /= len; my /= len;
      p.angle = Math.atan2(my, mx);
      p.x += mx * CFG.playerSpeed * dt; p.y += my * CFG.playerSpeed * dt;
      p.x = clamp(p.x, 20, CFG.worldW - 20); p.y = clamp(p.y, 20, CFG.worldH - 20);
      resolveCircleRect(p, CFG.playerRadius, g.world.buildings);
      p.speed = CFG.playerSpeed;
    } else p.speed = 0;
  }
  // camera follows
  g.cam.x += (p.x - g.cam.x) * Math.min(1, dt * 5);
  g.cam.y += (p.y - g.cam.y) * Math.min(1, dt * 5);
  g.cam.x = clamp(g.cam.x, CFG.viewW / 2 - 200, CFG.worldW - CFG.viewW / 2 + 200);
  g.cam.y = clamp(g.cam.y, CFG.viewH / 2 - 200, CFG.worldH - CFG.viewH / 2 + 200);
}
export function updateWanted(g, dt) {
  if (g.wanted > 0) {
    g.heatTimer += dt;
    spawnPolice(g);
    if (g.heatTimer > 6 && g.heat <= 0) { g.wanted = Math.max(0, g.wanted - 1); g.heatTimer = 0; }
    if (g.heat > 0) g.heat = Math.max(0, g.heat - dt * 3);
  } else g.police.length = 0;
  // police chase
  for (const cop of g.police) {
    const target = angleTo(cop.x, cop.y, g.player.x, g.player.y);
    cop.angle += clamp(angleDiff(cop.angle, target), -2.4 * dt, 2.4 * dt);
    const sp = 300 + g.wanted * 22;
    cop.speed += (sp - cop.speed) * Math.min(1, dt * 1.2);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    resolveCircleRect(cop, 20, g.world.buildings);
    const d = Math.hypot(cop.x - g.player.x, cop.y - g.player.y);
    if (d < 34) {
      if (g.car) { g.car.speed *= 0.6; g.health -= 14 * dt * 10; }
      else g.health -= 25 * dt * 10;
      g.heat = 60;
      if (g.health <= 0) { g.health = 0; endGame(g, g.car ? 'busted' : 'wasted'); }
    }
  }
}
export function updateMission(g, dt) {
  if (!g.mission) return;
  g.timeLeft -= dt;
  if (g.timeLeft <= 0) { g.mission = null; g.missionLabel = 'MISSION FAILED — press ENTER'; g.objective = 'Out of time. Press ENTER to try another job.'; g.wanted = Math.min(5, g.wanted + 1); return; }
  const m = g.mission, p = g.player;
  const dest = m.stage === 'pickup' ? m.pickup : m.target;
  if (m.type === 'courier') {
    for (const pkg of m.packages) {
      if (!pkg.got && Math.hypot(p.x - pkg.x, p.y - pkg.y) < 46) {
        pkg.got = true; m.collected++; g.money += 20; g.score += 20;
        g.particles.push({ x: pkg.x, y: pkg.y, life: 0.6, max: 0.6, size: 8, color: CFG.palette.neonGreen });
        if (m.collected >= m.need) m.stage = 'deliver';
      }
    }
    if (m.stage === 'deliver' && Math.hypot(p.x - m.target.x, p.y - m.target.y) < 52) completeMission(g);
    return;
  }
  if (Math.hypot(p.x - dest.x, p.y - dest.y) < 52) {
    if (m.type === 'taxi' && m.stage === 'pickup') { m.stage = 'deliver'; g.objective = 'Passenger aboard! Drive them to the pink marker.'; g.message = 'Passenger aboard — drive!'; g.messageT = 3; }
    else completeMission(g);
  }
}
export function updatePickups(g) {
  for (const pk of g.world.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(g.player.x - pk.x, g.player.y - pk.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'cash') { g.money += CFG.cashPickupValue; g.score += 50; }
      else g.health = Math.min(100, g.health + CFG.healthPickupValue);
      g.particles.push({ x: pk.x, y: pk.y, life: 0.5, max: 0.5, size: 7, color: CFG.palette.neonYellow });
    }
  }
}
export function endGame(g, kind) {
  g.state = kind; g.bustedKind = kind; saveGame(g);
}
export function stepGame(g, dt) {
  g.time += dt; g.flash = (g.time * 6) % 1;
  if (g.messageT > 0) g.messageT -= dt;
  updateTraffic(g.world, dt);
  updatePeds(g.world, dt, g.rng);
  updatePlayer(g, dt);
  updateWanted(g, dt);
  updateMission(g, dt);
  updatePickups(g);
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i]; p.life -= dt; if (p.life <= 0) g.particles.splice(i, 1);
  }
  if (g.health < 100 && !g.car) g.health = Math.min(100, g.health + dt * 1.5);
}
export function renderGame(g) {
  R.drawWorld(ctx, g.world, g.cam, g.time);
  // world-space sprites (parked cars, player car, police) need the camera offset
  const x0 = g.cam.x - CFG.viewW / 2, y0 = g.cam.y - CFG.viewH / 2;
  ctx.save(); ctx.translate(-x0, -y0);
  // parked cars
  for (const c of g.parked) R.drawCar(ctx, c.x, c.y, c.angle, c.color, false, 0);
  // courier packages
  if (g.mission && g.mission.type === 'courier') {
    for (const pkg of g.mission.packages) {
      if (pkg.got) continue;
      const sx = pkg.x - (g.cam.x - CFG.viewW / 2), sy = pkg.y - (g.cam.y - CFG.viewH / 2);
      ctx.save(); ctx.fillStyle = CFG.palette.neonYellow; ctx.shadowColor = CFG.palette.neonYellow; ctx.shadowBlur = 10;
      R.roundRect(ctx, sx - 9, sy - 9, 18, 18, 3); ctx.fill(); ctx.restore();
    }
  }
  if (g.car) R.drawCar(ctx, g.car.x, g.car.y, g.car.angle, g.car.color, false, 0);
  for (const cop of g.police) R.drawCar(ctx, cop.x, cop.y, cop.angle, '#1e3a8a', true, g.flash);
  ctx.restore();
  if (!g.car) R.drawPlayer(ctx, g.cam, g.player);
  const marker = g.mission ? (g.mission.stage === 'pickup' ? g.mission.pickup : g.mission.target) : null;
  if (marker) R.drawMissionMarker(ctx, g.cam, marker, g.time);
  R.drawParticles(ctx, g.cam, g.particles);
  R.drawHud(ctx, { money: g.money, score: g.score, health: g.health, wanted: g.wanted, missionLabel: g.missionLabel, objective: g.objective, inCar: !!g.car, speed: g.car ? g.car.speed : 0, timeLeft: g.mission ? g.timeLeft : CFG.missionTimeLimit });
  R.drawMinimap(ctx, g.world, g.player, g.police, marker);
  if (g.messageT > 0 && g.message) {
    ctx.save(); ctx.fillStyle = 'rgba(8,10,24,0.85)'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(g.message).width + 36;
    R.roundRect(ctx, (CFG.viewW - w) / 2, 120, w, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffd23e'; ctx.fillText(g.message, CFG.viewW / 2, 142); ctx.restore();
  }
  if (g.state === 'title') R.drawTitle(ctx, g.time);
  if (g.state === 'pause') R.drawPaused(ctx);
  if (g.state === 'busted' || g.state === 'wasted') R.drawEndScreen(ctx, g.state, g.money, g.score);
}

const game = createGame(seed);
loadSave(game);
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function frame(now) {
  // In shot mode (?shot=...) shots.js draws one deterministic frame; do not run the live loop.
if (!params.get('shot')) requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (document.hidden) return;
  if (input.consume('pause') && (game.state === 'play' || game.state === 'pause')) {
    game.state = game.state === 'play' ? 'pause' : 'play';
  }
  if (input.consume('mute')) game.muted = !game.muted;
  if (input.consume('restart') || (input.consume('confirm') && (game.state === 'busted' || game.state === 'wasted'))) {
    const fresh = createGame(seed); Object.assign(game, fresh); game.state = 'play'; loadSave(game);
  }
  if (input.consume('confirm') && game.state === 'title') { game.state = 'play'; startMission(game); }
  else if (input.consume('confirm') && game.state === 'play' && !game.mission) startMission(game);
  if (input.consume('enterCar') && game.state === 'play') {
    if (game.car) { const c = game.car; game.car = null; game.player.x = c.x + 40; game.player.y = c.y; }
    else {
      const near = nearestCar(game, game.player.x, game.player.y, 70);
      if (near) { game.car = near; game.parked = game.parked.filter(c => c !== near); game.wanted = Math.min(5, game.wanted + 1); game.heat = 80; game.message = 'CAR STOLEN! The cops are coming.'; game.messageT = 3; }
    }
  }
  if (game.state === 'play') {
    acc += dt;
    while (acc >= STEP) { stepGame(game, STEP); acc -= STEP; }
  } else if (game.state === 'title') {
    game.time += dt; updateTraffic(game.world, dt); updatePeds(game.world, dt, game.rng);
  } else game.time += dt;
  renderGame(game);
}
// In shot mode (?shot=...) shots.js draws one deterministic frame; do not run the live loop.
if (!params.get('shot')) requestAnimationFrame(frame);
