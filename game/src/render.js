// Drawing only: the world's state and the current screen in, pixels out. A camera follows
// the player over the city; the 1280x720 view is scaled to fit the window and centred.
// Buildings get shaded roofs and lit windows, roads get lane dashes and crosswalks, cars
// are rounded bodies with windscreens (police carry a flashing light bar), and the HUD
// carries cash, score, wanted stars, health, the mission arrow and a minimap.

import { CITY, FIELD, FONT, PALETTE, PLAYER, WANTED, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const ROOFS = ['#5b6ee1', '#e15b7a', '#3fa7a0', '#8d6fd1', '#d18a3f', '#4a90d9', '#c94f6d', '#5fbf77'];
const ROOF_DARK = ['#4653ad', '#ad465c', '#2f7d78', '#6d53ad', '#9d6a2f', '#376fad', '#9d3a52', '#478f5c'];

const MAP = { w: 232, h: 168, pad: 14 };

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let camX = 0;
  let camY = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  // ---- the city ----

  function drawGround(state) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Sidewalk slabs under every block.
    context.fillStyle = PALETTE.sidewalk;
    for (let r = 0; r < CITY.rows; r += 1) {
      for (let c = 0; c < CITY.cols; c += 1) {
        context.fillRect(c * CITY.pitch + CITY.road - 8, r * CITY.pitch + CITY.road - 8, CITY.pitch - CITY.road + 16, CITY.pitch - CITY.road + 16);
      }
    }
    // Parks sit on their slab as darker lawns with a few trees.
    for (const park of state.parks) {
      context.fillStyle = PALETTE.grassDark;
      context.fillRect(park.x + 4, park.y + 4, park.w - 8, park.h - 8);
      context.fillStyle = '#1d5233';
      const trees = [[0.25, 0.3], [0.7, 0.22], [0.45, 0.65], [0.8, 0.78], [0.15, 0.8]];
      for (const [fx, fy] of trees) {
        context.beginPath();
        context.arc(park.x + park.w * fx, park.y + park.h * fy, 17, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Parking lots: asphalt with stall lines.
    for (const lot of state.lots) {
      context.fillStyle = '#3a3d47';
      context.fillRect(lot.x, lot.y, lot.w, lot.h);
      context.strokeStyle = '#cfd3da';
      context.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        context.strokeRect(lot.x + 14 + i * 44, lot.y + 16, 34, 58);
        context.strokeRect(lot.x + 14 + i * 44, lot.y + lot.h - 74, 34, 58);
      }
    }
  }

  function drawRoads() {
    context.fillStyle = PALETTE.road;
    for (let c = 0; c < CITY.cols; c += 1) {
      context.fillRect(c * CITY.pitch, 0, CITY.road, WORLD.height);
    }
    for (let r = 0; r < CITY.rows; r += 1) {
      context.fillRect(0, r * CITY.pitch, WORLD.width, CITY.road);
    }
    // Lane dashes down the middle of each road.
    context.fillStyle = PALETTE.lane;
    for (let c = 0; c < CITY.cols; c += 1) {
      const x = c * CITY.pitch + CITY.road / 2 - 2;
      for (let y = 10; y < WORLD.height; y += 44) {
        if ((y % CITY.pitch) < CITY.road) continue;
        context.fillRect(x, y, 4, 24);
      }
    }
    for (let r = 0; r < CITY.rows; r += 1) {
      const y = r * CITY.pitch + CITY.road / 2 - 2;
      for (let x = 10; x < WORLD.width; x += 44) {
        if ((x % CITY.pitch) < CITY.road) continue;
        context.fillRect(x, y, 24, 4);
      }
    }
    // Zebra crosswalks on the four approaches of every intersection.
    context.fillStyle = PALETTE.crosswalk;
    for (let c = 0; c < CITY.cols; c += 1) {
      for (let r = 0; r < CITY.rows; r += 1) {
        const x = c * CITY.pitch;
        const y = r * CITY.pitch;
        for (let s = 0; s < 3; s += 1) {
          context.fillRect(x + 12 + s * 26, y + 5, 15, 16);
          context.fillRect(x + 12 + s * 26, y + CITY.road - 21, 15, 16);
          context.fillRect(x + 5, y + 12 + s * 26, 16, 15);
          context.fillRect(x + CITY.road - 21, y + 12 + s * 26, 16, 15);
        }
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.30)';
      context.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      context.fillStyle = ROOF_DARK[b.hue];
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = ROOFS[b.hue];
      const inset = 8;
      context.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
      // A rooftop block and a grid of lit windows sell the height.
      context.fillStyle = ROOF_DARK[b.hue];
      context.fillRect(b.x + b.w * 0.34, b.y + b.h * 0.34, b.w * 0.32, b.h * 0.32);
      context.fillStyle = 'rgba(255,224,130,0.85)';
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 7 + j * 13 + b.hue * 5 + b.floors) % 3 === 0) continue;
          context.fillRect(b.x + 14 + i * ((b.w - 28) / cols), b.y + 14 + j * ((b.h - 28) / rows), 9, 6);
        }
      }
      context.strokeStyle = PALETTE.roofEdge;
      context.lineWidth = 2;
      context.strokeRect(b.x, b.y, b.w, b.h);
    }
  }

  function drawPickup(pk, time) {
    const bob = Math.sin(pk.spin) * 3;
    context.save();
    context.translate(pk.x, pk.y + bob);
    context.rotate(Math.sin(pk.spin * 0.6) * 0.25);
    context.fillStyle = PALETTE.cashDark;
    roundRect(-13, -9, 26, 18, 3);
    context.fill();
    context.fillStyle = PALETTE.cash;
    roundRect(-10, -6, 20, 12, 2);
    context.fill();
    context.fillStyle = '#0c3d21';
    context.font = `bold 12px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('$', 0, 1);
    context.restore();
    context.textBaseline = 'alphabetic';
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.32)';
    roundRect(-20, -8, 46, 24, 7);
    context.fill();
    context.fillStyle = car.kind === 'police' ? PALETTE.policeBody : car.color;
    if (car.health <= 25) context.fillStyle = '#5a5e66';
    roundRect(-22, -11, 44, 22, 7);
    context.fill();
    if (car.kind === 'police') {
      context.fillStyle = PALETTE.policeTrim;
      context.fillRect(-8, -11, 15, 22);
    }
    // Windscreen and rear window.
    context.fillStyle = '#bfe6f5';
    roundRect(3, -8, 8, 16, 3);
    context.fill();
    context.fillStyle = '#7fa8ba';
    roundRect(-14, -8, 6, 16, 3);
    context.fill();
    // Headlights.
    context.fillStyle = '#fff6bf';
    context.fillRect(20, -9, 3, 5);
    context.fillRect(20, 4, 3, 5);
    if (car.kind === 'police') {
      const phase = Math.floor(time * 6 + car.flash) % 2 === 0;
      context.fillStyle = phase ? '#ff4040' : '#ffd7d7';
      roundRect(-4, -9, 8, 7, 2);
      context.fill();
      context.fillStyle = phase ? '#cfe4ff' : '#3f7fd1';
      roundRect(-4, 2, 8, 7, 2);
      context.fill();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, cycle, isPlayer) {
    context.save();
    context.translate(x, y);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.arc(2, 3, 11, 0, Math.PI * 2);
    context.fill();
    const stride = Math.sin(cycle) * 3;
    context.fillStyle = '#2b2f3a';
    context.beginPath();
    context.arc(Math.cos(angle + Math.PI / 2) * stride, Math.sin(angle + Math.PI / 2) * stride - 2, 4, 0, Math.PI * 2);
    context.arc(-Math.cos(angle + Math.PI / 2) * stride, -Math.sin(angle + Math.PI / 2) * stride + 2, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = skin;
    context.beginPath();
    context.arc(Math.cos(angle) * 2, Math.sin(angle) * 2, 6, 0, Math.PI * 2);
    context.fill();
    if (isPlayer) {
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, 15, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  // ---- HUD ----

  function drawStars(state) {
    const size = 30;
    const totalW = WANTED.maxStars * (size + 6);
    let x = FIELD.width / 2 - totalW / 2;
    context.textBaseline = 'top';
    for (let i = 0; i < WANTED.maxStars; i += 1) {
      text('★', x, 12, size, i < state.stars ? PALETTE.star : PALETTE.starOff, 'left');
      x += size + 6;
    }
    context.textBaseline = 'alphabetic';
  }

  function drawHud(state, auto) {
    context.fillStyle = 'rgba(10,12,22,0.55)';
    roundRect(14, 12, 252, 96, 10);
    context.fill();
    context.textBaseline = 'top';
    text(`$${state.cash}`, 28, 20, 30, PALETTE.cash, 'left');
    text(`SCORE ${Math.floor(state.score)}`, 28, 56, 20, PALETTE.text, 'left');
    // Health bar.
    context.fillStyle = '#3a3f4d';
    roundRect(28, 84, 160, 12, 6);
    context.fill();
    context.fillStyle = state.player.health <= 30 ? PALETTE.healthLow : PALETTE.health;
    if (state.player.health > 0) {
      roundRect(28, 84, 160 * (state.player.health / PLAYER.maxHealth), 12, 6);
      context.fill();
    }
    if (state.player.bust > 0.03 && state.player.car === null) {
      text('BUSTED…', 200, 78, 18, PALETTE.healthLow, 'left');
    }
    context.textBaseline = 'alphabetic';
    drawStars(state);

    if (state.mission !== null) {
      const p = state.player.car ?? state.player;
      const dx = state.mission.x - p.x;
      const dy = state.mission.y - p.y;
      const d = Math.hypot(dx, dy);
      context.textBaseline = 'top';
      text(`DELIVERY ${Math.max(0, Math.ceil(state.missionTimer))}s · ${Math.round(d)}m`, FIELD.width - 28, 20, 20, PALETTE.beacon, 'right');
      context.textBaseline = 'alphabetic';
      // Direction arrow at the view's edge toward the checkpoint.
      const ang = Math.atan2(dy, dx);
      const ax = FIELD.width / 2 + Math.cos(ang) * 90;
      const ay = FIELD.height / 2 + Math.sin(ang) * 90;
      context.save();
      context.translate(ax, ay);
      context.rotate(ang);
      context.fillStyle = PALETTE.beacon;
      context.beginPath();
      context.moveTo(16, 0);
      context.lineTo(-10, -10);
      context.lineTo(-10, 10);
      context.closePath();
      context.fill();
      context.restore();
    }

    if (state.player.car !== null) {
      const speed = Math.round(Math.abs(state.player.car.speed) * 0.24);
      context.textBaseline = 'bottom';
      text(`${speed} km/h`, FIELD.width - 28, FIELD.height - MAP.h - 34, 24, PALETTE.text, 'right');
      context.textBaseline = 'alphabetic';
    }
    if (auto) {
      context.textBaseline = 'bottom';
      text('AUTO — press any key to take over', FIELD.width / 2, FIELD.height - 16, 18, PALETTE.muted, 'center');
      context.textBaseline = 'alphabetic';
    } else {
      context.textBaseline = 'bottom';
      text(state.player.car !== null ? 'W A S D drive · E get out · P pause' : 'W A S D move · Shift run · E get in car · P pause', 16, FIELD.height - 16, 16, PALETTE.muted, 'left');
      context.textBaseline = 'alphabetic';
    }
    if (state.messageTime > 0 && state.message !== '') {
      context.textBaseline = 'top';
      text(state.message, FIELD.width / 2, 64, 30, PALETTE.beacon, 'center');
      context.textBaseline = 'alphabetic';
    }
  }

  function drawMinimap(state) {
    const x = FIELD.width - MAP.w - MAP.pad;
    const y = FIELD.height - MAP.h - MAP.pad;
    context.fillStyle = PALETTE.minimapBg;
    roundRect(x - 4, y - 4, MAP.w + 8, MAP.h + 8, 8);
    context.fill();
    context.strokeStyle = '#565d6e';
    context.lineWidth = 1.5;
    roundRect(x - 4, y - 4, MAP.w + 8, MAP.h + 8, 8);
    context.stroke();
    const sx = MAP.w / WORLD.width;
    const sy = MAP.h / WORLD.height;
    context.fillStyle = '#8a93a8';
    for (let c = 0; c < CITY.cols; c += 1) context.fillRect(x + c * CITY.pitch * sx, y, CITY.road * sx, MAP.h);
    for (let r = 0; r < CITY.rows; r += 1) context.fillRect(x, y + r * CITY.pitch * sy, MAP.w, CITY.road * sy);
    if (state.mission !== null) {
      context.fillStyle = PALETTE.beacon;
      context.beginPath();
      context.arc(x + state.mission.x * sx, y + state.mission.y * sy, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#ff4040' : '#3f7fd1';
      context.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 5, 5);
    }
    const p = state.player.car ?? state.player;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(x + p.x * sx, y + p.y * sy, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.player;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawBeacon(state) {
    if (state.mission === null) return;
    const m = state.mission;
    const pulse = 1 + Math.sin(state.time * 5) * 0.15;
    context.strokeStyle = PALETTE.beacon;
    context.lineWidth = 5;
    context.beginPath();
    context.arc(m.x, m.y, 44 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(255,210,62,0.20)';
    context.beginPath();
    context.arc(m.x, m.y, 44 * pulse, 0, Math.PI * 2);
    context.fill();
    // A light pillar so the goal reads from far away.
    context.fillStyle = 'rgba(255,210,62,0.30)';
    context.fillRect(m.x - 7, m.y - 190, 14, 190);
    context.textBaseline = 'middle';
    text('$', m.x, m.y, 40, PALETTE.beacon, 'center');
    context.textBaseline = 'alphabetic';
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 680;
    const lineH = 34;
    const h = 150 + lines.length * lineH + 66;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, w, h, 16);
    context.fill();
    context.strokeStyle = accent ?? PALETTE.panelEdge;
    context.lineWidth = 3;
    roundRect(x, y, w, h, 16);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 84, 54, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 138 + i * lineH, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + h - 30, 24, PALETTE.beacon, 'center');
  }

  const TITLE_LINES = [
    'Steal cars, run deliveries, dodge the law.',
    'WASD / arrows to move and drive · E to get in or out',
    'Shift to run · P to pause · Cash and deliveries raise your score',
  ];

  /** Paint one frame. `meta` carries { best, auto, overReason } for the panels. */
  function draw(state, screen, meta) {
    const focus = state.player.car ?? state.player;
    camX = clamp(focus.x - FIELD.width / 2, 0, Math.max(0, WORLD.width - FIELD.width));
    camY = clamp(focus.y - FIELD.height / 2, 0, Math.max(0, WORLD.height - FIELD.height));

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    context.translate(-camX, -camY);

    drawGround(state);
    drawRoads();
    drawBuildings(state);
    drawBeacon(state);
    for (const pk of state.pickups) drawPickup(pk, state.time);
    for (const ped of state.peds) {
      if (ped.down > 0) {
        context.save();
        context.translate(ped.x, ped.y);
        context.rotate(ped.angle + Math.PI / 2);
        context.fillStyle = PALETTE.pedShirt[ped.shirt];
        roundRect(-6, -12, 12, 24, 5);
        context.fill();
        context.restore();
      } else {
        drawPerson(ped.x, ped.y, ped.angle, PALETTE.pedShirt[ped.shirt], '#e8b98d', ped.walkCycle, false);
      }
    }
    for (const car of state.cars) {
      if (car === state.player.car) continue;
      drawCar(car, state.time);
    }
    if (state.player.car !== null) drawCar(state.player.car, state.time);
    else drawPerson(state.player.x, state.player.y, state.player.angle, PALETTE.player, PALETTE.playerSkin, state.player.walkCycle, true);

    context.restore();

    if (screen === SCREEN_TITLE) {
      drawPanel('NEON BAY', [...TITLE_LINES, meta.best > 0 ? `Best score ${Math.floor(meta.best)}` : ''], 'Press Space or click to play');
      return;
    }
    drawHud(state, meta.auto);
    drawMinimap(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', ['The city waits for no one. Well, just this once.'], 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      const busted = meta.overReason === 'busted';
      drawPanel(
        busted ? 'BUSTED' : 'WASTED',
        [
          `Score ${Math.floor(state.score)} · Best ${Math.floor(Math.max(meta.best, state.score))}`,
          `Cash $${state.cash} · Deliveries ${state.deliveries} · Crimes ${state.crimes}`,
          `Survived ${Math.floor(state.time)}s in Neon Bay`,
        ],
        'Press Space or click to play again',
        busted ? '#3f7fd1' : '#e5534b',
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
