import * as THREE from 'three';
import { SLOTS, CELL_H, COLUMN_H } from './rainConfig';
import { GLYPH_COUNT, glyphIndexOf } from './glyphAtlas';

/** Maps slot index -> atlas cell for a locked skill name, or -1 if unavailable. */
function lockedGlyphFor(name: string, slot: number): number {
  const clean = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length === 0) return -1;
  return glyphIndexOf(clean[slot % clean.length]);
}

export interface RainAttributes {
  count: number;
  aOrigin: THREE.InstancedBufferAttribute;
  aParams: THREE.InstancedBufferAttribute;
  aRand: THREE.InstancedBufferAttribute;
  aMeta: THREE.InstancedBufferAttribute;
}

/** A tower the rain should tag itself against, for the Skills glyph-lock. */
export interface SkillZone {
  /** Index into the 9-colour uSkillColors array. */
  index: number;
  position: [number, number, number];
  radius: number;
  /** Characters slot j locks to: name[j % name.length]. */
  name: string;
}

export interface BuildOptions {
  maxInstances: number;
  slots?: number;
  skillZones?: SkillZone[];
  /** Radial extent of the column shell. */
  rMin?: number;
  rMax?: number;
  /** Provide a curve to wrap the shell around the camera journey. */
  curve?: THREE.Curve<THREE.Vector3> | null;
  /** Half-extent along Y when there is no curve (spike mode). */
  spread?: number;
  /**
   * Pin every column to one parallax layer. The ambient far shell needs this:
   * layer is normally derived from radius WITHIN this build's own rMin..rMax,
   * so without pinning, the nearest ambient columns would compute as layer 0
   * and render large despite being the most distant geometry in the world.
   */
  forceLayer?: 0 | 1 | 2;
  seed?: number;
}

/** Deterministic PRNG so a reload gives the same world. */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Distributes rain columns and writes the static per-instance buffers.
 *
 * This runs ONCE. After it, the GPU owns the rain entirely: animation is a
 * pure function of uTime, so there is no per-instance CPU work ever again.
 *
 * The distribution is the single most important CPU-side decision here. A
 * uniform grid reads as a wall; random points in a big box waste ~90% of
 * instances on regions the camera never approaches. So when a curve is
 * supplied, columns are placed in a cylindrical shell around the camera
 * spline itself — every instance is guaranteed to be near the path at some
 * point in the journey.
 */
export function buildRainAttributes(opts: BuildOptions): RainAttributes {
  const slots = opts.slots ?? SLOTS;
  const rMin = opts.rMin ?? 3;
  const rMax = opts.rMax ?? 55;
  const spread = opts.spread ?? 40;
  const rand = mulberry32(opts.seed ?? 0x5eed);

  const columns = Math.floor(opts.maxInstances / slots);
  const count = columns * slots;

  const origin = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);
  const rnd = new Float32Array(count * 4);
  const meta = new Float32Array(count * 2);

  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const ALT = new THREE.Vector3(1, 0, 0);

  for (let c = 0; c < columns; c++) {
    // sqrt() gives uniform AREAL density. Without it you get a dense core
    // and empty outskirts, which reads as a tunnel rather than a world.
    const r = rMin + (rMax - rMin) * Math.sqrt(rand());
    const th = rand() * Math.PI * 2;

    if (opts.curve) {
      const t = rand();
      opts.curve.getPointAt(t, P);
      opts.curve.getTangentAt(t, T);
      // Stable frame: avoid the degenerate case where the tangent is vertical.
      N.crossVectors(Math.abs(T.y) > 0.95 ? ALT : UP, T).normalize();
      B.crossVectors(T, N).normalize();
      P.addScaledVector(N, Math.cos(th) * r).addScaledVector(B, Math.sin(th) * r);
      P.addScaledVector(T, (rand() - 0.5) * COLUMN_H);
    } else {
      P.set(Math.cos(th) * r, (rand() - 0.5) * spread, Math.sin(th) * r);
    }

    // Layer drives parallax: 0 = near/large/fast, 2 = far/tiny/slow.
    const nr = (r - rMin) / Math.max(rMax - rMin, 1e-6);
    const layer = opts.forceLayer ?? (nr < 0.3 ? 0 : nr < 0.65 ? 1 : 2);

    // Tag columns that fall near a skill tower. Done once, on the CPU, so the
    // Skills section costs one extra `mix()` in the shader and nothing else.
    let skill: SkillZone | null = null;
    if (opts.skillZones) {
      for (const z of opts.skillZones) {
        const dx = P.x - z.position[0];
        const dz = P.z - z.position[2];
        if (dx * dx + dz * dz <= z.radius * z.radius) { skill = z; break; }
      }
    }

    const speed = 0.55 + rand() * 1.35;
    const phase = rand();
    const trail = 6 + rand() * (slots - 8); // varied trail lengths => gappy, organic
    const seed = rand() * 1000;
    const scaleJitter = 0.75 + rand() * 0.5;
    const flipRate = 3 + rand() * 11;

    for (let s = 0; s < slots; s++) {
      const i = c * slots + s;
      origin[i * 3 + 0] = P.x;
      origin[i * 3 + 1] = P.y;
      origin[i * 3 + 2] = P.z;

      params[i * 4 + 0] = speed;
      params[i * 4 + 1] = phase;
      params[i * 4 + 2] = trail;
      params[i * 4 + 3] = s;

      rnd[i * 4 + 0] = seed + s * 0.137;
      rnd[i * 4 + 1] = scaleJitter;
      rnd[i * 4 + 2] = flipRate;
      rnd[i * 4 + 3] = layer;

      meta[i * 2 + 0] = skill ? skill.index : -1;
      // Slot j maps to character j of the skill name, so the column reads
      // vertically as REACT REACT REACT when uLock ramps up.
      meta[i * 2 + 1] = skill ? lockedGlyphFor(skill.name, s) : -1;
    }
  }

  return {
    count,
    aOrigin: new THREE.InstancedBufferAttribute(origin, 3),
    aParams: new THREE.InstancedBufferAttribute(params, 4),
    aRand: new THREE.InstancedBufferAttribute(rnd, 4),
    aMeta: new THREE.InstancedBufferAttribute(meta, 2),
  };
}

export { SLOTS, CELL_H, COLUMN_H, GLYPH_COUNT };
