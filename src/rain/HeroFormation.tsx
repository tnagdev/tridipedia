import { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import vertexShader from './formation.vert.glsl?raw';
import fragmentShader from './formation.frag.glsl?raw';
import { buildGlyphAtlas, ATLAS_COLS, GLYPH_COUNT } from './glyphAtlas';
import { QUAD_POSITIONS, QUAD_UVS } from './quad';
import { sampleTextPoints } from './sampleTextPoints';
import { COLUMN_H } from './rainConfig';
import type { SectionProgress } from '@/scroll/useSectionProgress';
import { F } from '@/state/frameState';

// Module-level singleton — see RainMaterial for why this is structural.
let material: THREE.RawShaderMaterial | null = null;
function getFormationMaterial() {
  if (material) return material;
  material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    uniforms: {
      uAtlas: { value: buildGlyphAtlas() },
      uAtlasCols: { value: ATLAS_COLS },
      uGlyphCount: { value: GLYPH_COUNT },
      uTime: { value: 0 },
      uForm: { value: 0 },
      uGlyphSize: { value: 0.24 },
      uFallSpeed: { value: 3.2 },
      uColumnH: { value: COLUMN_H },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color('#9dffc0') },
    },
  });
  return material;
}

interface Props {
  text: string;
  count: number;
  progress: React.MutableRefObject<SectionProgress>;
  position?: [number, number, number];
  worldWidth?: number;
  /**
   * World size of one glyph. Applied in VIEW space, so it does NOT follow a
   * parent's scale — a caller fitting the word to the viewport must pass this
   * too, or the layout shrinks while the letterforms stay full size and the
   * word collapses into a mush of overlapping blobs.
   */
  glyphSize?: number;
}

/**
 * The Hero's signature moment: chaotic rain decelerates mid-air and condenses
 * into the brand name, then dissolves back into falling code as you scroll on.
 * One extra attribute and one extra uniform over the main rain.
 */
export function HeroFormation({
  text,
  count,
  progress,
  position = [0, 0, 0],
  worldWidth = 16,
  glyphSize = 0.24,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const mat = getFormationMaterial();

  const geometry = useMemo(() => {
    const targets = sampleTextPoints(text, count, { worldWidth });
    const origins = new Float32Array(count * 3);
    const rand = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      // Start scattered around where the word will be, so the convergence
      // reads as a gathering rather than a flight from off-screen.
      origins[i * 3 + 0] = targets[i * 3 + 0] + (Math.random() - 0.5) * 9;
      origins[i * 3 + 1] = (Math.random() - 0.5) * COLUMN_H;
      origins[i * 3 + 2] = targets[i * 3 + 2] + (Math.random() - 0.5) * 6;

      rand[i * 4 + 0] = Math.random();
      rand[i * 4 + 1] = 0.8 + Math.random() * 0.45;
      rand[i * 4 + 2] = 4 + Math.random() * 10;
      rand[i * 4 + 3] = Math.random();
    }

    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS, 2));
    g.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origins, 3));
    g.setAttribute('aTarget', new THREE.InstancedBufferAttribute(targets, 3));
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 4));
    g.instanceCount = count;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }, [text, count, worldWidth]);

  useLayoutEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    m.frustumCulled = false;
    m.raycast = () => null;
    return () => geometry.dispose();
  }, [geometry]);

  useFrame(() => {
    const p = progress.current;
    const u = mat.uniforms;
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    u.uTime.value = F.time;
    // Applied in VIEW space, so it does NOT inherit a parent's scale: a caller
    // fitting the word to the viewport has to size the glyphs itself, or the
    // layout shrinks while the letterforms stay put and the word turns to mush.
    u.uGlyphSize.value = glyphSize;
    // Form up over the first ~65% of the hero, hold, then release.
    const form = Math.min(1, p.local / 0.65);
    u.uForm.value = form;
    u.uOpacity.value = p.exit; // dissolve as the section ends
  });

  if (count <= 0) return null;
  return <mesh ref={meshRef} geometry={geometry} material={mat} position={position} />;
}
