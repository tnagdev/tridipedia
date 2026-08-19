export type Hex = string;
export type Vec3 = [number, number, number];
export type SectionId = 'hero' | 'about' | 'skills' | 'experience' | 'projects' | 'contact';
export type EaseName = 'linear' | 'inOutCubic' | 'inOutQuint' | 'outExpo';

export interface Profile {
  brand: string;
  tagline: string;
  name: string;
  /** Print name for the About card, e.g. "Tridibesh Nag". Falls back to `name`. */
  fullName: string | null;
  /** Job designation, e.g. "Technical Lead". Rendered uppercase on the card. */
  designation: string | null;
  /** Discipline line under the designation, e.g. "Frontend & Creative Engineer". */
  title: string | null;
  /** Profile handle, WITH the leading "@". Rendered by the About section. */
  handle: string;
  /** Rotator words, WITHOUT the trailing "Developer". */
  roles: string[];
  /** Years of experience is DERIVED from this, never stored. */
  codingSince: number;
  location: string;
  bio: string;
  avatar: string;
}

export interface Skill {
  id: string;
  name: string;
  proficiency: number;
  years: number;
  color: Hex;
  /** One line on what the technology IS. Shown on the skill podium's panel. */
  blurb: string;
  /** The technology's own home page, opened from the panel. */
  url: string;
  /**
   * A personal line about working with it. Null falls back to a line derived
   * from `years` and `proficiency`, so the panel is never empty.
   */
  note: string | null;
  /**
   * Path under public/ for this skill's mark. Null falls back to the built-in
   * icon set. This is what lets the data file, rather than a map in the code,
   * decide what a skill looks like.
   */
  icon: string | null;
}

export interface Job {
  id: string;
  company: string;
  role: string;
  location: string;
  /** ISO. The originals were malformed (new Date('31-08-2024') is Invalid Date). */
  start: string;
  /** null means present. */
  end: string | null;
  /** Path under public/ for the company mark. */
  logo: string | null;
  /** The company's own site. */
  url: string | null;
  /** Stack used in this role, rendered as chips in the popup. */
  tech: string[];
  /**
   * One short line for the About card's current-role tile, and the ONLY place
   * it renders — the Experience section and the text mirror both tell the
   * story from `story` instead.
   *
   * Keep it to about 140 characters. The tile is small and gives this four
   * lines at 0.19; anything longer runs off the bottom of the card.
   */
  blurb: string | null;
  /**
   * The ONLY prose a job carries, and the one both modes render.
   *
   * There used to be three overlapping fields here — `summary` for the popup,
   * `highlights` for the DOM, `story` for the card — which meant the 3D world
   * and the text mirror described the same job in different words, and the
   * bullet list existed nowhere in 3D at all. One narrative, rendered
   * everywhere, cannot drift from itself.
   *
   * Prose ONLY. Dates, durations, role titles and the stack render from the
   * structured fields above, so the copy cannot contradict them.
   */
  story: string[];
}

export interface Project {
  id: string;
  title: string;
  /** One line, for the card face. */
  summary: string;
  /** The long version — what it was, what it cost, what you learned. */
  details: string;
  tech: string[];
  /** What you did on it. */
  role: string | null;
  year: string | null;
  /** Path under public/, e.g. "/assets/projects/foo.svg". Resolved by assetUrl(). */
  thumbnail: string | null;
  /** Live site. */
  url: string | null;
  /** Source. */
  repo: string | null;
  /** true => render the empty-frame treatment rather than a broken card. */
  placeholder: boolean;
}

export interface Social {
  id: string;
  label: string;
  handle: string;
  url: string | null;
  /** Path under public/ for the mark. Null falls back to the built-in set. */
  icon: string | null;
  placeholder: boolean;
}

/* ---------- scene config ---------- */

export interface RainConfig {
  speed: number;
  density: number;
  glyphSize: number;
  intensity: number;
  flowDir: Vec3;
  tint: number;
  lock: number;
  open: number;
  converge: number;
  billboardLock: number;
  /** World point the Contact funnel gathers toward. */
  convergePoint: Vec3;
  tailColor: Hex;
  headColor: Hex;
}

export interface CameraKeyframe {
  t: number;
  pos: Vec3;
  look: Vec3;
  fov?: number;
  roll?: number;
  ease?: EaseName;
}

export interface SectionConfig {
  id: SectionId;
  label: string;
  /** Scroll range [start, end] in 0..1. */
  range: [number, number];
  rain: Partial<RainConfig>;
  /** Spheres the rain parts around, so copy stays readable. xyz + radius. */
  textZones?: [number, number, number, number][];
}

export interface Journey {
  scrollHeightVh: number;
  damping: number;
  lookAhead: number;
  curveTension: number;
  keyframes: CameraKeyframe[];
}

export interface SiteMeta {
  url: string;
  title: string;
  description: string;
  ogImage: string;
}

export interface SiteContent {
  meta: SiteMeta;
  profile: Profile;
  email: string | null;
  /**
   * Display form, e.g. "+91 98765 43210". Root-level beside `email` rather than
   * on `profile`, because the two are only ever read as a pair.
   */
  phone: string | null;
  skills: Skill[];
  experience: Job[];
  projects: Project[];
  socials: Social[];
  rainDefaults: RainConfig;
  journey: Journey;
  sections: SectionConfig[];
}
