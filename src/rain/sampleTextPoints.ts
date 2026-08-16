import * as THREE from 'three';

/**
 * Rasterises a word to an offscreen canvas and reservoir-samples its opaque
 * pixels into world-space points. These become the targets the falling glyphs
 * condense into, so the brand name is literally made of rain.
 */
export function sampleTextPoints(
  text: string,
  count: number,
  opts: { width?: number; height?: number; worldWidth?: number; font?: string } = {},
): Float32Array {
  const W = opts.width ?? 1024;
  const H = opts.height ?? 180;
  const worldWidth = opts.worldWidth ?? 16;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shrink to fit rather than overflow — long brands must not clip.
  let size = Math.floor(H * 0.72);
  ctx.font = `700 ${size}px ui-monospace, "Cascadia Mono", "Courier New", monospace`;
  while (ctx.measureText(text).width > W * 0.92 && size > 8) {
    size -= 4;
    ctx.font = `700 ${size}px ui-monospace, "Cascadia Mono", "Courier New", monospace`;
  }
  ctx.fillText(text, W / 2, H / 2);

  const data = ctx.getImageData(0, 0, W, H).data;

  // Collect opaque pixels, then take an even stride through them. An even
  // stride beats random sampling here: random leaves visible clumps and holes
  // in the letterforms at only a few thousand points.
  const hits: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4] > 128) hits.push(y * W + x);
    }
  }

  const out = new Float32Array(count * 3);
  if (hits.length === 0) return out;

  const scale = worldWidth / W;
  const worldHeight = H * scale;
  const stride = hits.length / count;

  for (let i = 0; i < count; i++) {
    const h = hits[Math.min(hits.length - 1, Math.floor(i * stride))];
    const x = h % W;
    const y = Math.floor(h / W);
    // Jitter within the pixel so the cloud does not read as a pixel grid.
    out[i * 3 + 0] = (x + Math.random()) * scale - worldWidth / 2;
    out[i * 3 + 1] = worldHeight / 2 - (y + Math.random()) * scale;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
  }
  return out;
}

export function toVector3Array(flat: Float32Array): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < flat.length; i += 3) out.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
  return out;
}
