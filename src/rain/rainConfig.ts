/** Shared geometry constants for the rain. Imported by both CPU and shader setup. */
export const SLOTS = 32; // instances per column; the ring length
export const CELL_H = 0.55; // world-space spacing between glyphs in a column
export const COLUMN_H = SLOTS * CELL_H; // wrap distance — must equal slots * cellH

export const TIERS = {
  ULTRA: { instances: 90_000, slots: 32, bloom: 6, msaa: 4, dpr: [1.0, 2.0] },
  HIGH: { instances: 60_000, slots: 32, bloom: 5, msaa: 4, dpr: [1.0, 1.75] },
  MID: { instances: 24_000, slots: 24, bloom: 3, msaa: 0, dpr: [0.9, 1.35] },
  LOW: { instances: 8_000, slots: 16, bloom: 0, msaa: 0, dpr: [0.75, 1.0] },
  REDUCED: { instances: 2_000, slots: 16, bloom: 0, msaa: 0, dpr: [1.0, 1.0] },
} as const;

export type TierName = keyof typeof TIERS;
