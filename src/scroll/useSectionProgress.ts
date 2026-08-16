import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { F } from '@/state/frameState';
import { getSection } from '@/content/loadContent';
import { clamp01, easeInOutCubic, smoothstep } from './easing';
import type { SectionId } from '@/content/content.types';

export interface SectionProgress {
  local: number;
  eased: number;
  enter: number;
  exit: number;
  /** enter * exit — peaks at 1 mid-section. The workhorse. */
  band: number;
}

/**
 * Returns a REF, so reading per-frame progress never triggers a React render.
 * Multiply opacity / scale / uniforms by `band` and objects fade in and out of
 * their section automatically.
 */
export function useSectionProgress(id: SectionId) {
  const [start, end] = getSection(id).range;
  const ref = useRef<SectionProgress>({ local: 0, eased: 0, enter: 0, exit: 1, band: 0 });

  useFrame(() => {
    const l = clamp01((F.smooth - start) / (end - start || 1e-6));
    const p = ref.current;
    p.local = l;
    p.eased = easeInOutCubic(l);
    p.enter = smoothstep(0.0, 0.15, l);
    p.exit = 1 - smoothstep(0.85, 1.0, l);
    p.band = p.enter * p.exit;
  });

  return ref;
}
