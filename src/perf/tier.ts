import type { TierName } from '@/rain/rainConfig';
import { TIERS } from '@/rain/rainConfig';

export type { TierName };
export { TIERS };

export interface TierSpec {
  name: TierName;
  instances: number;
  bloomLevels: number;
  msaa: number;
  dpr: [number, number];
  textBudget: number;
  ambientRain: boolean;
  heroFormation: number;
  chromaticAberration: boolean;
}

/**
 * Re-baselined against measured numbers, not guesses.
 *
 * Measured on Intel UHD 630 with the PRODUCTION distribution (spline shell,
 * rMax 20, glyphSize 0.55), viewed from real journey positions:
 *   90k instances @ 1080p/dpr1.5 = 3.2-4.4ms depending on where you are.
 * The whole scene render (all meshes, 30 draw calls) is under 1ms, so the rain
 * and the bloom pass are the entire budget.
 *
 * LOW keeps a SHORT bloom rather than none. Bloom is not what makes this scene
 * expensive — the rain instances are, and LOW already cuts those from 60k to 9k.
 * Dropping it entirely made the whole site change character the moment a machine
 * dipped below the demotion bound: every neon line went flat, with no way back.
 * Two mip levels is a tight halo for a fraction of the cost of four.
 *
 * MSAA is deliberately capped at 2. The scene is overwhelmingly additive,
 * alpha-textured glyphs with no hard geometric edges — MSAA only helps the
 * text and wireframes, and 4x costs full-resolution multisample bandwidth on
 * integrated GPUs for a difference that is invisible here.
 *
 * DPR is capped at 1.75 rather than 2.0 for the same reason: rain cost scales
 * linearly with pixels, and 2.0 buys nothing perceptible on a scene this dark.
 */
export const TIER_SPECS: Record<TierName, TierSpec> = {
  ULTRA:   { name: 'ULTRA',   instances: 85_000, bloomLevels: 5, msaa: 2, dpr: [1.0, 1.75],  textBudget: 40, ambientRain: true,  heroFormation: 4000, chromaticAberration: true },
  HIGH:    { name: 'HIGH',    instances: 60_000, bloomLevels: 4, msaa: 2, dpr: [1.0, 1.5],   textBudget: 40, ambientRain: true,  heroFormation: 3000, chromaticAberration: true },
  MID:     { name: 'MID',     instances: 24_000, bloomLevels: 3, msaa: 0, dpr: [0.9, 1.25],  textBudget: 24, ambientRain: false, heroFormation: 2000, chromaticAberration: true },
  LOW:     { name: 'LOW',     instances: 9_000,  bloomLevels: 2, msaa: 0, dpr: [0.75, 1.0],  textBudget: 14, ambientRain: false, heroFormation: 1500, chromaticAberration: true },
  REDUCED: { name: 'REDUCED', instances: 2_500,  bloomLevels: 0, msaa: 0, dpr: [1.0, 1.0],   textBudget: 14, ambientRain: false, heroFormation: 0,    chromaticAberration: false },
};

export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/**
 * Runs during the loader so its cost is hidden. PerformanceMonitor may demote
 * from here at runtime, but never promotes past this ceiling.
 */
/** Dev-only: `?tier=ULTRA` pins the tier so captures and comparisons are deterministic. */
export function tierOverride(): TierName | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('tier');
  return v && v in TIER_SPECS ? (v as TierName) : null;
}

export async function detectTier(): Promise<TierName> {
  const forced = tierOverride();
  if (forced) return forced;

  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return 'REDUCED';
  if (!hasWebGL2()) return 'REDUCED';

  const cores = navigator.hardwareConcurrency ?? 4;
  const memGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  let gpuTier = 2;
  try {
    // detect-gpu ships inside drei, so this costs no extra dependency.
    const { getGPUTier } = await import('detect-gpu');
    const res = await getGPUTier();
    gpuTier = res.tier ?? 2;
    if (res.isMobile && gpuTier > 2) gpuTier = 2;
  } catch {
    /* fall back to the heuristics below */
  }

  if (gpuTier >= 3 && cores >= 8 && memGB >= 8 && !coarse) return 'ULTRA';
  if (gpuTier >= 3 || (gpuTier === 2 && !coarse)) return 'HIGH';
  if (gpuTier === 2) return 'MID';
  return 'LOW';
}

const ORDER: TierName[] = ['REDUCED', 'LOW', 'MID', 'HIGH', 'ULTRA'];

/**
 * Perf demotion floors at LOW, never REDUCED.
 *
 * REDUCED is an ACCESSIBILITY mode — it freezes the camera to anchor snaps and
 * cuts the hero formation entirely. Letting a few slow frames select it means a
 * merely-weak GPU silently gets the reduced-motion experience, which is a
 * different (and much worse) site than the one the user asked for.
 */
export function demote(t: TierName, floor: TierName = 'LOW'): TierName {
  const next = Math.max(0, ORDER.indexOf(t) - 1);
  return ORDER[Math.max(next, ORDER.indexOf(floor))];
}
export function promote(t: TierName, ceiling: TierName): TierName {
  const next = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(t) + 1)];
  return ORDER.indexOf(next) <= ORDER.indexOf(ceiling) ? next : t;
}
