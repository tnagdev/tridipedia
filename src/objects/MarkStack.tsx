import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { QUAD_POSITIONS, QUAD_UVS } from '@/rain/quad';
import { buildMarkAtlas, type MarkAtlas } from './markAtlas';
import { F } from '@/state/frameState';
import { damp } from '@/utils/damp';

/**
 * Marks drawn as a STACK of machined plates, in ONE instanced draw.
 *
 * A mark here is not a sticker, it is an assembly. At rest the plates sit a
 * hair apart so the thing reads as hardware; on hover they separate along the
 * view axis and fan sideways, the way you lift the layers off a piece of
 * equipment. The top plate carries the logo, the ones beneath carry the guts —
 * an etched trace and a via — so there is something to see once they part.
 *
 * WHY THIS EXISTS RATHER THAN A SECOND <MarkTiles />
 * MarkTiles keeps size, opacity and gauge in UNIFORMS on a module-level
 * singleton material, written every frame from its own useFrame. Draw happens
 * after every useFrame has run, so the last writer wins for every mounted mesh:
 * two MarkTiles on screen at different sizes both render at ONE size. That is
 * not hypothetical here — useSectionActive pads each range by 0.06, so About
 * (0.10-0.42) and Skills (0.30-0.64) are mounted together across 0.30-0.42.
 *
 * So everything that can differ between items rides an instanced attribute, and
 * the two uniforms that DO differ between mounts — the atlas and its column
 * count — are pushed in onBeforeRender, which runs immediately before each
 * mesh's own draw. Only the clock is left as a plain uniform, and that is the
 * same for everyone. This component is safe to mount more than once, with a
 * different set of marks in each mount.
 */

const vertexShader = /* glsl */ `
precision highp float;

in vec3 position;
in vec2 uv;
in vec3 aOffset;
in vec3 aColor;
in vec2 aState;   // x hover 0..1 (damped), y opacity
in vec4 aParams;  // x size, y phase, z layer index, w layer count
in vec2 aStack;   // x spread, y fan
in float aCell;

uniform mat4 modelViewMatrix, projectionMatrix;
uniform highp float uTime, uCols;

out vec2 vUv;
out vec3 vColor;
out vec2 vState;
out highp vec2 vCellOrigin;
out float vLayerT;   // 0 = bottom plate, 1 = top plate
out float vTop;      // 1.0 on the top plate only
out float vPhase;

void main() {
  vUv = uv;
  vColor = aColor;
  vState = aState;
  vPhase = aParams.y;

  vCellOrigin = vec2(mod(aCell, uCols), floor(aCell / uCols)) / uCols;

  float li = aParams.z;
  float ln = max(aParams.w, 1.0);
  vLayerT = ln > 1.0 ? li / (ln - 1.0) : 1.0;
  vTop = step(ln - 1.5, li);

  float hover = aState.x;

  // Already a hair apart at rest: closed, the mark still reads as an assembly
  // rather than a decal.
  float rest = (li - (ln - 1.0) * 0.5) * 0.012;

  // The STAGGER is the whole effect. Biasing the ramp by the plate's own depth
  // starts the top plate moving while the ones under it are still seated, so
  // the stack PEELS instead of telescoping out as one rigid block.
  float stagger = smoothstep(0.0, 1.0, hover * 1.35 - vLayerT * 0.35);
  float sep = rest + stagger * vLayerT * aStack.x;

  // Separate in VIEW space, where the camera IS the origin.
  //
  // The obvious version — normalize(uCamPos - aOffset) — is wrong, and wrong in
  // a way that looks plausible: aOffset is in the MESH's local space while a
  // camera position uniform is in world space, and this mesh hangs off a group
  // parked at z -41.2. Differencing the two sent the plates along an arbitrary
  // axis, mostly BACKWARDS, where the tile's opaque back plate depth-tested the
  // top plate's logo away and the stack appeared to lose its mark on hover.
  vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
  mv.xyz += normalize(-mv.xyz) * sep;

  // Moving straight down the view ray only changes SCALE, so the peel needs a
  // lateral component to be legible at all.
  float fan = stagger * aStack.y * (vLayerT - 0.5) * 2.0;
  mv.xy += vec2(fan * 0.60, fan * 0.42);

  // Only the top plate grows much. The base staying put is what sells the top
  // being lifted OFF something rather than the whole thing swelling.
  float grow = 1.0 + hover * (0.06 + vTop * 0.10);
  mv.xy += position.xy * aParams.x * grow;

  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
precision mediump float;

in highp vec2 vUv;
in vec3 vColor;
in vec2 vState;
in highp vec2 vCellOrigin;
in float vLayerT;
in float vTop;
in float vPhase;

uniform highp sampler2D uAtlas;
// uCols and uTime are highp in the vertex stage. A uniform shared between
// stages MUST carry the same precision qualifier or the program will not link.
uniform highp float uCols;
uniform highp float uTime;

out vec4 fragColor;

float roundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
  // NOTE: QUAD_UVS is V-inverted, so p.y is POSITIVE DOWNWARD in world terms.
  vec2 p = (vUv - 0.5) * 2.0;
  float hover = vState.x;
  float opacity = vState.y;

  // A machined plate, not a hex: the marks should speak the same language as
  // the rounded rectangles around them.
  //
  // The plates stay TRANSPARENT to each other. Additive blending has no
  // occlusion of its own, and the lower plates showing through the face of the
  // hovered one is the point: it reads as an assembly you are seeing into
  // rather than as a stack of opaque cards.
  float d = roundRect(p, vec2(0.86), 0.30);

  float rim = 1.0 - smoothstep(0.0, 0.045, abs(d));
  float face = 1.0 - smoothstep(-0.03, 0.02, d);

  // --- the logo, TOP PLATE ONLY ---
  vec2 luv = (vUv - 0.5) / 0.70 + 0.5;
  float inside = step(0.0, luv.x) * step(luv.x, 1.0)
               * step(0.0, luv.y) * step(luv.y, 1.0);
  // NO v flip here. QUAD_UVS is already V-inverted (see rain/quad.ts), so
  // vUv.y is 0 at the quad's TOP, and the atlas is uploaded with flipY off, so
  // texture v 0 is the cell's top row. The two line up as they are — flipping
  // again is what had every logo in the app rendering upside down.
  vec2 auv = vCellOrigin + vec2(luv.x, luv.y) / uCols;
  float logo = texture(uAtlas, auv).a * inside * vTop;

  // --- the guts, on every plate BELOW the top one ---
  // Keyed to the plate's own depth, so no two look alike once they part.
  float lower = 1.0 - vTop;
  float traceY = 0.18 + vLayerT * 0.34;
  float trace = (1.0 - smoothstep(0.012, 0.030, abs(abs(p.y) - traceY))) * face;
  float via = 1.0 - smoothstep(0.050, 0.075, length(p - vec2(0.34, -0.28)));
  float guts = (trace * 0.45 + via * 0.80) * lower;

  // A closed stack still has a front and a back.
  float depthFade = mix(0.34, 1.0, vLayerT);
  // The gap lights up as the plates part.
  float split = hover * lower * 0.5;
  float scan = 0.94 + 0.06 * sin(vUv.y * 26.0 - uTime * 1.6 + vPhase * 6.283);

  float intensity = (0.55 + hover * 0.65 + split) * depthFade * scan;
  float a = (rim * 0.95 + guts + logo * 1.25 + face * 0.06) * intensity * opacity;
  if (a < 0.004) discard;

  // The mark burns brighter than its plate so it stays legible under bloom.
  vec3 col = vColor * (rim * 0.9 + guts + face * 0.06)
           + mix(vColor, vec3(1.0), 0.5) * logo;
  fragColor = vec4(col * intensity * opacity, a);
}
`;

let material: THREE.RawShaderMaterial | null = null;
function getStackMaterial() {
  if (!material) {
    material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      transparent: true,
      // Order-independent, which is the point: sixteen overlapping plates in a
      // single instanced draw can never be sorted, and additive does not care.
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      uniforms: {
        uAtlas: { value: null },
        uCols: { value: 1 },
        uTime: { value: 0 },
      },
    });
  }
  return material;
}

export interface StackItem {
  /** Hover key, matched against `hoveredId`. */
  id: string;
  /** Key into the mark atlas. */
  markId: string;
  color: string;
  position: [number, number, number];
  /** Full plate width in world units. */
  size: number;
  /** Plates in the assembly. 1 is a plain plate with no stack behaviour. */
  layers?: number;
  /** How far the top plate lifts toward the camera at full hover. */
  spread?: number;
  /** Lateral fan. Without it the lift is pure scale and reads as a zoom. */
  fan?: number;
}

export function MarkStack({
  items,
  hoveredId,
  hiddenId,
  opacity = 1,
}: {
  items: StackItem[];
  hoveredId?: string | null;
  /** Fades one mark out where it stands — for a mark that has docked elsewhere. */
  hiddenId?: string | null;
  opacity?: number;
}) {
  const [atlas, setAtlas] = useState<MarkAtlas | null>(null);
  const markIds = useMemo(() => items.map((i) => i.markId), [items]);

  useEffect(() => {
    let alive = true;
    void buildMarkAtlas(markIds).then((a) => alive && setAtlas(a));
    return () => { alive = false; };
  }, [markIds]);

  const stateRef = useRef<Float32Array | null>(null);
  /** Instance index -> index in `items`, so hover is resolved once per plate. */
  const ownerRef = useRef<Int32Array | null>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  const geometry = useMemo(() => {
    if (!atlas) return null;

    const plates: { item: StackItem; layer: number; count: number; owner: number }[] = [];
    items.forEach((it, owner) => {
      const count = Math.max(1, it.layers ?? 1);
      for (let l = 0; l < count; l++) plates.push({ item: it, layer: l, count, owner });
    });

    const n = plates.length;
    const offset = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const state = new Float32Array(n * 2);
    const params = new Float32Array(n * 4);
    const stackAttr = new Float32Array(n * 2);
    const cell = new Float32Array(n);
    const owner = new Int32Array(n);
    const c = new THREE.Color();

    plates.forEach((pl, i) => {
      const t = pl.item;
      offset[i * 3] = t.position[0];
      offset[i * 3 + 1] = t.position[1];
      offset[i * 3 + 2] = t.position[2];
      c.set(t.color);
      color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b;
      state[i * 2] = 0;                      // hover
      state[i * 2 + 1] = opacityRef.current;
      params[i * 4] = t.size;
      params[i * 4 + 1] = (pl.owner * 0.37) % 1;
      params[i * 4 + 2] = pl.layer;
      params[i * 4 + 3] = pl.count;
      stackAttr[i * 2] = t.spread ?? 0.34;
      stackAttr[i * 2 + 1] = t.fan ?? 0.18;
      cell[i] = atlas.index[t.markId] ?? 0;
      owner[i] = pl.owner;
    });

    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS, 2));
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3));
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    const st = new THREE.InstancedBufferAttribute(state, 2);
    st.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aState', st);
    g.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
    g.setAttribute('aStack', new THREE.InstancedBufferAttribute(stackAttr, 2));
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 1));
    g.instanceCount = n;
    // The plates move in the shader, so a fitted bounds would cull them the
    // moment they lift.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    stateRef.current = state;
    ownerRef.current = owner;
    return g;
  }, [items, atlas]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  const mat = atlas ? getStackMaterial() : null;

  useFrame((_, delta) => {
    if (!mat || !geometry) return;
    // ASSIGN F.time, never accumulate: the material is a module-level singleton
    // and every mounted instance runs this callback.
    mat.uniforms.uTime.value = F.time;

    const state = stateRef.current;
    const owner = ownerRef.current;
    if (!state || !owner) return;

    let dirty = false;
    for (let i = 0; i < owner.length; i++) {
      const target = hoveredId != null && items[owner[i]].id === hoveredId ? 1 : 0;
      const si = i * 2;
      const cur = state[si];
      if (Math.abs(cur - target) > 0.002) {
        // Fast to acquire, slow to settle: the stack snaps open and eases shut.
        state[si] = damp(cur, target, target > cur ? 12 : 7, delta);
        dirty = true;
      } else if (cur !== target) {
        state[si] = target;
        dirty = true;
      }
      const wantOpacity = opacity * (hiddenId != null && items[owner[i]].id === hiddenId ? 0 : 1);
      if (Math.abs(state[si + 1] - wantOpacity) > 0.002) {
        state[si + 1] = damp(state[si + 1], wantOpacity, 9, delta);
        dirty = true;
      } else if (state[si + 1] !== wantOpacity) {
        state[si + 1] = wantOpacity;
        dirty = true;
      }
    }
    if (dirty) (geometry.getAttribute('aState') as THREE.BufferAttribute).needsUpdate = true;
  });

  if (!mat || !geometry || !atlas) return null;
  return (
    <mesh
      geometry={geometry}
      material={mat}
      frustumCulled={false}
      raycast={() => null}
      onBeforeRender={() => {
        // This mount's own atlas, pushed at draw time. Assigning it at render
        // time instead would let whichever MarkStack rendered last decide the
        // atlas for BOTH, and two sections are on screen together at 0.30-0.42.
        mat.uniforms.uAtlas.value = atlas.texture;
        mat.uniforms.uCols.value = atlas.cols;
      }}
    />
  );
}
