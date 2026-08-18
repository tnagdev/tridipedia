import * as THREE from 'three';

/**
 * The frame sprite sheet.
 *
 * Every container in the HUD is drawn from ONE texture using nine-slice
 * scaling: the four corners keep their authored size whatever the frame is
 * scaled to, the four edges STRETCH along their run, and the middle is empty.
 * That is what lets a 0.08-unit tab and a 0.7-unit panel share a single sprite
 * and a single draw path, and it is why the corner detail never smears when a
 * frame is resized — which is exactly what happens when you stretch a quad.
 *
 * Built in-browser at boot, like the glyph and mark atlases: no binary assets
 * enter the repo, and editing the frame art is a code change rather than an
 * asset pipeline. Drawn as WHITE silhouettes; colour and intensity are applied
 * per instance in the shader, so one sheet serves the idle, hovered and live
 * states of everything.
 *
 * Layout — variants across, slices within:
 *
 *     variant 0            variant 1
 *   ┌────┬────┬────┐     ┌────┬────┬────┐
 *   │ TL │ T  │ TR │     │ TL │ T  │ TR │   row 0 = the frame's TOP
 *   ├────┼────┼────┤     ├────┼────┼────┤
 *   │ L  │ ·  │ R  │     │ L  │ ·  │ R  │
 *   ├────┼────┼────┤     ├────┼────┼────┤
 *   │ BL │ B  │ BR │     │ BL │ B  │ BR │
 *   └────┴────┴────┘     └────┴────┴────┘
 */

export const FRAME_CELL = 64;

export type FrameVariant = 'hud' | 'tab';
/**
 * Order here IS the order in the sheet. Appending is safe: every uv is derived
 * from `cols`, so a new variant leaves the existing ones bit-identical.
 */
export const FRAME_VARIANTS: FrameVariant[] = ['hud', 'tab'];

export interface FrameAtlas {
  texture: THREE.CanvasTexture;
  /** uv width of one cell — a third of one variant's block. */
  cellU: number;
  /** uv height of one cell — always a third, since every variant is one row of blocks. */
  cellV: number;
  /** One texel of the sheet in uv — used to keep sampling inside a cell. */
  texelU: number;
  texelV: number;
  /** uv x of a variant's first cell. */
  originU: (v: FrameVariant) => number;
}

/**
 * A variant, described the way the slicer wants it: where it lives in the sheet
 * and where its four slice lines fall. Same shape an authored image reports, so
 * the shader has one code path for both.
 */
export interface FrameEntry {
  /** u0, v0, u1, v1 in uv. */
  rect: [number, number, number, number];
  /** uv inset of each slice line from its own edge: top, right, bottom, left. */
  slice: [number, number, number, number];
}

export function frameEntry(v: FrameVariant): FrameEntry {
  const a = buildFrameAtlas();
  const u0 = a.originU(v);
  // The generated variants are three equal cells each way, so the slice lines
  // sit exactly one cell in from every edge.
  return {
    rect: [u0, 0, u0 + 3 * a.cellU, 1],
    slice: [a.cellV, a.cellU, a.cellV, a.cellU],
  };
}

/* --------------------------- the frame drawings --------------------------- */

const C = FRAME_CELL;

function stroke(ctx: CanvasRenderingContext2D, w: number) {
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = w;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

/**
 * Cells are drawn in their own space, origin at the cell's top-left, and the
 * other three corners are the same drawing mirrored — so a frame can never come
 * out subtly asymmetric the way four hand-placed corners do.
 */
function mirrored(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  flipX: boolean,
  flipY: boolean,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  ctx.save();
  ctx.translate(cx + (flipX ? C : 0), cy + (flipY ? C : 0));
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  draw(ctx);
  ctx.restore();
}

/**
 * 'hud': a mitred corner drawn as a DOUBLE bracket — one line turning the full
 * corner, a shorter one inside it turning the same mitre.
 *
 * All the character lives in the corners and none of it in the edges. The
 * middle of an edge is STRETCHED, so any mark inside one arrives as a single
 * shape smeared the length of the run. Corners are drawn once each and map to a
 * fixed world size, so detail there stays detail.
 */
function hudCorner(ctx: CanvasRenderingContext2D) {
  stroke(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(C, 6);
  ctx.lineTo(21, 6);
  ctx.lineTo(6, 21);
  ctx.lineTo(6, C);
  ctx.stroke();

  stroke(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(44, 14);
  ctx.lineTo(26, 14);
  ctx.lineTo(14, 26);
  ctx.lineTo(14, 44);
  ctx.stroke();
}

/** 'hud' edges: the line, and nothing else. */
function hudEdgeTop(ctx: CanvasRenderingContext2D) {
  stroke(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(C, 6);
  ctx.stroke();
}

function hudEdgeLeft(ctx: CanvasRenderingContext2D) {
  stroke(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(6, C);
  ctx.stroke();
}

/**
 * 'tab': corner brackets only, with no edges at all.
 *
 * A row does not need a closed box around it — four brackets say the same thing
 * with a quarter of the ink, and they stop the strip reading as boxes nested
 * inside boxes.
 */
function tabCorner(ctx: CanvasRenderingContext2D) {
  stroke(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(34, 5);
  ctx.lineTo(5, 5);
  ctx.lineTo(5, 34);
  ctx.stroke();
}

/** The tab's top-right bracket carries the mitre — the sheet's one asymmetry. */
function tabCornerCut(ctx: CanvasRenderingContext2D) {
  stroke(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(30, 5);
  ctx.lineTo(49, 5);
  ctx.lineTo(59, 15);
  ctx.lineTo(59, 34);
  ctx.stroke();
}

/** Draws one variant's 3x3 block at (x0, 0). */
function drawVariant(ctx: CanvasRenderingContext2D, variant: FrameVariant, x0: number) {
  const at = (col: number, row: number) => [x0 + col * C, row * C] as const;

  if (variant === 'hud') {
    let [x, y] = at(0, 0); mirrored(ctx, x, y, false, false, hudCorner);
    [x, y] = at(2, 0); mirrored(ctx, x, y, true, false, hudCorner);
    [x, y] = at(0, 2); mirrored(ctx, x, y, false, true, hudCorner);
    [x, y] = at(2, 2); mirrored(ctx, x, y, true, true, hudCorner);

    [x, y] = at(1, 0); mirrored(ctx, x, y, false, false, hudEdgeTop);
    [x, y] = at(1, 2); mirrored(ctx, x, y, false, true, hudEdgeTop);
    [x, y] = at(0, 1); mirrored(ctx, x, y, false, false, hudEdgeLeft);
    [x, y] = at(2, 1); mirrored(ctx, x, y, true, false, hudEdgeLeft);
    return;
  }

  let [x, y] = at(0, 0); mirrored(ctx, x, y, false, false, tabCorner);
  [x, y] = at(2, 0); mirrored(ctx, x, y, false, false, tabCornerCut);
  [x, y] = at(0, 2); mirrored(ctx, x, y, false, true, tabCorner);
  [x, y] = at(2, 2); mirrored(ctx, x, y, true, true, tabCorner);
  // no edge cells: this variant is brackets only
}

/* ------------------------------- the sheet -------------------------------- */

let cached: FrameAtlas | null = null;

export function buildFrameAtlas(): FrameAtlas {
  if (cached) return cached;

  const cols = FRAME_VARIANTS.length * 3;
  const canvas = document.createElement('canvas');
  canvas.width = cols * C;
  canvas.height = 3 * C;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  FRAME_VARIANTS.forEach((v, i) => drawVariant(ctx, v, i * 3 * C));

  const texture = new THREE.CanvasTexture(canvas);
  // flipY off, so canvas row 0 is v=0 and the sheet's TOP row of slices is the
  // frame's top row — the shader measures its position from the top to match.
  // (Same trap the mark atlas documents: with flipY on, every row is inverted.)
  texture.flipY = false;
  // NO mipmaps. The edge slices are sampled through a fract(), and at every
  // repeat seam the uv derivative jumps the width of a cell — the GPU reads that
  // as an enormous minification and drops to a mip level that is an average of
  // the whole sheet, printing a bright line across the frame at each seam.
  // Linear filtering with no mip chain costs a little aliasing when the panel is
  // small on screen, and removes the seams entirely.
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  const cellU = 1 / cols;
  cached = {
    texture,
    cellU,
    cellV: 1 / 3,
    texelU: 1 / canvas.width,
    texelV: 1 / canvas.height,
    originU: (v: FrameVariant) => FRAME_VARIANTS.indexOf(v) * 3 * cellU,
  };
  return cached;
}
