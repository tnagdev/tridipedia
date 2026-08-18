import site from '@/data/site.json';
import skillsData from '@/data/skills.json';
import experienceData from '@/data/experience.json';
import projectsData from '@/data/projects.json';
import socialData from '@/data/social.json';
import type {
  CareerPhase, Job, Project, RainConfig, SectionConfig, SectionId, SiteContent, Skill, Social,
} from './content.types';

/**
 * The site's content, assembled from src/data/.
 *
 * One file per KIND of thing rather than one file for everything: site.json is
 * the site itself (who, where, how the camera flies), and each list of things
 * gets its own file. That way editing a project cannot put a syntax error
 * through the camera keyframes, and the files stay small enough to actually
 * read.
 *
 * There is deliberately no runtime validation — the shape is enforced at build
 * time by tsc against content.types.ts, and every consumer of a nullable field
 * falls back rather than throwing. A missing field shows an empty state; it
 * never takes the site down.
 */
type SiteFile = Omit<SiteContent, 'skills' | 'experience' | 'phases' | 'projects' | 'socials'>;

export const content: SiteContent = {
  ...(site as unknown as SiteFile),
  skills: (skillsData as unknown as { skills: Skill[] }).skills,
  experience: (experienceData as unknown as { experience: Job[] }).experience,
  phases: (experienceData as unknown as { phases: CareerPhase[] }).phases,
  projects: (projectsData as unknown as { projects: Project[] }).projects,
  socials: (socialData as unknown as { socials: Social[] }).socials,
};

export const { profile, skills, experience, phases, projects, socials, meta, journey } = content;

/**
 * Resolves an image path from a data file against the app's base URL.
 *
 * Data files store paths as they appear under public/ ("/assets/skills/js.svg"),
 * because that is what a person editing JSON can reason about. Vite can be built
 * under a sub-path, in which case those need the base prefix — and an absolute
 * http(s) URL has to pass through untouched.
 */
export function assetUrl(p: string | null | undefined): string | null {
  if (!p) return null;
  if (/^(https?:)?\/\//.test(p) || p.startsWith('data:')) return p;
  return `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;
}

/**
 * id -> image URL for every mark the data files name, so the atlas takes its
 * art from the content rather than from a filename map in the code.
 */
export const MARK_SOURCES: Record<string, string> = {};
for (const s of skills) if (s.icon) MARK_SOURCES[s.id] = assetUrl(s.icon)!;
for (const s of socials) if (s.icon) MARK_SOURCES[s.id] = assetUrl(s.icon)!;


/** Years of experience is derived, never stored — so it can never go stale. */
export const yearsOfExperience = new Date().getFullYear() - profile.codingSince;

export const SECTION_IDS = content.sections.map((s) => s.id);

const BY_ID = new Map<SectionId, SectionConfig>(content.sections.map((s) => [s.id, s]));
export function getSection(id: SectionId): SectionConfig {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown section: ${id}`);
  return s;
}

/** Full rain config for a section: defaults merged with that section's overrides. */
export function rainConfigFor(id: SectionId): RainConfig {
  return { ...content.rainDefaults, ...getSection(id).rain };
}

export function sectionIndexAt(t: number): number {
  const list = content.sections;
  for (let i = 0; i < list.length; i++) {
    const [a, b] = list[i].range;
    if (t >= a && t < b) return i;
  }
  return list.length - 1;
}

/* ---------- date helpers: the source data was malformed, so normalise once ---------- */

export function jobStart(j: Job): Date {
  return new Date(j.start);
}
export function jobEnd(j: Job): Date {
  return j.end ? new Date(j.end) : new Date();
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function jobRangeLabel(j: Job): string {
  return `${formatMonthYear(jobStart(j))} — ${j.end ? formatMonthYear(jobEnd(j)) : 'Present'}`;
}

export function jobDurationLabel(j: Job): string {
  const months = Math.max(
    1,
    Math.round((jobEnd(j).getTime() - jobStart(j).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
  );
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr${y > 1 ? 's' : ''}`;
  return `${y} yr${y > 1 ? 's' : ''} ${m} mo`;
}

/**
 * Every character that will ever be rendered by troika, so the font atlas can
 * be preloaded in one pass. Without this, troika rasterises glyphs
 * asynchronously on first render and text visibly pops in section by section.
 */
export function allCharacters(): string {
  const parts: string[] = [
    profile.brand, profile.tagline, profile.name, profile.bio, profile.location,
    ...profile.roles,
    ...skills.flatMap((s) => [
      s.name, `${s.proficiency}%`, `${s.years} yrs`,
      s.blurb ?? '', s.url ?? '', s.note ?? '',
    ]),
    ...experience.flatMap((j) => [
      j.company, j.role, j.location, jobRangeLabel(j), jobDurationLabel(j),
      j.phase, j.summary, ...j.highlights, ...j.tech, ...j.story,
    ]),
    ...phases.flatMap((p) => [p.title, p.subtitle, p.yearsLabel, p.blurb]),
    ...projects.flatMap((p) => [
      p.title, p.summary, p.details ?? '', p.role ?? '', p.year ?? '', ...p.tech,
    ]),
    ...socials.flatMap((s) => [s.label, s.handle]),
    content.email ?? '',
    content.phone ?? '',
    // The About card renders these at the largest type on the page, so a late
    // rasterisation is at its most obvious here.
    profile.fullName ?? '', profile.title ?? '',
    (profile.designation ?? '').toUpperCase(),
    '0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    '>_[]{}()<>/\|-—–+*=:;.,!?@#$%&"\'`~^ ',
    // Symbols that ARE rendered in 3D but were missing from the preload set, so
    // troika rasterised them asynchronously and they visibly popped in after
    // their section had already faded up.
    '▼↑↓←→█▓▒░·•●○■□◈⌨✕✓',
    // The About section renders as a profile card, so its handle and chrome
    // are part of the preload set too.
    profile.handle,
  ];
  return Array.from(new Set(parts.join('').split(''))).join('');
}
