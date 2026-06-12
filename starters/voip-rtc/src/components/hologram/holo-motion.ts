/* Pure motion math for the hologram: everything here is a function of
   its inputs alone, so gaze and mood stay replayable in the BDD harness.
   Blink lives in holo-micromotion (stochastic, seeded). */

/** Pointer position → normalized gaze, clamped to [-1,1]. y grows
    upward so a pointer above the stage lifts the chin. */
export function gazeTarget(
  pointerX: number,
  pointerY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const x = (pointerX - cx) / (rect.width / 2 || 1);
  const y = (cy - pointerY) / (rect.height / 2 || 1);
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
