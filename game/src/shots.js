// Deterministic screenshot scenes for Neon Bay.
// ?shot=start|play|end|chase&seed=N — build the world, simulate fixed steps
// with a simple autopilot, draw exactly one frame, then stop.
import { CFG } from './config.js';
import { createGame, startMission, stepGame, renderGame } from './main.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  const g = createGame(seed);
  g.state = 'play';
  // Stage the player already driving: steal the nearest parked car, point it
  // at the mission marker, then steer toward it for the given steps.
  function stageDriving() {
    const car = g.parked[0];
    g.car = car; g.parked = g.parked.filter(c => c !== car);
    const m = g.mission;
    const dest = m ? (m.stage === 'pickup' ? m.pickup : m.target) : { x: 1800, y: 1400 };
    car.angle = Math.atan2(dest.y - car.y, dest.x - car.x);
    // pull the mission marker close so it is visible in the 1280x720 frame
    const dx = dest.x - car.x, dy = dest.y - car.y, len = Math.hypot(dx, dy) || 1;
    const near = { x: car.x + (dx / len) * 330, y: car.y + (dy / len) * 330 };
    if (m) { m.target = near; if (m.stage === 'pickup') m.pickup = near; }
    car.speed = 240;
    g.player.x = car.x; g.player.y = car.y; g.player.angle = car.angle;
    g.cam.x = car.x; g.cam.y = car.y;
  }
  function autopilot(steps) {
    stageDriving();
    for (let i = 0; i < steps; i++) {
      const m = g.mission;
      const dest = m ? (m.stage === 'pickup' ? m.pickup : m.target) : { x: 1800, y: 1400 };
      const car = g.car;
      const want = Math.atan2(dest.y - car.y, dest.x - car.x);
      let d = want - car.angle;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      car.angle += Math.max(-0.05, Math.min(0.05, d));
      car.speed = 260;
      stepGame(g, 1 / 60);
      // stepGame's driving physics needs input; re-apply speed after it
      car.speed = 260;
      g.player.x = car.x; g.player.y = car.y; g.player.angle = car.angle;
      g.cam.x = car.x; g.cam.y = car.y;
    }
  }
  if (shot === 'start') {
    g.state = 'title'; g.time = 2.4;
    for (let i = 0; i < 120; i++) stepGame(g, 1 / 60);
    g.state = 'title';
  } else if (shot === 'play') {
    startMission(g);
    autopilot(60);
    g.money = 1250; g.score = 3400;
  } else if (shot === 'end') {
    startMission(g);
    autopilot(40);
    g.wanted = 4; g.health = 0; g.state = 'busted'; g.bustedKind = 'busted'; g.money = 1840; g.score = 5200;
  } else if (shot === 'chase') {
    startMission(g);
    // force a getaway-style chase: wanted 3, two police right behind
    g.mission = { type: 'getaway', def: { name: 'GETAWAY', desc: 'Reach the pink marker with the cops on your tail.', pay: 250 }, target: g.mission.target, pickup: g.mission.pickup, stage: 'deliver', collected: 0, need: 1, packages: [] };
    g.missionLabel = 'GETAWAY'; g.objective = 'GETAWAY — reach the pink marker! Cops on your tail!';
    g.wanted = 3; g.heat = 100; g.money = 980; g.score = 2100; g.messageT = 0;
    autopilot(50);
    g.police = [
      { x: g.player.x - 90, y: g.player.y + 46, angle: g.player.angle, speed: 320, color: '#1e3a8a', w: 44, h: 22 },
      { x: g.player.x - 130, y: g.player.y - 40, angle: g.player.angle, speed: 310, color: '#1e3a8a', w: 44, h: 22 }
    ];
  }
  renderGame(g);
  document.title = 'Neon Bay — ' + shot;
}
