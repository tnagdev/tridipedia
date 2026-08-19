import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '@/text/palette';
import { cachedPlane, commitUniforms } from './resources';
import { F } from '@/state/frameState';

/**
 * A segmented readout bar. One quad, drawn analytically, so a chart costs no
 * geometry and no text instances.
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
  uniform float uValue, uOpacity, uTime, uSegments;
  uniform vec3 uColor, uTrack;

  void main() {
    // Segmented so it reads as an instrument, not a progress bar.
    float seg = floor(vUv.x * uSegments);
    float segCentre = (seg + 0.5) / uSegments;
    float gap = smoothstep(0.06, 0.14, abs(fract(vUv.x * uSegments) - 0.5) * 2.0);

    float lit = step(segCentre, uValue);
    // the leading segment pulses
    float lead = step(abs(segCentre - uValue), 1.0 / uSegments) * (0.5 + 0.5 * sin(uTime * 5.0));

    vec3 col = mix(uTrack, uColor, lit);
    float a = (0.18 + lit * 0.85 + lead * 0.4) * gap * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(col * a, a);
  }
`;

let material: THREE.ShaderMaterial | null = null;
function getBarMaterial() {
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
      uValue: { value: 0.5 },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
      uSegments: { value: 24 },
      uColor: { value: new THREE.Color(PALETTE.accent) },
      uTrack: { value: new THREE.Color('#0a3a1c') },
    },
  });
  return material;
}

export function StatBar({
  width,
  height = 0.16,
  value,
  segments = 24,
  color = PALETTE.accent,
  opacity = 1,
  position,
  rotation,
  renderOrder = 0,
  depthTest = true,
}: {
  width: number;
  height?: number;
  value: number;
  segments?: number;
  color?: string;
  opacity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  renderOrder?: number;
  /** Off for a bar that belongs to a screen-space overlay rather than the world. */
  depthTest?: boolean;
}) {
  const mat = getBarMaterial();
  const geo = cachedPlane(width, height);
  const ref = useRef<THREE.Mesh>(null);
  const shown = useRef(0);

  useFrame((_, delta) => {
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    mat.uniforms.uTime.value = F.time;
    // charge up rather than snap, so it reads as a live instrument
    shown.current += (value - shown.current) * Math.min(1, delta * 3.5);
  });

  return (
    <mesh
      ref={ref}
      geometry={geo}
      material={mat}
      position={position}
      rotation={rotation}
      renderOrder={renderOrder}
      raycast={() => null}
      onBeforeRender={() => {
        // Per-draw, because the material is shared with every other bar.
        mat.depthTest = depthTest;
        mat.uniforms.uValue.value = shown.current;
        mat.uniforms.uOpacity.value = opacity;
        mat.uniforms.uSegments.value = segments;
        (mat.uniforms.uColor.value as THREE.Color).set(color);
        commitUniforms(mat);
      }}
    />
  );
}
