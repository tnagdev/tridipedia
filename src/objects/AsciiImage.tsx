import { useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import fragmentShader from './ascii.frag.glsl?raw';
import { buildGlyphAtlas, ATLAS_COLS, RAMP } from '@/rain/glyphAtlas';
import { PALETTE } from '@/text/palette';
import { cachedPlane, useDisposable } from './resources';
import { F } from '@/state/frameState';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Any texture, rendered live as ASCII art using the SAME atlas the rain uses.
 * One quad, one fragment shader. The glyph ramp is measured from real ink
 * coverage at bake time, so this stays correct whatever font the OS resolved.
 */
export function AsciiImage({
  src,
  width = 6,
  height = 6,
  cols = 96,
  rows = 96,
  opacity = 1,
  gain = 1,
  color = PALETTE.rain,
  ...rest
}: {
  src: string;
  width?: number;
  height?: number;
  cols?: number;
  rows?: number;
  opacity?: number;
  /** Brightness multiplier. Dark source photos need >1 or the portrait vanishes. */
  gain?: number;
  color?: string;
  [key: string]: unknown;
}) {
  const photo = useLoader(THREE.TextureLoader, src);

  const material = useDisposable(() => {
    const ramp = new Float32Array(16);
    RAMP.slice(0, 16).forEach((v, i) => (ramp[i] = v));
    photo.minFilter = THREE.LinearFilter;
    photo.magFilter = THREE.LinearFilter;
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uPhoto: { value: photo },
        uAtlas: { value: buildGlyphAtlas() },
        uAtlasCols: { value: ATLAS_COLS },
        uGrid: { value: new THREE.Vector2(cols, rows) },
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uGain: { value: gain },
        uRamp: { value: Array.from(ramp) },
        uRampCount: { value: Math.min(16, RAMP.length) },
        uColor: { value: new THREE.Color(color) },
      },
    });
  }, [photo, cols, rows, color, opacity, gain]);

  const geo = cachedPlane(width, height);
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    material.uniforms.uTime.value = F.time;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uGain.value = gain;
  });

  return <mesh ref={ref} geometry={geo} material={material} raycast={() => null} {...rest} />;
}
