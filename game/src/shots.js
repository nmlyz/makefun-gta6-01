// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world, steered by the autopilot (or, for the end, by a kamikaze driver), so
// the frame is what a real game looks like and the same seed always gives the same frame:
// start is the title over a living city, play is a delivery run with the police already
// interested, and end is the game-over panel after a fatal spree.

import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { createKamikaze, createPilot } from './pilot.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 16;
const END_LIMIT_SECONDS = 75;

function runFor(world, seconds, controlFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.step(STEP, controlFn(world.state)) & EVENT_OVER) break;
  }
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it, the best score to show and why the run ended.
 */
export function stageShot(name, world) {
  world.reset();
  const pilot = createPilot();

  if (name === 'play') {
    // A few seconds to get moving, then a crime spree the autopilot must outrun on camera.
    runFor(world, 4, (s) => pilot.control(s));
    world.commitCrime(58);
    runFor(world, PLAY_SECONDS - 4, (s) => pilot.control(s));
    if (world.state.over !== null) {
      // The pilot got caught inside the window: rewind to a calmer chase for the cover shot.
      world.reset();
      pilot.reset();
      runFor(world, 6, (s) => pilot.control(s));
      world.commitCrime(30);
      runFor(world, 5, (s) => pilot.control(s));
    }
    return { screen: SCREEN_PLAY, best: 0, overReason: null, auto: true };
  }

  if (name === 'end') {
    runFor(world, END_LIMIT_SECONDS, createKamikaze());
    if (world.state.over === null) world.damagePlayer(1000);
    return { screen: SCREEN_OVER, best: world.state.score, overReason: world.state.over, auto: false };
  }

  runFor(world, START_SECONDS, (s) => pilot.control(s));
  return { screen: SCREEN_TITLE, best: 0, overReason: null, auto: true };
}
