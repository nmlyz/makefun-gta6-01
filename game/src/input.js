// Keyboard state for Neon Bay. WASD/arrows move & drive, E enter/exit car,
// Space handbrake / action, P pause, M mute, R restart, Enter start mission.
export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  const state = {
    keys, pressed,
    up: false, down: false, left: false, right: false,
    action: false, enterCar: false, pause: false, mute: false, restart: false, confirm: false
  };
  function sync() {
    const k = keys;
    state.up = k.has('KeyW') || k.has('ArrowUp');
    state.down = k.has('KeyS') || k.has('ArrowDown');
    state.left = k.has('KeyA') || k.has('ArrowLeft');
    state.right = k.has('KeyD') || k.has('ArrowRight');
    state.action = k.has('Space');
  }
  function onDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      pressed.add(e.code);
      if (e.code === 'KeyE') state.enterCar = true;
      if (e.code === 'KeyP' || e.code === 'Escape') state.pause = true;
      if (e.code === 'KeyM') state.mute = true;
      if (e.code === 'KeyR') state.restart = true;
      if (e.code === 'Enter') state.confirm = true;
    }
    keys.add(e.code); sync();
  }
  function onUp(e) { keys.delete(e.code); sync(); }
  function onBlur() { keys.clear(); sync(); }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
  }
  state.consume = function (name) {
    const v = state[name];
    state[name] = false;
    return v;
  };
  state.clearEdges = function () { state.enterCar = state.pause = state.mute = state.restart = state.confirm = false; pressed.clear(); };
  return state;
}
export function isDown(input, code) { return input.keys.has(code); }
