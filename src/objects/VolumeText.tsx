import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { commitUniforms } from './resources';
import { QUAD_POSITIONS, QUAD_UVS } from '@/rain/quad';
import { buildGlyphAtlas, glyphIndexOf, ATLAS_COLS } from '@/rain/glyphAtlas';
import { F } from '@/state/frameState';

/**
 * A word whose characters are SOLID, and turn.
 *
 * Every glyph is built out of a stack of quads spaced along its own local Z —
 * an extrusion by slices. Face-on the slices sit exactly on top of each other
 * and read as one letter; turned, they separate into the letter's own thickness;
 * edge-on you see the stack from the side, which is the flank of a solid block.
 * That is what makes it read as a machined character rather than a sticker with
 * a spin on it.
 *
 * Real extruded geometry would mean TextGeometry, which means shipping a
 * typeface.json — and this project builds every glyph, mark and frame it uses at
 * runtime rather than carrying binary assets. Slicing the atlas we already have
 * gets the same read for one instanced draw and no new files.
 *
 * Characters turn on their OWN axes with a phase offset per index, so the word
 * ripples rather than pivoting as a slab.
 *
 * The turn SWINGS rather than spinning all the way round, and that is a
 * requirement rather than a taste: these slices are zero-thickness planes, so at
 * ninety degrees they present no area at all and the letter vanishes. A stack of
 * flat planes has no flank to show you. Swinging inside +/- uSwing keeps every
 * character facing you enough to read — which a scroll prompt has to be — while
 * opening far enough at the extremes to pull the slices visibly apart, which is
 * where the thickness actually reads.
 *
 * Cost: chars x slices instances, one draw call. "SCROLL TO BEGIN" at 10 slices
 * is 130 instances against a rain budget measured in tens of thousands.
 */

const vertexShader = /* glsl */ `
precision highp float;

in vec3 position;
in vec2 uv;
in vec3 aOffset;   // character's own origin, in the word's local space
in vec3 aParams;   // x cell, y slice 0..n-1, z char index
in float aSlices;

uniform mat4 modelViewMatrix, projectionMatrix;
uniform highp float uAtlasCols;
uniform float uTime, uSize, uDepth, uSpin, uPhase, uSwing;

out vec2 vUv;
out highp vec2 vCell;
out float vSliceT;   // 0 back, 1 front
out float vTurn;     // 0 face-on, 1 at the end of the swing

void main() {
  vUv = uv;
  float cell = aParams.x;
  vCell = vec2(mod(cell, uAtlasCols), floor(cell / uAtlasCols)) / uAtlasCols;

  float n = max(aSlices, 1.0);
  vSliceT = aParams.y / max(n - 1.0, 1.0);

  // Each character on its own clock, offset down the word, swinging rather than
  // spinning — see the note at the top.
  float ang = sin(uTime * uSpin + aParams.z * uPhase) * uSwing;
  float c = cos(ang);
  float s = sin(ang);
  vTurn = abs(s);

  // The quad, plus this slice's depth, rotated about the character's Y axis.
  vec3 local = vec3(position.x * uSize, position.y * uSize, (vSliceT - 0.5) * uDepth);
  vec3 spun = vec3(local.x * c + local.z * s, local.y, -local.x * s + local.z * c);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(aOffset + spun, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision mediump float;

in highp vec2 vUv;
in highp vec2 vCell;
in float vSliceT;
in float vTurn;

uniform highp sampler2D uAtlas;
uniform highp float uAtlasCols;
uniform float uOpacity, uSlices;
uniform vec3 uColor, uHeadColor;

out vec4 fragColor;

void main() {
  float a = texture(uAtlas, vCell + vUv / uAtlasCols).r;
  if (a < 0.02) discard;

  // Divided by the slice count, or the stack would simply be N times brighter
  // than a flat glyph. The front slices keep more of it, so the character has a
  // lit face and a body falling away behind it.
  float depthGain = mix(0.55, 1.0, vSliceT) / uSlices;

  // Lifts a little as the character turns away, so the slices reading as one
  // face at rest come apart into a visible body rather than just dimming.
  float turnGain = 1.0 + vTurn * 0.9;

  vec3 col = mix(uColor, uHeadColor, vSliceT * 0.85);
  // Above unity so the stack clears the composer's 0.25 luminance threshold and
  // blooms — but only just. Pushed harder the halo swallows the letterforms, and
  // at this size the characters carry themselves on mass rather than on light.
  float o = a * depthGain * turnGain * uOpacity * 4.2;
  if (o < 0.004) discard;
  fragColor = vec4(col * o, o);
}
`;

let material: THREE.RawShaderMaterial | null = null;
function getVolumeMaterial() {
  if (material) return material;
  material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    transparent: true,
    // Order-independent, which a rotating stack of coplanar slices needs: there
    // is no correct sort order for them and additive does not ask for one.
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    uniforms: {
      uAtlas: { value: buildGlyphAtlas() },
      uAtlasCols: { value: ATLAS_COLS },
      uTime: { value: 0 },
      uSize: { value: 1 },
      uDepth: { value: 0.45 },
      uSpin: { value: 0.7 },
      uPhase: { value: 0.35 },
      uSwing: { value: 1.0 },
      uOpacity: { value: 1 },
      uSlices: { value: 10 },
      uColor: { value: new THREE.Color('#00d93f') },
      uHeadColor: { value: new THREE.Color('#d8ffe4') },
    },
  });
  return material;
}

export interface VolumeTextProps {
  /** Uppercased and matched against the glyph atlas. Characters it has no cell for are skipped. */
  text: string;
  /** Glyph size in world units. */
  size?: number;
  /** How thick each character is. */
  depth?: number;
  /** Quads per character. More is smoother and costs one instance each. */
  slices?: number;
  /** 'down' stacks the word as a rain column; 'across' sets it on one line. */
  direction?: 'down' | 'across';
  /** Spacing between characters, as a multiple of `size`. */
  spacing?: number;
  /** Radians per second of the swing's own clock. */
  spin?: number;
  /** Half-angle of the swing, in radians. Past ~1.3 the letters start to hide. */
  swing?: number;
  /** Radians of offset between neighbouring characters, so the word ripples. */
  phase?: number;
  color?: string;
  headColor?: string;
  opacity?: number;
  /**
   * Per-frame opacity. Wins over `opacity` when given, and exists because the
   * prop is captured at render — a fade driven from a useFrame could never
   * reach it otherwise, and re-rendering every frame is not on the table.
   */
  opacityRef?: React.MutableRefObject<number>;
  position?: [number, number, number];
}

export function VolumeText({
  text,
  size = 1,
  depth = 0.45,
  slices = 10,
  direction = 'down',
  spacing = 1.05,
  spin = 0.7,
  swing = 1.0,
  phase = 0.35,
  color = '#00d93f',
  headColor = '#d8ffe4',
  opacity = 1,
  opacityRef,
  position,
}: VolumeTextProps) {
  const mat = getVolumeMaterial();

  const geometry = useMemo(() => {
    // Characters the atlas cannot draw (space, punctuation it does not carry)
    // still take their place in the layout — the gap is part of the word.
    const chars = text.toUpperCase().split('');
    const drawn: { cell: number; index: number }[] = [];
    chars.forEach((ch, i) => {
      const cell = glyphIndexOf(ch);
      if (cell >= 0) drawn.push({ cell, index: i });
    });

    const n = Math.max(1, Math.round(slices));
    const count = drawn.length * n;
    const offset = new Float32Array(count * 3);
    const params = new Float32Array(count * 3);
    const sliceCount = new Float32Array(count);

    const step = size * spacing;
    const mid = (chars.length - 1) / 2;

    let w = 0;
    for (const d of drawn) {
      for (let s = 0; s < n; s++) {
        const o = w * 3;
        if (direction === 'down') {
          offset[o] = 0;
          offset[o + 1] = -(d.index - mid) * step;
        } else {
          offset[o] = (d.index - mid) * step;
          offset[o + 1] = 0;
        }
        offset[o + 2] = 0;
        params[o] = d.cell;
        params[o + 1] = s;
        params[o + 2] = d.index;
        sliceCount[w] = n;
        w++;
      }
    }

    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS, 2));
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3));
    g.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 3));
    g.setAttribute('aSlices', new THREE.InstancedBufferAttribute(sliceCount, 1));
    g.instanceCount = count;
    // The characters turn, so a fitted bounds would cull them mid-rotation.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }, [text, size, slices, direction, spacing]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // ASSIGN F.time, never accumulate: the material is a module-level singleton
    // and every mounted instance runs this callback.
    mat.uniforms.uTime.value = F.time;
  });

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={mat}
      frustumCulled={false}
      raycast={() => null}
      position={position}
      onBeforeRender={() => {
        const u = mat.uniforms;
        u.uSize.value = size;
        u.uDepth.value = depth;
        u.uSpin.value = spin;
        u.uSwing.value = swing;
        u.uPhase.value = phase;
        u.uOpacity.value = opacityRef ? opacityRef.current : opacity;
        u.uSlices.value = Math.max(1, Math.round(slices));
        (u.uColor.value as THREE.Color).set(color);
        (u.uHeadColor.value as THREE.Color).set(headColor);
        commitUniforms(mat);
      }}
    />
  );
}
