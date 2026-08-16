import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '@/text/palette';
import { cachedGeometry } from './resources';
import { F } from '@/state/frameState';

/**
 * A glowing line with pulses travelling along it, connecting points in the
 * world so the journey reads as one system rather than a series of unrelated
 * rooms.
 *
 * Built as a thin ribbon rather than a tube: the same look under bloom at a
 * fraction of the vertex count, and it stays camera-readable from any angle
 * because it is double-sided.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime, uOpacity, uSpeed, uPulses;
  uniform vec3 uColor, uPulseColor;

  void main() {
    // Brightness across the ribbon width: a bright core with soft shoulders.
    float core = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 3.0);

    // Pulses running along the length.
    float p = fract(vUv.x * uPulses - uTime * uSpeed);
    float pulse = pow(1.0 - p, 14.0);

    // Fade the ends so the run does not stop abruptly in mid-air.
    float ends = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));

    float a = (core * 0.26 + pulse * core * 1.6) * ends * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(uColor, uPulseColor, pulse) * a, a);
  }
`;

let material: THREE.ShaderMaterial | null = null;
function getConduitMaterial() {
  if (material) return material;
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uSpeed: { value: 0.25 },
      uPulses: { value: 3 },
      uColor: { value: new THREE.Color(PALETTE.rain) },
      uPulseColor: { value: new THREE.Color(PALETTE.textBright) },
    },
  });
  return material;
}

/** Straight ribbon from a to b. Cached by id, so repeat mounts reuse buffers. */
function ribbon(
  key: string,
  a: [number, number, number],
  b: [number, number, number],
  width: number,
  up: [number, number, number],
) {
  return cachedGeometry(`conduit:${key}:${width}`, () => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(B, A).normalize();
    const U = new THREE.Vector3(...up).normalize();
    let side = new THREE.Vector3().crossVectors(dir, U);
    // Degenerate when the run is parallel to `up`; pick any perpendicular.
    if (side.lengthSq() < 1e-6) side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0));
    side.normalize().multiplyScalar(width / 2);

    const SEG = 24;
    const pos = new Float32Array((SEG + 1) * 2 * 3);
    const uv = new Float32Array((SEG + 1) * 2 * 2);
    const idx: number[] = [];
    const p = new THREE.Vector3();

    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      p.lerpVectors(A, B, t);
      const o = i * 6;
      pos[o] = p.x - side.x;
      pos[o + 1] = p.y - side.y;
      pos[o + 2] = p.z - side.z;
      pos[o + 3] = p.x + side.x;
      pos[o + 4] = p.y + side.y;
      pos[o + 5] = p.z + side.z;
      const u = i * 4;
      uv[u] = t;
      uv[u + 1] = 0;
      uv[u + 2] = t;
      uv[u + 3] = 1;
      if (i < SEG) {
        const v = i * 2;
        idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  });
}

export function Conduit({
  id,
  from,
  to,
  width = 0.26,
  up = [0, 1, 0],
  color = PALETTE.rain,
  pulses = 3,
  speed = 0.25,
  opacity = 1,
}: {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
  width?: number;
  up?: [number, number, number];
  color?: string;
  pulses?: number;
  speed?: number;
  opacity?: number;
}) {
  const mat = getConduitMaterial();
  const geo = ribbon(id, from, to, width, up);
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    mat.uniforms.uTime.value = F.time;
  });

  return (
    <mesh
      ref={ref}
      geometry={geo}
      material={mat}
      raycast={() => null}
      onBeforeRender={() => {
        mat.uniforms.uOpacity.value = opacity;
        mat.uniforms.uPulses.value = pulses;
        mat.uniforms.uSpeed.value = speed;
        (mat.uniforms.uColor.value as THREE.Color).set(color);
      }}
    />
  );
}
