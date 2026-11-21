// Neon Bay city generation: road grid, buildings, traffic, pedestrians, pickups.
// Pure functions over a seed so main.js and shots.js build the identical city.
import { CFG } from './config.js';
import { makeRng, range, rangeInt, pick, clamp } from './random.js';

export function roadCenters() {
  const xs = [], ys = [];
  for (let x = CFG.roadGap / 2; x < CFG.worldW; x += CFG.roadGap) xs.push(x);
  for (let y = CFG.roadGap / 2; y < CFG.worldH; y += CFG.roadGap) ys.push(y);
  return { xs, ys };
}
export function isOnRoad(x, y) {
  const { xs, ys } = roadCenters();
  const hw = CFG.roadW / 2;
  for (const cx of xs) if (Math.abs(x - cx) < hw) return true;
  for (const cy of ys) if (Math.abs(y - cy) < hw) return true;
  return false;
}
export function nearestRoadPoint(x, y) {
  const { xs, ys } = roadCenters();
  let bx = xs[0], bd = 1e18;
  for (const cx of xs) { const d = Math.abs(x - cx); if (d < bd) { bd = d; bx = cx; } }
  let by = ys[0]; bd = 1e18;
  for (const cy of ys) { const d = Math.abs(y - cy); if (d < bd) { bd = d; by = cy; } }
  return Math.abs(x - bx) < Math.abs(y - by) ? { x: bx, y } : { x, y: by };
}
export function collideCircleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
export function resolveCircleRect(ent, r, buildings) {
  for (const b of buildings) {
    if (!collideCircleRect(ent.x, ent.y, r, b)) continue;
    const nx = clamp(ent.x, b.x, b.x + b.w), ny = clamp(ent.y, b.y, b.y + b.h);
    let dx = ent.x - nx, dy = ent.y - ny;
    let d = Math.hypot(dx, dy);
    if (d < 0.001) { dx = 0; dy = -1; d = 1; }
    const push = (r - d) + 0.5;
    ent.x += (dx / d) * push; ent.y += (dy / d) * push;
  }
}

export function generateWorld(seed) {
  const rng = makeRng(seed);
  const { xs, ys } = roadCenters();
  const buildings = [];
  const neon = [CFG.palette.neonPink, CFG.palette.neonCyan, CFG.palette.neonYellow, CFG.palette.neonGreen, CFG.palette.neonPurple];
  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iy = 0; iy < ys.length - 1; iy++) {
      const bx0 = xs[ix] + CFG.roadW / 2 + 14, by0 = ys[iy] + CFG.roadW / 2 + 14;
      const bw = CFG.roadGap - CFG.roadW - 28, bh = CFG.roadGap - CFG.roadW - 28;
      // 1-3 buildings per block, or a small park
      if (rng() < 0.16) {
        buildings.push({ x: bx0, y: by0, w: bw, h: bh, park: true, color: CFG.palette.grass, neon: CFG.palette.neonGreen, hgt: 0, windows: [] });
        continue;
      }
      const n = rangeInt(rng, 1, 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 70, bw - (n > 1 ? 60 : 0));
        const h = range(rng, 60, bh - (n > 1 ? 50 : 0));
        const x = bx0 + (n === 1 ? (bw - w) / 2 : range(rng, 0, Math.max(1, bw - w)));
        const y = by0 + (n === 1 ? (bh - h) / 2 : range(rng, 0, Math.max(1, bh - h)));
        const windows = [];
        const cols = Math.max(2, Math.floor(w / 26)), rows = Math.max(2, Math.floor(h / 26));
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
          if (rng() < 0.55) windows.push({ dx: 8 + c * 26, dy: 8 + r * 26, lit: rng() < 0.7 });
        }
        buildings.push({ x, y, w, h, park: false, color: pick(rng, CFG.buildingColors), neon: pick(rng, neon), hgt: rangeInt(rng, 1, 4), windows });
      }
    }
  }
  const cars = [];
  for (let i = 0; i < CFG.trafficCount; i++) {
    const horizontal = rng() < 0.5;
    const road = horizontal ? pick(rng, ys) : pick(rng, xs);
    const along = range(rng, 120, (horizontal ? CFG.worldW : CFG.worldH) - 120);
    cars.push(makeTrafficCar(rng, horizontal, road, along, i));
  }
  const peds = [];
  for (let i = 0; i < CFG.pedCount; i++) {
    const x = range(rng, 80, CFG.worldW - 80), y = range(rng, 80, CFG.worldH - 80);
    peds.push({ x, y, angle: range(rng, 0, Math.PI * 2), speed: range(rng, 22, 48), color: pick(rng, CFG.carColors), t: range(rng, 0, 4), pause: 0 });
  }
  const pickups = [];
  for (let i = 0; i < 10; i++) {
    const p = nearestRoadPoint(range(rng, 200, CFG.worldW - 200), range(rng, 200, CFG.worldH - 200));
    pickups.push({ x: p.x + range(rng, -30, 30), y: p.y + range(rng, -30, 30), kind: i % 3 === 2 ? 'health' : 'cash', taken: false, bob: range(rng, 0, 6) });
  }
  return { seed, buildings, cars, peds, pickups, xs, ys };
}
export function makeTrafficCar(rng, horizontal, road, along, i) {
  const dir = rng() < 0.5 ? 1 : -1;
  const lane = 22;
  return {
    id: i, x: horizontal ? along : road + (dir > 0 ? lane : -lane),
    y: horizontal ? road + (dir > 0 ? lane : -lane) : along,
    angle: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
    speed: range(rng, 70, 130), baseSpeed: 110, color: pick(rng, CFG.carColors),
    horizontal, road, dir, wait: 0, w: 44, h: 22
  };
}
export function randomRoadSpot(rng, world) {
  const horizontal = rng() < 0.5;
  const road = horizontal ? pick(rng, world.ys) : pick(rng, world.xs);
  const along = range(rng, 200, (horizontal ? CFG.worldW : CFG.worldH) - 200);
  return horizontal ? { x: along, y: road } : { x: road, y: along };
}
export function updateTraffic(world, dt) {
  for (const c of world.cars) {
    // slow near intersections
    const { xs, ys } = world;
    let near = false;
    if (c.horizontal) { for (const cx of xs) if (Math.abs(c.x - cx) < 70) { near = true; break; } }
    else { for (const cy of ys) if (Math.abs(c.y - cy) < 70) { near = true; break; } }
    const target = near ? c.baseSpeed * 0.45 : c.baseSpeed;
    c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    const lim = c.horizontal ? CFG.worldW : CFG.worldH;
    const pos = c.horizontal ? c.x : c.y;
    if (pos < 60 || pos > lim - 60) { c.angle += Math.PI; c.dir *= -1; }
    c.x = clamp(c.x, 40, CFG.worldW - 40); c.y = clamp(c.y, 40, CFG.worldH - 40);
  }
}
export function updatePeds(world, dt, rng) {
  for (const p of world.peds) {
    if (p.pause > 0) { p.pause -= dt; continue; }
    p.t -= dt;
    if (p.t <= 0) { p.angle = range(rng, 0, Math.PI * 2); p.t = range(rng, 2, 6); if (rng() < 0.25) p.pause = range(rng, 0.5, 2); }
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (nx > 40 && nx < CFG.worldW - 40 && ny > 40 && ny < CFG.worldH - 40 && !isOnRoad(nx, ny)) { p.x = nx; p.y = ny; }
    else p.angle += Math.PI / 2;
  }
}
export function spawnParkedCar(rng, world, nearX, nearY) {
  for (let tries = 0; tries < 20; tries++) {
    const s = randomRoadSpot(rng, world);
    if (Math.hypot(s.x - nearX, s.y - nearY) < 260) continue;
    return { x: s.x, y: s.y, angle: rng() < 0.5 ? 0 : Math.PI / 2, speed: 0, color: pick(rng, CFG.carColors), parked: true, w: 44, h: 22 };
  }
  return { x: nearX + 120, y: nearY, angle: 0, speed: 0, color: CFG.carColors[0], parked: true, w: 44, h: 22 };
}
