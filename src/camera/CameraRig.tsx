import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEffect } from 'react';
import { J } from './journey';
import { sampleTrack } from './tracks';
import { journey } from '@/content/loadContent';
import { F } from '@/state/frameState';

// Preallocated scratch — zero allocation, zero GC pressure in the hot loop.
const P = new THREE.Vector3();
const L = new THREE.Vector3();

export function CameraRig({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  // Place the camera correctly on the very first frame, before any scroll.
  useEffect(() => {
    J.pos.getPoint(J.remap(0), P);
    J.look.getPoint(J.remap(0), L);
    camera.position.copy(P);
    camera.lookAt(L);
    F.camPos.copy(P);
  }, [camera]);

  useFrame(() => {
    const s = THREE.MathUtils.clamp(F.smooth, 0, 1);

    // getPoint on the REMAPPED parameter, not getPointAt on raw scroll — see
    // journey.ts. getPointAt would ignore the authored keyframe times entirely.
    J.pos.getPoint(J.remap(s), P);
    // Aim slightly ahead of where we are, so corners lead instead of lag.
    // This is what makes the camera feel like it is travelling rather than
    // being dragged.
    J.look.getPoint(J.remap(Math.min(s + journey.lookAhead, 1)), L);

    camera.position.copy(P);
    camera.up.set(0, 1, 0);
    camera.lookAt(L);

    if (!reducedMotion) camera.rotateZ(sampleTrack(J.roll, s));

    const speedPunch = reducedMotion ? 0 : Math.abs(F.velocity) * 0.06;
    const fov = sampleTrack(J.fov, s) * (1 + speedPunch);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    F.camPos.copy(P);
  });

  return null;
}
