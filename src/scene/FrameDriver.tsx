import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { F } from '@/state/frameState';
import { damp } from '@/utils/damp';
import { journey } from '@/content/loadContent';
import { emitSectionChange, sectionIndexAt } from '@/state/sections';
import { setUi } from '@/state/store';

/**
 * Mounted as the FIRST child of <Canvas>. Owns every per-frame global.
 *
 * Deliberately NOT using useFrame priorities: any non-zero priority in R3F v8
 * disables auto-render and forces manual gl.render, which is fragile. A
 * consumer that happens to run before this one sees a one-frame-old value,
 * which at 60fps with lambda ~4 is 0.3% of a transition — unobservable.
 * Correctness by tolerance beats correctness by ordering.
 */
export function FrameDriver({ reducedMotion = false }: { reducedMotion?: boolean }) {
  useFrame((_, delta) => {
    // Clamp dt or a tab-switch teleports the camera on return.
    const dt = Math.min(delta, 1 / 30);
    const prev = F.smooth;

    F.smooth = damp(F.smooth, F.raw, journey.damping, dt);

    const inst = (F.smooth - prev) / Math.max(dt, 1e-4);
    const targetVel = reducedMotion ? 0 : THREE.MathUtils.clamp(inst * 6, -1, 1);
    F.velocity = damp(F.velocity, targetVel, 9, dt);
    if (inst !== 0) F.direction = Math.sign(inst);
    F.dt = dt;
    F.time += reducedMotion ? dt * 0.15 : dt;

    const idx = sectionIndexAt(F.smooth);
    if (idx !== F.section) {
      F.section = idx;
      emitSectionChange(idx);
      setUi({ section: idx });
    }
  });

  return null;
}
