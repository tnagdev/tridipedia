export type Hex = string;
export type Vec3 = [number, number, number];
export type SectionId = 'hero' | 'about' | 'skills' | 'experience' | 'projects' | 'contact';
export type EaseName = 'linear' | 'inOutCubic' | 'inOutQuint' | 'outExpo';

export interface Profile {
  brand: string;
  tagline: string;
  name: string;
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
  highlights: string[];
  /** Career-phase label for this role, e.g. "MOBILE MANIA". */
  phase: string;
  /** One-paragraph description shown in the card's detail popup. */
  summary: string;
  /** Stack used in this role, rendered as chips in the popup. */
  tech: string[];
  /**
   * The engineer's-log narrative, in the voice of a system recalling its own
   * past. Prose ONLY — dates, durations and role titles render from the
   * structured fields above, so the copy cannot drift out of sync with them.
   */
  story: string[];
}

/**
 * Narrative, deliberately DECOUPLED from Job. The old CareerTV.tsx dated these
 * differently from the resume; phases are story, jobs are fact, and forcing
 * them into one array would bake the contradiction in permanently.
 */
export interface CareerPhase {
  id: string;
  title: string;
  subtitle: string;
  yearsLabel: string;
  blurb: string;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  tech: string[];
  url: string | null;
  repo: string | null;
  /** true => render the empty-frame treatment rather than a broken card. */
  placeholder: boolean;
}

export interface Social {
  id: string;
  label: string;
  handle: string;
  url: string | null;
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
  skills: Skill[];
  experience: Job[];
  phases: CareerPhase[];
  projects: Project[];
  socials: Social[];
  rainDefaults: RainConfig;
  journey: Journey;
  sections: SectionConfig[];
}
