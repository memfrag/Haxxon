const STEP = 1 / 120;
const MAX_ACC = 0.25;

export function startLoop(update: (dt: number) => void, render: () => void): void {
  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    acc = Math.min(acc + (now - last) / 1000, MAX_ACC);
    last = now;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
