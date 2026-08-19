import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '@/text/palette';
import { cachedPlane } from './resources';
import { F } from '@/state/frameState';

/** Barrel displacement in the vertex shader gives the CRT its curve for free. */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z -= (p.x * p.x * 0.020 + p.y * p.y * 0.032);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime, uOpacity;
  uniform vec3 uColor;

  void main() {
    vec2 c = vUv - 0.5;

    // Dark green glass, brighter toward the centre.
    float vig = 1.0 - smoothstep(0.18, 0.72, length(c));
    float base = 0.05 + 0.10 * vig;

    // Fine scanlines plus one slow bright band rolling down the tube.
    float scan = 0.5 + 0.5 * sin(vUv.y * 620.0);
    float roll = smoothstep(0.965, 1.0, fract(vUv.y * 0.5 - uTime * 0.08));

    float a = (base + scan * 0.020 + roll * 0.10) * uOpacity;
    gl_FragColor = vec4(uColor * a, a * 0.92);
  }
`;

let material: THREE.ShaderMaterial | null = null;
function getPanelMaterial() {
  if (material) return material;
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    // depthWrite ON: this is what cuts the rain behind the panel and gives the
    // copy a guaranteed contrast floor even if the text zones are mistuned.
    depthWrite: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(PALETTE.rain) },
    },
  });
  return material;
}

export function TerminalPanel({
  width = 13,
  height = 7.4,
  opacity = 1,
  ...rest
}: { width?: number; height?: number; opacity?: number; [key: string]: unknown }) {
  const mat = getPanelMaterial();
  const geo = cachedPlane(width, height, 48, 32);
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    mat.uniforms.uTime.value = F.time;
    mat.uniforms.uOpacity.value = opacity;
  });

  return <mesh ref={ref} geometry={geo} material={mat} raycast={() => null} {...rest} />;
}
