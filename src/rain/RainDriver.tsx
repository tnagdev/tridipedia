import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo } from 'react';
import { getRainMaterial } from './RainMaterial';
import { content, rainConfigFor } from '@/content/loadContent';
import { F } from '@/state/frameState';
import { clamp01 } from '@/scroll/easing';
import type { RainConfig } from '@/content/content.types';

const SCRATCH_FLOW = new THREE.Vector3();
const SCRATCH_Q = new THREE.Quaternion();
const SCRATCH_QT = new THREE.Quaternion();
/**
 * Axis to rotate a flow direction about when the two ends are exactly opposed.
 *
 * +X sweeps a vertical fall through (0, 0, -1) — straight down the tunnel, the
 * same look the Experience section already ships — rather than through some
 * arbitrary sideways drift.
 */
const FLIP_AXIS = new THREE.Vector3(1, 0, 0);
const SCRATCH_POINT = new THREE.Vector3();
const SCRATCH_TAIL = new THREE.Color();
const SCRATCH_HEAD = new THREE.Color();

interface Resolved extends Omit<RainConfig, 'flowDir' | 'tailColor' | 'headColor' | 'convergePoint'> {
  flow: THREE.Vector3;
  converged: THREE.Vector3;
  tail: THREE.Color;
  head: THREE.Color;
  range: [number, number];
  zones: [number, number, number, number][];
}

/**
 * Blends the rain's uniforms between adjacent sections as the journey moves.
 *
 * This is the entire per-frame cost of the rain's art direction: about a dozen
 * scalar lerps and three vector writes. Everything else the rain does happens
 * on the GPU as a pure function of uTime.
 */
export function RainDriver() {
  const material = getRainMaterial();

  const sections = useMemo<Resolved[]>(
    () =>
      content.sections.map((s) => {
        const c = rainConfigFor(s.id);
        return {
          ...c,
          flow: new THREE.Vector3(...c.flowDir).normalize(),
          converged: new THREE.Vector3(...c.convergePoint),
          tail: new THREE.Color(c.tailColor),
          head: new THREE.Color(c.headColor),
          range: s.range,
          zones: s.textZones ?? [],
        } as Resolved;
      }),
    [],
  );

  useFrame(() => {
    const t = clamp01(F.smooth);

    // Find the section pair to blend between, using the midpoint of each
    // section as its anchor so transitions straddle boundaries evenly.
    let i = 0;
    for (let n = 0; n < sections.length; n++) {
      const mid = (sections[n].range[0] + sections[n].range[1]) * 0.5;
      if (t >= mid) i = n;
    }
    const a = sections[i];
    const b = sections[Math.min(i + 1, sections.length - 1)];
    const midA = (a.range[0] + a.range[1]) * 0.5;
    const midB = (b.range[0] + b.range[1]) * 0.5;
    const w = a === b ? 0 : clamp01((t - midA) / Math.max(midB - midA, 1e-6));
    // smoothstep the blend so section changes ease rather than ramp linearly
    const blend = w * w * (3 - 2 * w);

    const u = material.uniforms;
    const mix = (x: number, y: number) => x + (y - x) * blend;

    u.uSpeed.value = mix(a.speed, b.speed);
    u.uDensity.value = mix(a.density, b.density);
    u.uGlyphSize.value = mix(a.glyphSize, b.glyphSize);
    u.uIntensity.value = mix(a.intensity, b.intensity);
    u.uTint.value = mix(a.tint, b.tint);
    u.uLock.value = mix(a.lock, b.lock);
    u.uOpen.value = mix(a.open, b.open);
    u.uConverge.value = mix(a.converge, b.converge);
    u.uBillboardLock.value = mix(a.billboardLock, b.billboardLock);

    /**
     * ROTATE the flow between sections, never lerp it.
     *
     * A lerp between two unit vectors then re-normalised is not a turn, it is a
     * cut: the result is a unit vector for every blend except the midpoint, so
     * the fall snaps from one direction to the other and spends one frame
     * somewhere undefined. Projects (0,-1,0) into Contact (0,1,0) is the worst
     * case of it — exactly opposed, so the lerp passes through the ZERO vector,
     * and normalize() is divideScalar(length() || 1), which leaves zero as
     * zero. With uFlowDir at zero every column in the world collapses onto its
     * own origin: the entire rainfall freezes into stationary points for a
     * frame, in the middle of the site's finale.
     *
     * Opposed directions have no unique arc between them, so setFromUnitVectors
     * cannot help there either — that case gets an explicit axis.
     */
    if (a.flow.dot(b.flow) < -0.9995) {
      SCRATCH_Q.setFromAxisAngle(FLIP_AXIS, Math.PI * blend);
      SCRATCH_FLOW.copy(a.flow).applyQuaternion(SCRATCH_Q);
    } else {
      SCRATCH_QT.setFromUnitVectors(a.flow, b.flow);
      SCRATCH_Q.identity().slerp(SCRATCH_QT, blend);
      SCRATCH_FLOW.copy(a.flow).applyQuaternion(SCRATCH_Q);
    }
    (u.uFlowDir.value as THREE.Vector3).copy(SCRATCH_FLOW);

    SCRATCH_POINT.copy(a.converged).lerp(b.converged, blend);
    (u.uConvergePoint.value as THREE.Vector3).copy(SCRATCH_POINT);

    SCRATCH_TAIL.copy(a.tail).lerp(b.tail, blend);
    SCRATCH_HEAD.copy(a.head).lerp(b.head, blend);
    (u.uTailColor.value as THREE.Color).copy(SCRATCH_TAIL);
    (u.uHeadColor.value as THREE.Color).copy(SCRATCH_HEAD);

    // Text zones: take the nearer section's, fading radius by blend weight so
    // holes open and close instead of popping.
    const zones = u.uZones.value as THREE.Vector4[];
    const src = blend < 0.5 ? a.zones : b.zones;
    const fade = blend < 0.5 ? 1 - blend * 2 : (blend - 0.5) * 2;
    for (let z = 0; z < 4; z++) {
      const zone = src[z];
      if (zone) zones[z].set(zone[0], zone[1], zone[2], zone[3] * fade);
      else zones[z].set(0, 0, 0, 0);
    }
  });

  return null;
}
