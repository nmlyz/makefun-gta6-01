// The autopilot: a driver good enough to play Neon Bay on its own. It walks to the
// nearest parked car, gets in, then follows a breadth-first route over the intersection
// grid toward the current delivery checkpoint (or the nearest cash), slowing for corners.
// The title screen's attract mode, the idle takeover in play and the screenshot scenes all
// steer with this, so what they show is the real game being played, not a script.

import { CITY, MISSION } from './config.js';
import { angleWrap, dist2, findPath, nearestNode, nodePos } from './world.js';

export function createPilot() {
  let path = [];
  let pathIndex = 0;
  let retarget = 0;
  let interactArmed = true;

  function driveControl(state, tx, ty) {
    const car = state.player.car;
    const dx = tx - car.x;
    const dy = ty - car.y;
    const d = Math.hypot(dx, dy);
    const desired = Math.atan2(dy, dx);
    const diff = angleWrap(desired - car.angle);
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    let throttle = 1;
    if (Math.abs(diff) > 2.4) throttle = -0.7; // Facing away: back up and turn, like a driver would.
    else if (Math.abs(diff) > 1.1) throttle = 0.35;
    else if (d < 90) throttle = 0.55;
    if (Math.abs(car.speed) > 300 && Math.abs(diff) > 0.5) throttle = 0;
    return { moveX: steer, moveY: throttle, run: false, interact: false };
  }

  /** Control for one step. `reckless` skips corner care and aims at buildings when told to. */
  function control(state) {
    const player = state.player;
    const idle = { moveX: 0, moveY: 0, run: false, interact: false };
    if (state.over !== null) return idle;

    if (player.car === null) {
      // On foot: head for the nearest usable car and get in.
      let nearest = null;
      let nearestD = Infinity;
      for (const car of state.cars) {
        if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
        const d = dist2(player.x, player.y, car.x, car.y);
        if (d < nearestD) { nearestD = d; nearest = car; }
      }
      if (nearest === null) return idle;
      const d = Math.sqrt(nearestD);
      if (d < 30) {
        if (interactArmed) {
          interactArmed = false;
          return { moveX: 0, moveY: 0, run: false, interact: true };
        }
        return idle;
      }
      interactArmed = true;
      const dx = nearest.x - player.x;
      const dy = nearest.y - player.y;
      const mag = Math.max(1, Math.hypot(dx, dy));
      return { moveX: dx / mag, moveY: dy / mag, run: d > 120, interact: false };
    }

    interactArmed = true;
    const car = player.car;

    // Choose a goal: the delivery checkpoint, else the nearest cash bundle.
    let goal = state.mission;
    if (goal === null) {
      let best = null;
      let bestD = Infinity;
      for (const pk of state.pickups) {
        const d = dist2(car.x, car.y, pk.x, pk.y);
        if (d < bestD) { bestD = d; best = pk; }
      }
      goal = best;
    }
    if (goal === null) return idle;

    retarget -= 1;
    const goalNode = nearestNode(goal.x, goal.y);
    if (path.length === 0 || retarget <= 0) {
      path = findPath(nearestNode(car.x, car.y), goalNode);
      pathIndex = 0;
      retarget = 90;
    }
    // Advance along the route as intersections are reached.
    while (pathIndex < path.length) {
      const n = nodePos(path[pathIndex].c, path[pathIndex].r);
      if (Math.hypot(n.x - car.x, n.y - car.y) < 56) pathIndex += 1;
      else break;
    }
    if (pathIndex >= path.length) {
      // Off the grid now: drive straight at the goal itself.
      if (Math.hypot(goal.x - car.x, goal.y - car.y) < MISSION.radius * 0.7) {
        path = [];
        return { moveX: 0, moveY: 0, run: false, interact: false };
      }
      return driveControl(state, goal.x, goal.y);
    }
    const next = nodePos(path[pathIndex].c, path[pathIndex].r);
    return driveControl(state, next.x, next.y);
  }

  function reset() {
    path = [];
    pathIndex = 0;
    retarget = 0;
    interactArmed = true;
  }

  return { control, reset };
}

/**
 * A driver with no care at all: full throttle at the nearest building, and when a crash
 * leaves the car wedged nose-first against the wall, it backs off for another run-up.
 * The repeated impacts wreck the car and the driver. Used by the end scene.
 */
export function createKamikaze() {
  let backing = 0;
  let stillTime = 0;
  return function kamikazeControl(state) {
    const player = state.player;
    const idle = { moveX: 0, moveY: 0, run: false, interact: false };
    if (state.over !== null) return idle;
    if (player.car === null) {
      backing = 0;
      stillTime = 0;
      let nearest = null;
      let nearestD = Infinity;
      for (const car of state.cars) {
        if (car.kind !== 'parked') continue;
        const d = dist2(player.x, player.y, car.x, car.y);
        if (d < nearestD) { nearestD = d; nearest = car; }
      }
      if (nearest === null) return idle;
      if (Math.sqrt(nearestD) < 30) return { moveX: 0, moveY: 0, run: false, interact: true };
      const dx = nearest.x - player.x;
      const dy = nearest.y - player.y;
      const mag = Math.max(1, Math.hypot(dx, dy));
      return { moveX: dx / mag, moveY: dy / mag, run: true, interact: false };
    }
    let target = null;
    let bestD = Infinity;
    for (const b of state.buildings) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const d = dist2(player.car.x, player.car.y, cx, cy);
      if (d < bestD) { bestD = d; target = { x: cx, y: cy }; }
    }
    if (target === null) return idle;
    const desired = Math.atan2(target.y - player.car.y, target.x - player.car.x);
    const diff = angleWrap(desired - player.car.angle);
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    if (backing > 0) {
      backing -= 1;
      return { moveX: -steer, moveY: -1, run: false, interact: false };
    }
    if (Math.abs(player.car.speed) < 24) {
      stillTime += 1;
      if (stillTime > 45) {
        backing = 55;
        stillTime = 0;
        return { moveX: -steer, moveY: -1, run: false, interact: false };
      }
    } else stillTime = 0;
    return { moveX: steer, moveY: 1, run: false, interact: false };
  };
}
