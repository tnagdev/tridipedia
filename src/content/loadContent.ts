import raw from './site.json';
import type { SectionConfig, SectionId, SiteContent, RainConfig, Job } from './content.types';

export const content = raw as unknown as SiteContent;

export const { profile, skills, experience, phases, projects, socials, meta, journey } = content;

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
    ...skills.flatMap((s) => [s.name, `${s.proficiency}%`, `${s.years} yrs`]),
    ...experience.flatMap((j) => [
      j.company, j.role, j.location, jobRangeLabel(j), jobDurationLabel(j),
      j.phase, j.summary, ...j.highlights, ...j.tech, ...j.story,
    ]),
    ...phases.flatMap((p) => [p.title, p.subtitle, p.yearsLabel, p.blurb]),
    ...projects.flatMap((p) => [p.title, p.summary, ...p.tech]),
    ...socials.flatMap((s) => [s.label, s.handle]),
    content.email ?? '',
    '0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    '>_[]{}()<>/\|-—–+*=:;.,!?@#$%&"\'`~^ ',
    // Symbols that ARE rendered in 3D but were missing from the preload set, so
    // troika rasterised them asynchronously and they visibly popped in after
    // their section had already faded up.
    '▼↑↓←→█▓▒░·•●○■□◈⌨✕',
  ];
  return Array.from(new Set(parts.join('').split(''))).join('');
}
