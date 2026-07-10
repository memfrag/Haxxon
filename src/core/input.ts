const held = new Set<string>();
const oneShot = new Set<string>();

export const settings = {
  invertY: localStorage.getItem('haxxon.invert') === '1',
};

const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  held.add(e.code);
  oneShot.add(e.code);
  if (PREVENT.has(e.code)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  held.delete(e.code);
});

export function isDown(...codes: string[]): boolean {
  for (const c of codes) if (held.has(c)) return true;
  return false;
}

/** One-shot: true once per physical press, survives multiple fixed substeps per frame. */
export function consume(code: string): boolean {
  if (oneShot.has(code)) { oneShot.delete(code); return true; }
  return false;
}

export function moveX(): number {
  return (isDown('ArrowRight', 'KeyD') ? 1 : 0) - (isDown('ArrowLeft', 'KeyA') ? 1 : 0);
}

export function moveY(): number {
  const raw = (isDown('ArrowUp', 'KeyW') ? 1 : 0) - (isDown('ArrowDown', 'KeyS') ? 1 : 0);
  return settings.invertY ? -raw : raw;
}

export function fireHeld(): boolean {
  return isDown('Space');
}

export function toggleInvert(): boolean {
  settings.invertY = !settings.invertY;
  localStorage.setItem('haxxon.invert', settings.invertY ? '1' : '0');
  return settings.invertY;
}
