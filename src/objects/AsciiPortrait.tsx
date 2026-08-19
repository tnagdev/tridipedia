import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import fragmentShader from './portrait.frag.glsl?raw';
import {
  PORTRAIT_ROWS,
  PORTRAIT_COLS,
  PORTRAIT_ROW_COUNT,
  PORTRAIT_ASPECT,
} from '@/content/asciiPortrait';
import { buildGlyphAtlas, ATLAS_COLS, GLYPH_COUNT } from '@/rain/glyphAtlas';
import { PALETTE } from '@/text/palette';
import { cachedPlane } from './resources';
import { F } from '@/state/frameState';
import type { SectionProgress } from '@/scroll/useSectionProgress';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * The hand-made portrait from the old site, drawn as one quad.
 *
 * NOT the same thing as <AsciiImage />: that converts a photograph to ASCII by
 * luminance at runtime. This carries an image that was ALREADY ASCII, so the
 * art is authoritative and nothing is allowed to re-derive it. The cell grid is
 * uploaded as a 69x38 mask — one texel per character — and the shader decides
 * per cell whether it is silhouette (keeps flickering as rain glyphs) or
 * interior (settles into a block).
 */

/** One texel per character cell. ~2.6KB, built once, shared by every instance. */
let maskTexture: THREE.DataTexture | null = null;
function buildPortraitMask(): THREE.DataTexture {
  if (maskTexture) return maskTexture;

  const data = new Uint8Array(PORTRAIT_COLS * PORTRAIT_ROW_COUNT);
  for (let y = 0; y < PORTRAIT_ROW_COUNT; y++) {
    // Texture row 0 is the BOTTOM of the quad, the art's first line is the top.
    const line = PORTRAIT_ROWS[PORTRAIT_ROW_COUNT - 1 - y];
    for (let x = 0; x < PORTRAIT_COLS; x++) {
      data[y * PORTRAIT_COLS + x] = line[x] === ' ' ? 0 : 255;
    }
  }

  const tex = new THREE.DataTexture(data, PORTRAIT_COLS, PORTRAIT_ROW_COUNT, THREE.RedFormat);
  // 69 bytes per row is not a multiple of 4, so the default unpack alignment
  // would shear every row of the portrait by a byte or two.
  tex.unpackAlignment = 1;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  maskTexture = tex;
  return tex;
}

// Module-level singleton — see RainMaterial for why this is structural. There
// is only ever one portrait, but this also keeps its compiled program alive
// across the mount/unmount cycles the About section goes through.
let material: THREE.ShaderMaterial | null = null;
function getPortraitMaterial(): THREE.ShaderMaterial {
  if (material) return material;
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uMask: { value: buildPortraitMask() },
      uAtlas: { value: buildGlyphAtlas() },
      uAtlasCols: { value: ATLAS_COLS },
      uGlyphCount: { value: GLYPH_COUNT },
      uGrid: { value: new THREE.Vector2(PORTRAIT_COLS, PORTRAIT_ROW_COUNT) },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uReveal: { value: 1 },
      uColor: { value: new THREE.Color(PALETTE.rain) },
      uHead: { value: new THREE.Color(PALETTE.rainHead) },
    },
  });
  return material;
}

export interface AsciiPortraitProps {
  /** Section progress ref: drives both the fade and the formation. */
  progress?: React.MutableRefObject<SectionProgress>;
  /** Quad height in world units. Width follows PORTRAIT_ASPECT so the face is never stretched. */
  height: number;
  opacity?: number;
  color?: string;
  headColor?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  renderOrder?: number;
}

export function AsciiPortrait({
  progress,
  height,
  opacity = 1,
  color = PALETTE.rain,
  headColor = PALETTE.rainHead,
  ...rest
}: AsciiPortraitProps) {
  const mat = getPortraitMaterial();
  const geo = cachedPlane(height * PORTRAIT_ASPECT, height);
  const ref = useRef<THREE.Mesh>(null);
  const reveal = useRef(0);
  const alpha = useRef(0);

  useFrame((_, delta) => {
    const p = progress?.current;
    // The formation tracks scroll on the way in, but never runs backwards: once
    // the picture has assembled, scrolling back up should not un-draw it.
    const target = p ? Math.min(1, p.local / 0.55) : 1;
    reveal.current = Math.max(reveal.current, target);
    // Fade with the section band so it leaves with everything else.
    const want = (p ? p.band : 1) * opacity;
    alpha.current += (want - alpha.current) * Math.min(1, delta * 6);
  });

  return (
    <mesh
      ref={ref}
      geometry={geo}
      material={mat}
      raycast={() => null}
      {...rest}
      onBeforeRender={() => {
        // Per-instance values are pushed at draw time so the material stays a
        // singleton and one compiled program serves every portrait.
        const u = mat.uniforms;
        // ASSIGN F.time, never accumulate delta: this material is a
        // module-level singleton and F.time is reduced-motion aware.
        u.uTime.value = F.time;
        u.uOpacity.value = alpha.current;
        u.uReveal.value = reveal.current;
        (u.uColor.value as THREE.Color).set(color);
        (u.uHead.value as THREE.Color).set(headColor);
      }}
    />
  );
}
