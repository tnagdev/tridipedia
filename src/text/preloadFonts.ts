import { preloadFont } from 'troika-three-text';
import { allCharacters } from '@/content/loadContent';

/**
 * Without this, troika rasterises glyphs asynchronously in a worker on first
 * render, so text visibly pops in one section at a time as you scroll. The
 * charset is derived from site.json, so it can never fall out of sync with
 * what is actually rendered.
 */
export function preloadUiFont(): Promise<void> {
  return new Promise((resolve) => {
    try {
      preloadFont({ characters: allCharacters() }, () => resolve());
    } catch {
      resolve();
    }
  });
}
