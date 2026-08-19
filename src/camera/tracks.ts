import * as THREE from 'three';
import { EASE } from '@/scroll/easing';
import type { EaseName } from '@/content/content.types';

export interface TrackKey { t: number; value: number; ease?: EaseName }

/** Scalar keyframe interpolation for fov / roll, authored alongside positions. */
export function sampleTrack(kfs: TrackKey[], t: number): number {
  if (kfs.length === 0) return 0;
  if (kfs.length === 1) return kfs[0].value;
  let i = 1;
  while (i < kfs.length - 1 && kfs[i].t < t) i++;
  const a = kfs[i - 1];
  const b = kfs[i];
  const u = THREE.MathUtils.clamp((t - a.t) / Math.max(b.t - a.t, 1e-6), 0, 1);
  const ease = EASE[b.ease ?? 'inOutCubic'];
  return THREE.MathUtils.lerp(a.value, b.value, ease(u));
}
