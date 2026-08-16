import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '@/text/palette';
import { buildGlyphAtlas, ATLAS_COLS, GLYPH_COUNT } from '@/rain/glyphAtlas';
import { cachedPlane } from './resources';
import { F } from '@/state/frameState';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * The frame interior runs its own miniature rain in a different palette and
 * direction — you are looking through a window into another version of the
 * world. When real projects arrive, this interior swaps for a thumbnail and
 * the border, tags and hover behaviour are untouched.
 */
const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;

  uniform highp sampler2D uAtlas;
  uniform highp float uAtlasCols;
  uniform float uTime, uGlyphCount, uHover, uOpacity, uFlow, uSeed;
  uniform vec3 uColor, uBorder;

  float hash21(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  void main() {
    // --- border ---
    float ex = min(vUv.x, 1.0 - vUv.x);
    float ey = min(vUv.y, 1.0 - vUv.y);
    float rim = 1.0 - smoothstep(0.0, 0.012, min(ex, ey));

    // --- interior rain ---
    vec2 grid = vec2(14.0, 22.0);
    vec2 cell = floor(vUv * grid);
    vec2 inCell = fract(vUv * grid);

    float speed = (0.5 + hash21(vec2(cell.x, uSeed)) * 1.6) * uFlow * (1.0 + uHover * 2.2);
    float head = fract(hash21(vec2(cell.x, uSeed + 3.0)) + uTime * speed * 0.16) * grid.y;
    float age = mod(head - cell.y, grid.y);
    float bright = pow(clamp(1.0 - age / 7.0, 0.0, 1.0), 2.0);

    float tick = floor(uTime * 8.0 + cell.x * 3.0);
    float g = floor(hash21(vec2(cell.x * 7.1 + cell.y * 3.3, tick)) * uGlyphCount);
    vec2 auv = (vec2(mod(g, uAtlasCols), floor(g / uAtlasCols)) + inCell) / uAtlasCols;
    float glyph = texture2D(uAtlas, auv).r * bright;

    // Keep the interior inside the border.
    float inner = step(0.016, ex) * step(0.016, ey);

    vec3 col = uColor * glyph * inner * (0.55 + uHover * 0.6) + uBorder * rim * (0.5 + uHover * 0.8);
    float a = (glyph * inner * (0.55 + uHover * 0.6) + rim * (0.5 + uHover * 0.8)) * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(col, a);
  }
`;

// Singleton; per-frame colour/seed/hover are pushed at draw time.
let material: THREE.ShaderMaterial | null = null;
function getFrameMaterial() {
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
      uAtlas: { value: buildGlyphAtlas() },
      uAtlasCols: { value: ATLAS_COLS },
      uGlyphCount: { value: GLYPH_COUNT },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uOpacity: { value: 1 },
      uFlow: { value: 1 },
      uSeed: { value: 0 },
      uColor: { value: new THREE.Color(PALETTE.rain) },
      uBorder: { value: new THREE.Color(PALETTE.accent) },
    },
  });
  return material;
}

export function ProjectFrame({
  width = 6.4,
  height = 4.2,
  position,
  hover = 0,
  opacity = 1,
  seed = 0,
  color = PALETTE.rain,
  ...rest
}: {
  width?: number;
  height?: number;
  position: [number, number, number];
  hover?: number;
  opacity?: number;
  seed?: number;
  color?: string;
  [key: string]: unknown;
}) {
  const geo = cachedPlane(width, height);
  const mat = getFrameMaterial();
  const ref = useRef<THREE.Mesh>(null);
  const hoverRef = useRef(0);

  useFrame((_, delta) => {
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    mat.uniforms.uTime.value = F.time;
    hoverRef.current += (hover - hoverRef.current) * Math.min(1, delta * 7);
  });

  return (
    <mesh
      ref={ref}
      geometry={geo}
      material={mat}
      position={position}
      raycast={() => null}
      onBeforeRender={() => {
        mat.uniforms.uOpacity.value = opacity;
        mat.uniforms.uHover.value = hoverRef.current;
        mat.uniforms.uSeed.value = seed * 13.7;
        (mat.uniforms.uColor.value as THREE.Color).set(color);
      }}
      {...rest}
    />
  );
}
