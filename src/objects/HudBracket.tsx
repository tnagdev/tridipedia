import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '@/text/palette';
import { cachedPlane, commitUniforms } from './resources';
import { F } from '@/state/frameState';

/**
 * Targeting brackets that lock onto an object, with an optional leader line.
 *
 * Makes content read as *scanned* rather than merely placed — it is the cue
 * that ties a floating label to the thing it describes. The brackets are drawn
 * entirely in the shader on one quad, so there is no geometry cost and every
 * bracket in the site shares one material.
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
  uniform float uTime, uOpacity, uLock, uAspect, uLeader;
  uniform vec3 uColor;

  void main() {
    // Brackets slide inward as uLock goes 0 to 1, so they acquire the target.
    float inset = mix(0.14, 0.0, uLock);
    vec2 p = (vUv - 0.5) / (0.5 - inset) * 0.5 + 0.5;

    vec2 d = min(p, 1.0 - p);
    d.x *= uAspect;
    float bd = min(d.x, d.y);
    float line = 1.0 - smoothstep(0.0, 0.0045, abs(bd - 0.012));

    // Corners only.
    vec2 c = abs(p - 0.5) * 2.0;
    float corner = step(0.62, max(c.x, c.y)) * step(0.30, min(c.x, c.y));
    float brackets = line * corner;

    // Leader line running out from the left edge.
    float leadY = 1.0 - smoothstep(0.0, 0.004, abs(p.y - 0.5));
    float leadX = step(-0.9, p.x) * (1.0 - step(0.02, p.x));
    float leader = leadY * leadX * uLeader;

    float sweep = 0.75 + 0.25 * sin(uTime * 3.0);
    float a = (brackets + leader) * uOpacity * sweep * uLock;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

let material: THREE.ShaderMaterial | null = null;
function getBracketMaterial() {
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
      uLock: { value: 1 },
      uAspect: { value: 1 },
      uLeader: { value: 0 },
      uColor: { value: new THREE.Color(PALETTE.accent) },
    },
  });
  return material;
}

export function HudBracket({
  width,
  height,
  lock = 1,
  opacity = 1,
  leader = 0,
  color = PALETTE.accent,
  position,
  rotation,
}: {
  width: number;
  height: number;
  lock?: number;
  opacity?: number;
  leader?: number;
  color?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const mat = getBracketMaterial();
  const geo = cachedPlane(width, height);
  const ref = useRef<THREE.Mesh>(null);
  const lockRef = useRef(0);

  useFrame((_, delta) => {
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    mat.uniforms.uTime.value = F.time;
    lockRef.current += (lock - lockRef.current) * Math.min(1, delta * 6);
  });

  return (
    <mesh
      ref={ref}
      geometry={geo}
      material={mat}
      position={position}
      rotation={rotation}
      raycast={() => null}
      onBeforeRender={() => {
        mat.uniforms.uOpacity.value = opacity;
        mat.uniforms.uLock.value = lockRef.current;
        mat.uniforms.uLeader.value = leader;
        mat.uniforms.uAspect.value = width / height;
        (mat.uniforms.uColor.value as THREE.Color).set(color);
        commitUniforms(mat);
      }}
    />
  );
}
