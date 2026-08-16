import { buildGlyphAtlas } from '@/rain/glyphAtlas';
import { preloadUiFont } from '@/text/preloadFonts';
import { detectTier, type TierName } from '@/perf/tier';
import { profile } from '@/content/loadContent';

export interface BootResult {
  tier: TierName;
  avatarSrc: string | null;
}

function setProgress(pct: number, msg?: string) {
  const el = document.getElementById('loader-pct');
  if (el) {
    const filled = Math.round((pct / 100) * 10);
    el.textContent = `[${'█'.repeat(filled)}${' '.repeat(10 - filled)}] ${String(Math.round(pct)).padStart(2, '0')}%`;
  }
  if (msg) {
    const m = document.querySelector('#loader .msg');
    if (m) m.textContent = msg;
  }
}

/** Resolves to the URL if the image exists, or null — so a missing avatar degrades silently. */
function probeImage(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function boot(): Promise<BootResult> {
  setProgress(4, 'DETECTING HARDWARE');
  const tierPromise = detectTier();

  setProgress(18, 'BAKING GLYPH ATLAS');
  // Yield first so the loader actually paints before this ~65ms of canvas work.
  await new Promise((r) => setTimeout(r, 0));
  buildGlyphAtlas();

  setProgress(48, 'PRELOADING TYPEFACE');
  await preloadUiFont();

  setProgress(74, 'RESOLVING ASSETS');
  const avatarSrc = await probeImage(profile.avatar);

  setProgress(88, 'COMPILING SHADERS');
  const tier = await tierPromise;

  return { tier, avatarSrc };
}

export function finishLoader() {
  setProgress(100, 'READY');
  const el = document.getElementById('loader');
  if (!el) return;
  el.classList.add('done');
  setTimeout(() => el.remove(), 500);
}
