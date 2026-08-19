import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import fragmentShader from './grid.frag.glsl?raw';
import { PALETTE } from '@/text/palette';
import { cachedPlane } from './resources';
import { F } from '@/state/frameState';

const vertexShader = /* glsl */ `
  varying vec2 vGridUv;
  uniform float uScale;
  void main() {
    vGridUv = position.xy * uScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

let material: THREE.ShaderMaterial | null = null;
function getGridMaterial() {
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
      uScale: { value: 1 },
      uFade: { value: 120 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(PALETTE.rain) },
    },
  });
  return material;
}

/** A whole horizon of grid for the cost of one quad — the lines are fract(), not geometry. */
export function GridFloor({
  size = 320,
  y = -6,
  z = 0,
  opacity = 1,
}: {
  size?: number;
  y?: number;
  z?: number;
  opacity?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = getGridMaterial();
  const geo = cachedPlane(size, size);

  useFrame(() => {
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    mat.uniforms.uTime.value = F.time;
    mat.uniforms.uOpacity.value = opacity;
  });

  return (
    <mesh
      ref={ref}
      geometry={geo}
      material={mat}
      position={[0, y, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null}
    />
  );
}
