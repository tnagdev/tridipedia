import externalLink from 'lucide-static/icons/external-link.svg?raw';
import imageOff from 'lucide-static/icons/image-off.svg?raw';

/**
 * UI icons, from an icon library rather than drawn by hand.
 *
 * socialMarks.ts and navMarks.ts author their SVG inline because those are
 * brand marks and navigation glyphs — a fixed, small set that belongs to this
 * site. Interface icons are not that: they are a vocabulary everyone already
 * reads, and hand-drawing an "opens in a new tab" arrow is how you end up with
 * one that is subtly wrong. These come from lucide-static, which ships plain
 * SVG files and no runtime, so they go through the SAME canvas-atlas path as
 * every other mark and cost nothing extra at runtime.
 *
 * Ids are prefixed `ui-` so they can never collide with a tech, social or nav
 * mark, the same trick navMarkId() uses.
 */

/**
 * lucide draws with strokes and leaves the colour to CSS, which a standalone
 * SVG loaded through `new Image()` has none of. The atlas only keeps ALPHA and
 * flattens colour to white, so any opaque stroke would do — but `currentColor`
 * with no cascade to resolve against is exactly the sort of thing a rasteriser
 * is entitled to treat as transparent, and a mark that silently fails to draw
 * is invisible in the worst way. Pin it.
 */
function whiteStroked(svg: string): string {
  return svg.replace(/currentColor/g, '#fff');
}

export const ICON_SVG: Record<string, string> = {
  'ui-external': whiteStroked(externalLink),
  'ui-noimage': whiteStroked(imageOff),
};

/** Data URL for a UI icon, ready for `new Image().src`. No network access. */
export function iconSvgDataUrl(id: string): string | null {
  const svg = ICON_SVG[id];
  if (!svg) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
