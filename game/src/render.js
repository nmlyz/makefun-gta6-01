// Canvas drawing for Neon Bay: neon night city, cars, police, HUD, minimap, screens.
import { CFG } from './config.js';

export function drawCar(ctx, x, y, angle, color, police, flash) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(-24, -10, 48, 24);
  // headlights
  ctx.fillStyle = '#fff8c0';
  ctx.beginPath(); ctx.arc(22, -8, 3, 0, Math.PI * 2); ctx.arc(22, 8, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -22, -11, 44, 22, 6); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  roundRect(ctx, -4, -9, 12, 18, 3); ctx.fill();
  ctx.fillStyle = 'rgba(10,10,20,0.9)';
  roundRect(ctx, -16, -9, 8, 18, 2); ctx.fill();
  if (police) {
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    const on = flash > 0.5;
    ctx.fillStyle = on ? '#ff2e4e' : '#2e7dff';
    ctx.beginPath(); ctx.arc(-10, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = on ? '#2e7dff' : '#ff2e4e';
    ctx.beginPath(); ctx.arc(10, 0, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function drawWorld(ctx, world, cam, time) {
  const P = CFG.palette;
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  const x0 = cam.x - CFG.viewW / 2, y0 = cam.y - CFG.viewH / 2;
  ctx.save(); ctx.translate(-x0, -y0);
  // ground
  ctx.fillStyle = '#10142a'; ctx.fillRect(0, 0, CFG.worldW, CFG.worldH);
  // blocks / sidewalks
  ctx.fillStyle = P.sidewalk;
  for (let ix = 0; ix < world.xs.length - 1; ix++) for (let iy = 0; iy < world.ys.length - 1; iy++) {
    ctx.fillRect(world.xs[ix] + CFG.roadW / 2, world.ys[iy] + CFG.roadW / 2, CFG.roadGap - CFG.roadW, CFG.roadGap - CFG.roadW);
  }
  // roads
  ctx.fillStyle = P.asphalt;
  for (const cx of world.xs) ctx.fillRect(cx - CFG.roadW / 2, 0, CFG.roadW, CFG.worldH);
  for (const cy of world.ys) ctx.fillRect(0, cy - CFG.roadW / 2, CFG.worldW, CFG.roadW);
  // centre dashes
  ctx.strokeStyle = P.roadLine; ctx.lineWidth = 3; ctx.setLineDash([22, 26]);
  ctx.beginPath();
  for (const cx of world.xs) { ctx.moveTo(cx, 0); ctx.lineTo(cx, CFG.worldH); }
  for (const cy of world.ys) { ctx.moveTo(0, cy); ctx.lineTo(CFG.worldW, cy); }
  ctx.stroke(); ctx.setLineDash([]);
  // buildings
  for (const b of world.buildings) {
    if (b.x > x0 + CFG.viewW + 60 || b.x + b.w < x0 - 60 || b.y > y0 + CFG.viewH + 60 || b.y + b.h < y0 - 60) continue;
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.park) {
      ctx.fillStyle = '#1d5c33';
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) / 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.neon; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('PARK', b.x + b.w / 2, b.y + b.h / 2 + 5);
    } else {
      ctx.strokeStyle = b.neon; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2); ctx.globalAlpha = 1;
      for (const w of b.windows) {
        ctx.fillStyle = w.lit ? '#ffd98a' : '#0c1226';
        ctx.fillRect(b.x + w.dx, b.y + w.dy, 12, 12);
      }
    }
  }
  // pickups
  for (const p of world.pickups) {
    if (p.taken) continue;
    const bob = Math.sin(time * 3 + p.bob) * 3;
    ctx.save(); ctx.translate(p.x, p.y + bob);
    if (p.kind === 'cash') {
      ctx.fillStyle = CFG.palette.neonGreen; ctx.shadowColor = CFG.palette.neonGreen; ctx.shadowBlur = 12;
      roundRect(ctx, -11, -7, 22, 14, 3); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#062b16'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', 0, 4);
    } else {
      ctx.fillStyle = '#ff3b5c'; ctx.shadowColor = '#ff3b5c'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', 0, 5);
    }
    ctx.restore();
  }
  // pedestrians
  for (const p of world.peds) {
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(p.x, p.y - 2, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // traffic
  for (const c of world.cars) drawCar(ctx, c.x, c.y, c.angle, c.color, false, 0);
  ctx.restore();
}
export function drawMissionMarker(ctx, cam, marker, time) {
  if (!marker) return;
  const x0 = cam.x - CFG.viewW / 2, y0 = cam.y - CFG.viewH / 2;
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  const sx = marker.x - x0, sy = marker.y - y0;
  ctx.save();
  ctx.strokeStyle = CFG.palette.neonPink; ctx.lineWidth = 4; ctx.shadowColor = CFG.palette.neonPink; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(sx, sy, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = CFG.palette.neonPink; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('▼', sx, sy - 34);
  ctx.restore();
  // off-screen arrow at edge
  if (sx < 20 || sx > CFG.viewW - 20 || sy < 20 || sy > CFG.viewH - 20) {
    const cx = Math.max(40, Math.min(CFG.viewW - 40, sx)), cy = Math.max(70, Math.min(CFG.viewH - 40, sy));
    ctx.save(); ctx.fillStyle = CFG.palette.neonPink; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('◆ ' + Math.round(Math.hypot(marker.x - cam.x, marker.y - cam.y)) + 'm', cx, cy); ctx.restore();
  }
}
export function drawPlayer(ctx, cam, player) {
  const x0 = cam.x - CFG.viewW / 2, y0 = cam.y - CFG.viewH / 2;
  const sx = player.x - x0, sy = player.y - y0;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(player.angle);
  ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1b2e'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(6, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
export function drawParticles(ctx, cam, particles) {
  const x0 = cam.x - CFG.viewW / 2, y0 = cam.y - CFG.viewH / 2;
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x - x0, p.y - y0, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
export function drawMinimap(ctx, world, player, police, marker) {
  const mw = 190, mh = 148, mx = CFG.viewW - mw - 14, my = 14;
  const P = CFG.palette;
  ctx.save();
  ctx.fillStyle = P.hudBg; roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10); ctx.fill();
  ctx.fillStyle = '#0d1126'; ctx.fillRect(mx, my, mw, mh);
  const sx = mw / CFG.worldW, sy = mh / CFG.worldH;
  ctx.fillStyle = '#2a3048';
  for (const cx of world.xs) ctx.fillRect(mx + cx * sx - 2, my, 4, mh);
  for (const cy of world.ys) ctx.fillRect(mx, my + cy * sy, mw, 4);
  ctx.fillStyle = '#3ddc84';
  for (const b of world.buildings) if (!b.park) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  if (marker) {
    ctx.fillStyle = P.neonPink; ctx.beginPath(); ctx.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of police) {
    ctx.fillStyle = '#4d9fff'; ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx + player.x * sx, my + player.y * sy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.hudText; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('NEON BAY', mx, my + mh + 22);
  ctx.restore();
}
export function drawHud(ctx, g) {
  const P = CFG.palette;
  ctx.save();
  // top-left: money + wanted
  ctx.fillStyle = P.hudBg; roundRect(ctx, 12, 12, 250, 64, 10); ctx.fill();
  ctx.fillStyle = P.neonGreen; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('$' + g.money.toLocaleString(), 24, 42);
  ctx.fillStyle = P.hudDim; ctx.font = '12px sans-serif';
  ctx.fillText('SCORE ' + g.score + '  •  ' + g.missionLabel, 24, 62);
  // wanted stars
  ctx.font = '22px sans-serif'; ctx.textAlign = 'left';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < g.wanted ? '★' : '☆';
  ctx.fillStyle = g.wanted > 0 ? P.star : '#5a6a8a';
  ctx.fillText(stars, 24, 96 - 12 + 12);
  // health bar
  ctx.fillStyle = P.hudBg; roundRect(ctx, 12, 104, 200, 20, 8); ctx.fill();
  ctx.fillStyle = g.health > 30 ? P.health : P.danger;
  roundRect(ctx, 14, 106, Math.max(4, 196 * (g.health / 100)), 16, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('HEALTH ' + Math.ceil(g.health), 20, 118);
  // mission objective bottom centre
  if (g.objective) {
    ctx.fillStyle = P.hudBg; const w = Math.min(720, 24 + g.objective.length * 8.2);
    roundRect(ctx, (CFG.viewW - w) / 2, CFG.viewH - 58, w, 40, 10); ctx.fill();
    ctx.fillStyle = P.neonPink; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(g.objective, CFG.viewW / 2, CFG.viewH - 32);
  }
  // speed + timer bottom right
  ctx.fillStyle = P.hudBg; roundRect(ctx, CFG.viewW - 190, CFG.viewH - 58, 178, 40, 10); ctx.fill();
  ctx.fillStyle = P.hudText; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText((g.inCar ? Math.round(Math.abs(g.speed) * 0.9) + ' km/h' : 'ON FOOT'), CFG.viewW - 24, CFG.viewH - 32);
  ctx.fillStyle = P.hudDim; ctx.font = '12px sans-serif';
  ctx.fillText('TIME ' + Math.max(0, Math.ceil(g.timeLeft)) + 's', CFG.viewW - 24, CFG.viewH - 14 + 2);
  // controls hint
  ctx.fillStyle = 'rgba(230,240,255,0.65)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('WASD drive / walk • E steal car • SPACE handbrake • P pause • M mute • R restart', 14, CFG.viewH - 10);
  ctx.restore();
}
export function drawTitle(ctx, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,20,0.62)'; ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = CFG.palette.neonPink; ctx.shadowColor = CFG.palette.neonPink; ctx.shadowBlur = 26;
  ctx.font = 'bold 84px sans-serif'; ctx.fillText('NEON BAY', CFG.viewW / 2, 240);
  ctx.shadowBlur = 0;
  ctx.fillStyle = CFG.palette.neonCyan; ctx.font = 'bold 22px sans-serif';
  ctx.fillText('— A NEON CITY CRIME STORY —', CFG.viewW / 2, 282);
  ctx.fillStyle = '#eaf6ff'; ctx.font = '17px sans-serif';
  ctx.fillText('Steal cars. Outrun the police. Run missions. Own the night.', CFG.viewW / 2, 330);
  ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 19px sans-serif';
  const blink = Math.sin(time * 3) > -0.2;
  if (blink) ctx.fillText('PRESS ENTER TO START', CFG.viewW / 2, 400);
  ctx.fillStyle = '#9fb4d8'; ctx.font = '14px sans-serif';
  ctx.fillText('WASD / Arrows — move & drive    •    E — enter / exit car    •    SPACE — handbrake', CFG.viewW / 2, 460);
  ctx.fillText('Missions: TAXI FARE • COURIER RUN • GETAWAY    •    P pause    •    M mute    •    R restart', CFG.viewW / 2, 486);
  ctx.fillText('Starring: RICO VANCE, getaway driver • MARA SOL, fixer • DET. KANE, Neon Bay PD', CFG.viewW / 2, 530);
  ctx.restore();
}
export function drawEndScreen(ctx, kind, money, score) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,20,0.72)'; ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  const isBusted = kind === 'busted';
  ctx.fillStyle = isBusted ? '#4d9fff' : '#ff3b5c'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 24;
  ctx.font = 'bold 76px sans-serif';
  ctx.fillText(isBusted ? 'BUSTED!' : 'WASTED', CFG.viewW / 2, 280);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#eaf6ff'; ctx.font = '20px sans-serif';
  ctx.fillText(isBusted ? 'Det. Kane and the Neon Bay PD finally caught up with Rico.' : 'Rico Vance went down in a blaze of neon. The city keeps moving.', CFG.viewW / 2, 330);
  ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 24px sans-serif';
  ctx.fillText('MONEY $' + money.toLocaleString() + '   •   SCORE ' + score, CFG.viewW / 2, 390);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PRESS R TO RUN IT BACK', CFG.viewW / 2, 450);
  ctx.restore();
}
export function drawPaused(ctx) {
  ctx.save(); ctx.fillStyle = 'rgba(5,8,20,0.6)'; ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', CFG.viewW / 2, CFG.viewH / 2); ctx.restore();
}
