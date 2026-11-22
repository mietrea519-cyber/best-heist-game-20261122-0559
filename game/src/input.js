// Keyboard and mouse input: a live key set plus a click queue the main loop
// drains. WASD and arrows move, Shift sneaks, R runs, Esc/P pauses, Space
// starts and restarts, M mutes.
export function createInput(canvas) {
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    run: false,
    clicks: [],
    muted: false,
  };
  const keys = new Set();
  const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

  function refresh() {
    input.up = keys.has('KeyW') || keys.has('ArrowUp');
    input.down = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.run = keys.has('KeyR');
  }

  function keyDown(e) {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyM') input.muted = !input.muted;
    if (e.code === 'Space' || e.code === 'Enter') input.clicks.push({ x: -1, y: -1, key: true });
    refresh();
  }
  function keyUp(e) {
    keys.delete(e.code);
    refresh();
  }
  function mouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    input.clicks.push({ x, y, key: false });
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('blur', () => { keys.clear(); refresh(); });

  input.isPausePressed = function isPausePressed() {
    return keys.has('Escape') || keys.has('KeyP');
  };
  input.consumePause = function consumePause() {
    keys.delete('Escape');
    keys.delete('KeyP');
    refresh();
  };
  input.drainClicks = function drainClicks() {
    const out = input.clicks;
    input.clicks = [];
    return out;
  };
  return input;
}
