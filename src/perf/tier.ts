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
 * The dpr ranges here are the DESKTOP baseline. They are not the final word:
 * resolveTier() below raises the ceiling on small, dense screens, where the
 * same cap would otherwise mean rendering a phone at 40% of its native pixels.
 */
export const TIER_SPECS: Record<TierName, TierSpec> = {
  ULTRA:   { name: 'ULTRA',   instances: 85_000, bloomLevels: 5, msaa: 2, dpr: [1.0, 1.75],  textBudget: 40, ambientRain: true,  heroFormation: 4000, chromaticAberration: true },
  HIGH:    { name: 'HIGH',    instances: 60_000, bloomLevels: 4, msaa: 2, dpr: [1.0, 1.5],   textBudget: 40, ambientRain: true,  heroFormation: 3000, chromaticAberration: true },
  MID:     { name: 'MID',     instances: 24_000, bloomLevels: 3, msaa: 0, dpr: [0.9, 1.25],  textBudget: 24, ambientRain: false, heroFormation: 2000, chromaticAberration: true },
  LOW:     { name: 'LOW',     instances: 9_000,  bloomLevels: 2, msaa: 0, dpr: [0.75, 1.0],  textBudget: 14, ambientRain: false, heroFormation: 1500, chromaticAberration: true },
  REDUCED: { name: 'REDUCED', instances: 2_500,  bloomLevels: 0, msaa: 0, dpr: [1.0, 1.0],   textBudget: 14, ambientRain: false, heroFormation: 0,    chromaticAberration: false },
};

/**
 * Quality as a PIXEL BUDGET, not a dpr number.
 *
 * A dpr cap means nothing without a screen size. Phones report
 * devicePixelRatio 2.5-3.5, and R3F clamps that into the tier's range
 * (`Math.min(Math.max(min, devicePixelRatio), max)`), so a phone on MID drew
 * its canvas at 1.25 and handed the browser a buffer at ~40% of the pixels the
 * display asks for. The upscale to fill the screen IS the "3D looks low-res on
 * mobile" complaint — nothing in the scene was ever soft, it was being
 * magnified 2.4x before it reached the glass.
 *
 * What the GPU actually pays for is PIXELS, and a 390x844 phone has 4.5x less
 * CSS area than a 1512x982 laptop. So the tiers name a pixel budget, and the
 * dpr cap falls out of it per device: sqrt(budget / cssArea).
 *
 * The budgets are set so nothing already running well moves — a cap is only
 * ever RAISED, never lowered, so desktop and tablet resolve to exactly the
 * numbers they had. Only small, dense screens gain, which is precisely where
 * the clamp was doing the damage.
 */
const PIXEL_BUDGET: Record<TierName, number> = {
  ULTRA:   3_400_000,
  HIGH:    2_800_000,
  MID:     2_200_000,
  LOW:     1_000_000,
  REDUCED: 2_200_000,
};

/**
 * 2.0 stays the hard ceiling. Past it the rain's fill cost climbs with nothing
 * perceptible in return: a DPR-3 phone rendering tens of thousands of additive
 * quads plus a bloom mip chain at native resolution thermal-throttles inside
 * about twenty seconds, and the difference between 2x and 3x on a 5-inch panel
 * is not visible at arm's length.
 */
const DPR_CEILING = 2;

function cssArea(): number {
  if (typeof window === 'undefined') return 1_500_000;
  // Area is rotation-invariant, so this does not churn on orientation change.
  // innerWidth/innerHeight rather than screen.*, because the canvas is sized by
  // the viewport, not the display.
  return Math.max(1, window.innerWidth * window.innerHeight);
}

/**
 * The device's real dpr, capped by the tier's budget. Rounded to 0.05 so an
 * incidental viewport wobble (iOS URL bar) cannot produce a stream of
 * marginally different framebuffer sizes.
 */
function budgetDpr(tier: TierName): number {
  const raw = Math.sqrt(PIXEL_BUDGET[tier] / cssArea());
  return Math.max(1, Math.min(DPR_CEILING, Math.round(raw * 20) / 20));
}

/**
 * The spec a device actually runs, as opposed to the spec the tier names.
 *
 * Stage must use THIS rather than TIER_SPECS directly, and must recompute it
 * whenever the tier changes.
 */
export function resolveTier(name: TierName): TierSpec {
  const base = TIER_SPECS[name];
  // Only ever raise. A machine that is fine today must not lose pixels because
  // the budget arithmetic happened to land a little under its current cap.
  const cap = Math.max(base.dpr[1], budgetDpr(name));
  if (cap <= base.dpr[1]) return base;

  /**
   * REDUCED keeps every instance it has. It runs no bloom pass and its camera
   * only snaps between anchors, so it is nowhere near fill-bound — and it is an
   * accessibility mode, where thinning an already-minimal scene to buy pixels
   * is the wrong trade in both directions.
   */
  if (name === 'REDUCED') return { ...base, dpr: [base.dpr[0], cap] };

  /**
   * Pay for the pixels.
   *
   * The rain is fill-bound — cost is roughly instances x pixels-per-quad — so
   * holding frame time exactly constant would mean dividing the instance count
   * by the full pixel gain (24k -> 9k on a phone), and a rain that thin is a
   * different scene, not a sharper one. Half that, on the exponent, buys most
   * of the headroom while the field still reads as dense; QualityMonitor is the
   * real safety net for whatever is left, and it now demotes into a tier that
   * cuts instances while KEEPING the pixels, which is the right trade — a
   * sparser rain at native resolution looks better than a dense one upscaled.
   */
  const gain = (cap * cap) / (base.dpr[1] * base.dpr[1]);
  return {
    ...base,
    dpr: [base.dpr[0], cap],
    instances: Math.round(base.instances / Math.sqrt(gain)),
  };
}

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
