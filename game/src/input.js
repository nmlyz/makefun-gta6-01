// Keyboard and pointer input. Held keys give a movement vector (steering and throttle in
// a car, walking on foot) plus a run flag; one-shot presses (confirm, interact, pause) are
// queued as bit flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. lastActivity() lets the game notice a player who has gone
// idle, so the autopilot can take over until the next real key press.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const INTERACT = new Set(['KeyE', 'KeyF']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = { left: false, right: false, up: false, down: false, run: false };
  let actions = 0;
  let activity = performance.now();

  function poke() {
    activity = performance.now();
  }

  window.addEventListener('keydown', (event) => {
    poke();
    if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (RUN.has(event.code)) held.run = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (RUN.has(event.code)) held.run = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.left = false;
    held.right = false;
    held.up = false;
    held.down = false;
    held.run = false;
  });
  target.addEventListener('pointerdown', () => {
    poke();
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The held movement as a control vector: x is steering/strafe, y is throttle/forward. */
    axes() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        run: held.run,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Milliseconds since the last key press or click. */
    idleMs() {
      return performance.now() - activity;
    },
    poke,
  };
}
