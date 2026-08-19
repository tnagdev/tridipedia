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

/**
 * Skill/technology marks. Matches the ids in src/data/skills.json.
 *
 * THIS, not `skills[].color`, is what the site actually renders — every mark
 * reads its colour through brandFor(TECH_BRAND, id). A skill whose id is
 * missing here falls back to house green and quietly stops looking like its
 * own brand, so adding a skill means adding a line here too.
 */
export const TECH_BRAND: Record<string, BrandMark> = {
  // Official #3178C6 is a touch dark against the rain; lifted one step.
  typescript: { color: '#4C97E8', glow: '#8FC4FF', label: 'TypeScript' },
  // Node's leaf green disappears into the world's own green, so this is the
  // brighter lime from its wordmark instead.
  node: { color: '#83CD29', glow: '#B6F06A', label: 'Node.js' },
  // Python's two brand colours average to something muddy under bloom; this is
  // the lighter blue of the pair, which keeps the mark from reading as a smudge.
  python: { color: '#4B8BBE', glow: '#8FC7EE', label: 'Python' },
  nestjs: { color: '#E0234E', glow: '#FF6B87', label: 'NestJS' },
  // Elephant blue #336791 is well under the additive floor; lifted.
  postgres: { color: '#6BA6DE', glow: '#A9D2F5', label: 'PostgreSQL' },
  redis: { color: '#FF4438', glow: '#FF9089', label: 'Redis' },
  // Official #FF6600, lifted a little so the mark does not clip to pure orange.
  rabbitmq: { color: '#FF7A2F', glow: '#FFB27A', label: 'RabbitMQ' },
  docker: { color: '#2496ED', glow: '#7CC4FF', label: 'Docker' },
  gcp: { color: '#4285F4', glow: '#8CB4FF', label: 'Google Cloud' },
  react: { color: '#61DAFB', glow: '#A8EBFF', label: 'React' },
  angular: { color: '#DD0031', glow: '#FF4D6D', label: 'Angular' },
  html: { color: '#E34F26', glow: '#FF8A5C', label: 'HTML5' },
  css: { color: '#1572B6', glow: '#4FD1FF', label: 'CSS3' },
  javascript: { color: '#F7DF1E', glow: '#FFF36B', label: 'JavaScript' },
  graphql: { color: '#E10098', glow: '#FF5FC8', label: 'GraphQL' },
  firebase: { color: '#FFCA28', glow: '#FFE38A', label: 'Firebase' },
  // No official mark to borrow: a teal belonging to none of the model vendors,
  // so it reads as the discipline rather than as one provider.
  llm: { color: '#19C39A', glow: '#7CE8CB', label: 'LLM & RAG' },

  /*
   * MONOCHROME MARKS.
   *
   * Next.js, GitHub and Kafka are all black-on-white brands, and their official
   * values (#000000, #181717, #231F20) are the one thing this palette cannot
   * render: the marks are drawn additively, and additive blending has nothing
   * to add for a colour that dark — they came out completely invisible. Each is
   * inverted to the light foreground the brand itself uses on dark surfaces,
   * which is what their own dark-mode logos do.
   */
  nextjs: { color: '#E8F4FF', glow: '#FFFFFF', label: 'Next.js' },
  github: { color: '#E6EDF3', glow: '#FFFFFF', label: 'GitHub' },
  kafka: { color: '#D6DDE3', glow: '#FFFFFF', label: 'Apache Kafka' },

  /* Ids no longer in skills.json, kept because job stacks still name them. */
  next: { color: '#E8F4FF', glow: '#FFFFFF', label: 'Next.js' },
  js: { color: '#F7DF1E', glow: '#fff36b', label: 'JavaScript' },
  git: { color: '#F05032', glow: '#ff8663', label: 'Git' },
  ionic: { color: '#4F8FF8', glow: '#8fbcff', label: 'Ionic' },
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
