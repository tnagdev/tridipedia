import { SECTIONS } from '@/state/sections';

/**
 * The navigation's geometry, in one place.
 *
 * These live outside Nav3D because the SECTIONS have to lay out around the nav,
 * and until now they did it by guessing: ContactSection reserved a gutter of
 * "roughly 96 CSS pixels" with a comment admitting it was a guess, and nothing
 * connected that number to the rail it was dodging. Change one, the other drifts
 * silently. One module, imported by both, and they cannot.
 *
 * All lengths are world units at the nav's own plane (NAV_Z), which is where
 * Nav3D draws; the frustum half-extents at that plane convert them to fractions
 * of the frame, and a fraction is the only thing a section at some other depth
 * can actually use.
 */

/* --------------------------- shared, both modes --------------------------- */

/** Just inside the near plane. */
export const NAV_Z = -1.05;
/** Distance from the edge of frame the nav pins itself to. */
export const MARGIN = 0.034;

/**
 * The fov the nav's authored size is calibrated to, and the frustum half-height
 * that follows. Everything is measured against this so the nav keeps one size on
 * screen whatever the camera's fov is doing; 66 is the middle of the journey's
 * 54..78 range.
 */
export const REF_FOV = 66;
export const REF_HALF_H = Math.tan((REF_FOV * Math.PI) / 360) * Math.abs(NAV_Z);

export const N = SECTIONS.length;
/** Row to row (landscape) — and column to column (portrait). */
export const PITCH = 0.106;
/** The long axis of the housing: six pitches plus its end caps. */
export const PLATE_H = N * PITCH + 0.076;
/** A hair of padding around the panel so its antialiased edge has room. */
export const PAD = 0.008;
export const QUAD_H = PLATE_H + PAD * 2;

/* ------------------------------- portrait -------------------------------- */
/*
 * On a phone the rail becomes a bar across the TOP. The long axis is unchanged
 * — it is still six pitches — so PLATE_H is reused as the bar's LENGTH and only
 * a depth is new. Nothing here has any effect in landscape.
 */

/** How deep the bar hangs from the top edge. ~6% of frame height. */
export const BAR_D = 0.104;
/** The bar's length is the row axis, turned on its side. */
export const BAR_LEN = PLATE_H;
/** Fraction of the frame's width the bar is allowed to span. */
export const BAR_FILL = 0.94;
/**
 * And the most of the frame's height it may ever eat. This is what stops the
 * bar from becoming a slab on a tablet, where the frame is far less narrow and
 * spanning the width would mean a 12%-tall nav.
 */
export const BAR_DEPTH_FRAC = 0.085;
/** Bigger than the landscape ICON (0.044): a tap target, not a pointer target. */
export const ICON_P = 0.056;
/**
 * How far the tap column reaches BELOW the bar's bottom edge.
 *
 * There is no caption under the portrait bar — the filled tab and its
 * knocked-out icon say which section is live, and a word repeating that was one
 * more thing between the reader and the world. The overhang stays because it is
 * what takes each column past a 44px target on the short axis.
 */
export const LABEL_DROP = 0.040;

/**
 * The bar's scale, given the frustum at its own plane.
 *
 * Shared with Nav3D rather than reimplemented, because navReserve() below has to
 * predict exactly where the bar's bottom edge lands and a second copy of this
 * expression would be a second thing to keep in sync.
 */
export function portraitNavFit(halfW: number, halfH: number): number {
  // Both terms are proportional to a frustum half-extent, and the half-extent
  // cancels when you convert back to pixels — so each one is a CONSTANT
  // fraction of the frame at every fov in the journey's 54..78 range. The bar
  // does not breathe as the camera does, which is the property the landscape
  // rail needs a whole separate scaling term to get.
  const byWidth = (2 * halfW * BAR_FILL) / BAR_LEN;
  const byDepth = (2 * halfH * BAR_DEPTH_FRAC) / (BAR_D + PAD * 2);
  return Math.min(byWidth, byDepth);
}

/* ------------------------------ the reserve ------------------------------ */

/**
 * The nav's footprint, as FRACTIONS of the full frame — `left` of its width,
 * `top` of its height. A section anywhere in the world can multiply these by its
 * own frustum and get the gutter in its own units.
 *
 * The landscape branch is the number ContactSection already used, moved here
 * verbatim: the rail is camera-locked chrome about 96 CSS pixels wide down the
 * left edge at every viewport size, so as a fraction of the frame it GROWS as
 * the frame narrows.
 */
export function navReserve(o: {
  portrait: boolean;
  /** Canvas width in CSS pixels — the landscape branch is authored in those. */
  sizeW: number;
  /** Frustum half-extents at the nav's own plane. Portrait only. */
  halfW?: number;
  halfH?: number;
  safeTopWorld?: number;
}): { left: number; top: number } {
  if (!o.portrait) return { left: 96 / Math.max(1, o.sizeW), top: 0 };

  const halfW = o.halfW ?? 0;
  const halfH = o.halfH ?? 0;
  const safeTopWorld = o.safeTopWorld ?? 0;
  const fit = portraitNavFit(halfW, halfH);
  // margin + the full depth of the housing + the tap columns' overhang, which is
  // reserved because a section drawn under it would take taps meant for the nav.
  const depth = safeTopWorld + (MARGIN + BAR_D + PAD * 2 + LABEL_DROP * 2) * fit;
  return { left: 0, top: depth / Math.max(1e-6, 2 * halfH) };
}
