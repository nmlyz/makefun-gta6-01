// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over. On the
// title screen the autopilot plays an attract game behind the panel; in play, six idle
// seconds hand the wheel to the autopilot until the next key press, and a finished run
// restarts itself after a pause — so the game never sits broken in front of anyone,
// human or automated, who is watching it.
//
// ?seed=N fixes the city and every random choice. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_DELIVERY, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, createInput } from './input.js';
import { createPilot } from './pilot.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Idle time in play before the autopilot takes over. */
const IDLE_TAKEOVER_MS = 6000;
/** A finished run restarts itself after this long with no input. */
const OVER_RESTART_MS = 7000;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, auto: scene.auto, overReason: scene.overReason });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const pilot = createPilot();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let overSince = null;
  let pendingInteract = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    pilot.reset();
    accumulator = 0;
    overSince = null;
    screen = SCREEN_PLAY;
    announce('Playing Neon Bay. Steal a car, run deliveries, avoid the police.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    overSince = performance.now();
    if (world.state.score > best) {
      best = Math.floor(world.state.score);
      saveBest(best);
    }
    announce(`Game over. Score ${Math.floor(world.state.score)}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_INTERACT) pendingInteract = true;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  /** The control for one step: the player's, or the autopilot's when they have gone idle. */
  function currentControl(auto) {
    if (auto) {
      pendingInteract = false;
      return pilot.control(world.state);
    }
    const axes = input.axes();
    const inCar = world.state.player.car !== null;
    const control = inCar
      ? { moveX: axes.x, moveY: -axes.y, run: false, interact: pendingInteract }
      : { moveX: axes.x, moveY: axes.y, run: axes.run, interact: pendingInteract };
    pendingInteract = false;
    return control;
  }

  function step(auto) {
    const events = world.step(STEP, currentControl(auto));
    if (events & EVENT_OVER) {
      // The attract game behind the title panel just deals a fresh city and plays on.
      if (screen === SCREEN_TITLE) {
        world.reset();
        pilot.reset();
      } else endGame();
    } else if (events & EVENT_DELIVERY) announce(world.state.message);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();

    const idle = input.idleMs();
    const auto = screen === SCREEN_TITLE || (screen === SCREEN_PLAY && idle > IDLE_TAKEOVER_MS);

    if (screen === SCREEN_OVER && overSince !== null && now - overSince > OVER_RESTART_MS && idle > OVER_RESTART_MS) {
      startGame();
    }

    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(auto);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      best,
      auto: screen === SCREEN_PLAY && auto,
      overReason: world.state.over,
    });
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
