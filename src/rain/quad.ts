/**
 * The unit quad every glyph instance is drawn on. Shared by the mesh and the
 * bench so the two can never disagree about winding or UV orientation.
 *
 * The V coordinate is INVERTED on purpose. The atlas is built with canvas 2D,
 * where row 0 is the top, and uploaded to a DataTexture in that same order —
 * so texture v=0 is the top of the cell. GL's +y is up, so mapping world-up to
 * increasing v would sample the cell bottom-first and render every glyph
 * upside down. Flipping V here fixes it once, for both consumers.
 */
export const QUAD_POSITIONS = new Float32Array([
  -0.5, -0.5, 0,  0.5, -0.5, 0,  0.5, 0.5, 0,
  -0.5, -0.5, 0,  0.5,  0.5, 0, -0.5, 0.5, 0,
]);

export const QUAD_UVS = new Float32Array([
  0, 1,  1, 1,  1, 0,
  0, 1,  1, 0,  0, 0,
]);

export const QUAD_VERTS = 6;
