/**
 * Neon brand palette.
 *
 * The world is Matrix green. These are the accents allowed to break it —
 * technology marks and social marks rendered in their own colours so they read
 * as *real* logos embedded in the world rather than green silhouettes.
 *
 * Values are the official brand colours, lifted toward neon where the official
 * value is too dark to survive additive blending against a near-black
 * background (noted per entry). Additive blending means a colour darker than
 * roughly #333 contributes almost nothing and reads as absent.
 */

export interface BrandMark {
  /** Core colour of the mark itself. */
  color: string;
  /** Halo/outline colour — usually a lifted version of `color`. */
  glow: string;
  label: string;
}

/** Skill/technology marks. Matches the ids in site.json skills[]. */
export const TECH_BRAND: Record<string, BrandMark> = {
  react: { color: '#61DBFB', glow: '#9beeff', label: 'React' },
  angular: { color: '#DD0031', glow: '#ff4d6d', label: 'Angular' },
  // Next.js is monochrome; pure white blooms to a featureless blob, so it is
  // pulled very slightly cool to keep the wordmark legible under bloom.
  next: { color: '#E8F4FF', glow: '#ffffff', label: 'Next.js' },
  js: { color: '#F7DF1E', glow: '#fff36b', label: 'JavaScript' },
  html: { color: '#E34F26', glow: '#ff8a5c', label: 'HTML5' },
  css: { color: '#1572B6', glow: '#4FD1FF', label: 'CSS3' },
  git: { color: '#F05032', glow: '#ff8663', label: 'Git' },
  ionic: { color: '#4F8FF8', glow: '#8fbcff', label: 'Ionic' },
  firebase: { color: '#FFC107', glow: '#ffdd6b', label: 'Firebase' },
};

/** Social marks. Matches the ids in site.json socials[]. */
export const SOCIAL_BRAND: Record<string, BrandMark> = {
  // GitHub's mark is near-black on light backgrounds; inverted to its
  // dark-mode foreground, which is what it uses on dark surfaces anyway.
  github: { color: '#E6EDF3', glow: '#ffffff', label: 'GitHub' },
  // Official LinkedIn blue (#0A66C2) is too dark for additive blending —
  // lifted to its hover/active tint so the mark actually shows.
  linkedin: { color: '#3D9BE9', glow: '#8CCBFF', label: 'LinkedIn' },
  x: { color: '#E7E9EA', glow: '#ffffff', label: 'X' },
  // YouTube red (#FF0000) has no headroom left under additive blending and
  // blooms into a featureless blob; lifted and desaturated a touch so the
  // play triangle keeps its shape.
  youtube: { color: '#FF2D2D', glow: '#ff8a8a', label: 'YouTube' },
  // Fallbacks so an unlisted social still renders rather than disappearing.
  mail: { color: '#7dffa8', glow: '#d8ffe4', label: 'Email' },
};

/** Never returns undefined: an unknown id falls back to the house green. */
export function brandFor(map: Record<string, BrandMark>, id: string): BrandMark {
  return map[id] ?? { color: '#00d93f', glow: '#d8ffe4', label: id };
}

/** Desaturated state for placeholder entries, so "awaiting data" looks deliberate. */
export const PLACEHOLDER_MARK: BrandMark = {
  color: '#2f7a48',
  glow: '#55d97c',
  label: 'awaiting data',
};
