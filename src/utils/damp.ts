/**
 * Frame-rate-independent damping. Never use lerp(a, b, 0.1) — that is
 * frame-rate dependent and feels different at 144Hz than at 60Hz.
 */
export const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
