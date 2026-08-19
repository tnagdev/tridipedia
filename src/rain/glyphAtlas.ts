import * as THREE from 'three';

/**
 * The rain's glyph atlas.
 *
 * Single-channel (R8) alpha atlas, generated in-browser at boot rather than
 * baked to a PNG and committed. It costs ~40-80ms once, and in exchange the
 * site ships zero binary glyph assets and the charset stays editable in code.
 *
 * NOT MSDF: rain glyphs are 6-30px on screen under additive blending and
 * bloom, where MSDF's crispness is invisible but its per-fragment cost
 * (3 channels + median3 + fwidth) is paid on every one of tens of thousands
 * of overlapping quads. The rain is fill-rate bound, so fragment cost is
 * precisely the budget we cannot spend. Readable copy uses troika's own SDF
 * pipeline instead.
 */

export const ATLAS_SIZE = 2048;
export const ATLAS_COLS = 16; // 16x16 = 256 cells
export const CELL_PX = ATLAS_SIZE / ATLAS_COLS; // 128
const FONT_PX = 92; // leaves ~18px of padding per side

/** Half-width katakana + digits + latin caps + terminal punctuation. */
export const GLYPHS: string[] = [
  ...'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
  ...'0123456789',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'<>|=+-*:.',
];

export const GLYPH_COUNT = GLYPHS.length;

/** Index of a character in the atlas, or -1. Used for the Skills glyph-lock. */
const INDEX = new Map<string, number>();
GLYPHS.forEach((g, i) => INDEX.set(g, i));
export function glyphIndexOf(ch: string): number {
  return INDEX.get(ch.toUpperCase()) ?? -1;
}

/**
 * Luminance ramp, darkest -> densest, used by the ASCII-image shader to map
 * image brightness onto glyph cells.
 *
 * MEASURED, not hand-authored: ink coverage depends on which font the OS
 * actually resolved, so a hardcoded ordering is only correct on the machine it
 * was guessed on. buildGlyphAtlas() fills this from real pixel coverage, which
 * makes the ASCII portrait render correctly regardless of font fallback.
 */
const RAMP_CANDIDATES = '.:-=+*|<>OWM';
export const RAMP: number[] = RAMP_CANDIDATES.split('').map((c) => Math.max(0, glyphIndexOf(c)));

let cached: THREE.DataTexture | null = null;

export function buildGlyphAtlas(): THREE.DataTexture {
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  // The halo is baked into the alpha, which means the LOW tier gets a
  // convincing phosphor glow with bloom switched off entirely. Free quality floor.
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 9;
  ctx.font = `700 ${FONT_PX}px "MS Gothic", "Yu Gothic", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Segoe UI", monospace`;

  for (let i = 0; i < GLYPH_COUNT; i++) {
    const cx = (i % ATLAS_COLS) * CELL_PX + CELL_PX / 2;
    const cy = Math.floor(i / ATLAS_COLS) * CELL_PX + CELL_PX / 2;
    ctx.fillText(GLYPHS[i], cx, cy);
  }

  // Collapse RGBA -> R8. 2048^2 RGBA would be 16MB on the GPU; R8 is 4MB.
  const rgba = ctx.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE).data;
  const red = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE);
  for (let i = 0, n = red.length; i < n; i++) red[i] = rgba[i * 4];

  // Order the ASCII ramp by actual measured ink coverage.
  {
    const coverage = new Map<number, number>();
    for (const idx of RAMP) {
      const ox = (idx % ATLAS_COLS) * CELL_PX;
      const oy = Math.floor(idx / ATLAS_COLS) * CELL_PX;
      let ink = 0;
      for (let y = 0; y < CELL_PX; y += 2) {
        for (let x = 0; x < CELL_PX; x += 2) ink += red[(oy + y) * ATLAS_SIZE + ox + x];
      }
      coverage.set(idx, ink);
    }
    RAMP.sort((a, b) => (coverage.get(a) ?? 0) - (coverage.get(b) ?? 0));
  }

  const tex = new THREE.DataTexture(red, ATLAS_SIZE, ATLAS_SIZE, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  // Mipmaps matter: without them the far field aliases into sparkle.
  // The ~18px of dead space per cell is what stops mip 3+ bleeding
  // neighbouring glyphs into each other and turning the far field to grey mush.
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 1;
  tex.needsUpdate = true;

  cached = tex;
  return tex;
}
