import * as THREE from 'three';

/**
 * THE ONE INVARIANT: nothing that changes every frame is ever React state.
 *
 * Everything per-frame reads and writes this single mutable module-level
 * object. React re-renders only on section mount/unmount, quality-tier change,
 * and hover/text-mode toggles — single-digit renders across a whole journey.
 */
export const F = {
  raw: 0,       // 0..1 straight from the scroll listener
  smooth: 0,    // damped, written by FrameDriver
  velocity: 0,  // normalised d(smooth)/dt, clamped to [-1, 1]
  direction: 1,
  section: 0,
  time: 0,
  dt: 0,
  camPos: new THREE.Vector3(),
};
