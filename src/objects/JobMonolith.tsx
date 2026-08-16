import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '@/text/palette';
import { cachedPlane } from './resources';
import { F } from '@/state/frameState';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uTime, uOpacity, uOpenEnded;

  void main() {
    // Edge-lit slab: bright rim, hollow middle, so it reads as a structure
    // rather than a solid block sitting in the rain.
    float ex = min(vUv.x, 1.0 - vUv.x);
    float ey = min(vUv.y, 1.0 - vUv.y);
    float rim = 1.0 - smoothstep(0.0, 0.035, min(ex, ey));

    float scan = 0.5 + 0.5 * sin(vUv.y * 90.0 - uTime * 1.6);
    float fill = (1.0 - rim) * 0.045 * scan;

    // The current job's far end dissolves — it has not ended yet.
    float open = mix(1.0, 1.0 - smoothstep(0.72, 1.0, vUv.x), uOpenEnded);

    float a = (rim * 0.55 + fill) * open * uOpacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// Singleton. Per-slab values are pushed in onBeforeRender rather than baked
// into per-instance materials, which previously leaked one material per job on
// every section remount.
let material: THREE.ShaderMaterial | null = null;
function getMonolithMaterial() {
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
      uColor: { value: new THREE.Color(PALETTE.rain) },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uOpenEnded: { value: 0 },
    },
  });
  return material;
}

/** A slab whose LENGTH is computed from the job's real ISO dates. */
export function JobMonolith({
  length,
  height = 7,
  position,
  side = 1,
  current = false,
  opacity = 1,
}: {
  length: number;
  height?: number;
  position: [number, number, number];
  side?: 1 | -1;
  current?: boolean;
  opacity?: number;
}) {
  const geo = cachedPlane(length, height);
  const mat = getMonolithMaterial();
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
      position={position}
      rotation={[0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
      raycast={() => null}
      onBeforeRender={() => {
        mat.uniforms.uOpacity.value = opacity;
        mat.uniforms.uOpenEnded.value = current ? 1 : 0;
      }}
    />
  );
}
