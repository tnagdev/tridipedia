import { content, sectionIndexAt } from '@/content/loadContent';
import type { SectionId } from '@/content/content.types';

export const SECTIONS = content.sections;
export type { SectionId };

type Listener = (index: number) => void;
const listeners = new Set<Listener>();

/** Fires at most ~12 times per journey, so a setState here is free. */
export function emitSectionChange(index: number) {
  listeners.forEach((l) => l(index));
}

export function onSectionChange(cb: Listener) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function isWithin(id: SectionId, t: number, pad = 0.06): boolean {
  const s = SECTIONS.find((x) => x.id === id)!;
  return t >= s.range[0] - pad && t <= s.range[1] + pad;
}

export { sectionIndexAt };
