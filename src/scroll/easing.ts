export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const linear = (t: number) => t;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInOutQuint = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1e-6));
  return t * t * (3 - 2 * t);
};

export const EASE = {
  linear,
  inOutCubic: easeInOutCubic,
  inOutQuint: easeInOutQuint,
  outExpo: easeOutExpo,
} as const;
