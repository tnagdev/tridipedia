import * as THREE from 'three';
import { journey } from '@/content/loadContent';
import type { TrackKey } from './tracks';

export interface JourneyCurves {
  pos: THREE.CatmullRomCurve3;
  look: THREE.CatmullRomCurve3;
  fov: TrackKey[];
  roll: TrackKey[];
  /** Sorted keyframe times, used to remap scroll progress onto curve space. */
  times: number[];
  /** Maps scroll progress 0..1 to the curve parameter. See remap(). */
  remap: (s: number) => number;
}

/**
 * Builds the two splines the whole site travels along.
 *
 * IMPORTANT: CatmullRomCurve3 knows nothing about the authored `t` values — it
 * spaces its control points uniformly in its own parameter space. So calling
 * getPointAt(scrollProgress) silently ignores the keyframe times and lands the
 * camera wherever the arc-length happens to fall. That desynchronises the
 * camera from the section content it is supposed to be looking at.
 *
 * remap() fixes this: it finds which authored keyframe interval the scroll
 * progress falls in and converts it to the curve parameter where that control
 * point actually lives, so keyframe t=0.26 puts the camera exactly on the
 * keyframe authored at t=0.26. Pacing is then genuinely authored in site.json,
 * which is the whole point of having keyframe times at all.
 */
export function buildJourney(): JourneyCurves {
  const kfs = [...journey.keyframes].sort((a, b) => a.t - b.t);

  const pos = new THREE.CatmullRomCurve3(
    kfs.map((k) => new THREE.Vector3(...k.pos)),
    false,
    'catmullrom',
    journey.curveTension,
  );
  const look = new THREE.CatmullRomCurve3(
    kfs.map((k) => new THREE.Vector3(...k.look)),
    false,
    'catmullrom',
    journey.curveTension,
  );

  pos.arcLengthDivisions = 2000;
  look.arcLengthDivisions = 2000;
  pos.getLengths();
  look.getLengths();

  const times = kfs.map((k) => k.t);
  const last = times.length - 1;

  const remap = (s: number): number => {
    if (last <= 0) return 0;
    const t = s <= times[0] ? times[0] : s >= times[last] ? times[last] : s;
    let i = 0;
    while (i < last - 1 && times[i + 1] < t) i++;
    const span = times[i + 1] - times[i];
    const frac = span > 1e-9 ? (t - times[i]) / span : 0;
    return (i + frac) / last;
  };

  return {
    pos,
    look,
    fov: kfs.map((k) => ({ t: k.t, value: k.fov ?? 60, ease: k.ease })),
    roll: kfs.map((k) => ({ t: k.t, value: k.roll ?? 0, ease: k.ease })),
    times,
    remap,
  };
}

/** Single shared instance — the curves are immutable and the LUT is expensive. */
export const J = buildJourney();
