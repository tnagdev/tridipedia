import * as THREE from 'three';
import { svgDataUrl } from './socialMarks';
import { navSvgDataUrl } from './navMarks';
import { MARK_SOURCES } from '@/content/loadContent';

/**
 * A single runtime-built atlas for every logo in the site — technology marks
 * loaded from public/icons/*.svg, and social and navigation marks authored
 * inline in socialMarks.ts and navMarks.ts.
 *
 * Same approach as the glyph atlas: built in-browser at boot, so no binary
 * assets enter the repo and adding a mark is a code change rather than an asset
 * pipeline. One atlas means every logo in a section can be drawn as a single
 * instanced mesh.
 *
 * Marks are rasterised as WHITE SILHOUETTES. Colour is applied per-instance
 * from src/text/brand.ts, which is what lets one atlas serve both the neon
 * brand colouring and the desaturated "awaiting data" placeholder state.
 */

export const MARK_CELL = 256;

export interface MarkAtlas {
  texture: THREE.CanvasTexture;
  cols: number;
  /** mark id -> cell index */
  index: Record<string, number>;
  /** ids that failed to load, so callers can fall back rather than draw nothing */
  missing: string[];
}

/**
 * Fallback filename map, kept for ids the data files do not name.
 *
 * The DATA now decides what a mark looks like: skills.json and social.json each
 * carry an `icon` path under public/, and MARK_SOURCES turns those into URLs.
 * This map is what is left of the old arrangement, where the only way to change
 * a skill's art was to edit code. (The ids differ from the filenames for html
 * and git, which is the sort of thing that belongs in data, not here.)
 */
const TECH_FILE: Record<string, string> = {
  react: 'react',
  angular: 'angular',
  next: 'next',
  js: 'js',
  html: 'html5',
  css: 'css',
  git: 'github',
  ionic: 'ionic',
  firebase: 'firebase',
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // a missing mark must never break a section
    img.src = src;
  });
}

function sourceFor(id: string): string | null {
  // Data first, then the built-ins. A mark named by the content wins, so
  // dropping a file in public/assets and pointing the JSON at it is enough.
  return MARK_SOURCES[id]
    ?? (TECH_FILE[id] ? `/icons/${TECH_FILE[id]}.svg` : null)
    ?? svgDataUrl(id)
    ?? navSvgDataUrl(id);
}

const cache = new Map<string, Promise<MarkAtlas>>();

/**
 * Builds (or returns) an atlas for exactly the ids given. Keyed by the id list,
 * so Skills and Contact can each request their own set and still share work if
 * the sets match.
 */
export function buildMarkAtlas(ids: string[]): Promise<MarkAtlas> {
  const key = ids.join(',');
  const existing = cache.get(key);
  if (existing) return existing;

  const job = (async (): Promise<MarkAtlas> => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
    const size = cols * MARK_CELL;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    const images = await Promise.all(ids.map((id) => {
      const src = sourceFor(id);
      return src ? loadImage(src) : Promise.resolve(null);
    }));

    const index: Record<string, number> = {};
    const missing: string[] = [];

    images.forEach((img, i) => {
      index[ids[i]] = i;
      if (!img) {
        missing.push(ids[i]);
        return;
      }
      const cx = (i % cols) * MARK_CELL;
      const cy = Math.floor(i / cols) * MARK_CELL;
      // Uniform padding so marks of different aspect ratios read as one set.
      const pad = MARK_CELL * 0.15;
      const box = MARK_CELL - pad * 2;
      const iw = img.width || box;
      const ih = img.height || box;
      const scale = Math.min(box / iw, box / ih);
      const w = iw * scale;
      const h = ih * scale;
      ctx.drawImage(img, cx + (MARK_CELL - w) / 2, cy + (MARK_CELL - h) / 2, w, h);
    });

    // Flatten RGB to white, keeping alpha as the silhouette. Source SVGs carry
    // their own brand colours; we deliberately discard them so the shader can
    // apply neon colour (or the placeholder desaturation) per instance.
    const data = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 255;
      data.data[i + 1] = 255;
      data.data[i + 2] = 255;
    }
    ctx.putImageData(data, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    // CanvasTexture defaults to flipY:true, which inverts the atlas ROW index:
    // the mark in canvas row 0 ends up sampled from the last row, so tiles show
    // each other's logos and the odd cell out comes back empty. With flipY off,
    // canvas row 0 maps to v=0 and the cell maths in the shader is correct as
    // written. (The glyph atlas never hit this because DataTexture ignores flipY.)
    texture.flipY = false;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    return { texture, cols, index, missing };
  })();

  cache.set(key, job);
  return job;
}
