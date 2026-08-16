import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { QUAD_POSITIONS, QUAD_UVS } from '@/rain/quad';
import { buildMarkAtlas, type MarkAtlas } from './markAtlas';
import { F } from '@/state/frameState';

/**
 * Interactive hex tiles carrying a real brand logo, in ONE instanced draw.
 *
 * Hex frame, proficiency gauge arc, logo and neon glow are all produced by a
 * single shader on a single quad per tile, so N tiles cost one draw call
 * regardless of N. That is what lets the Skills section scale to any number of
 * skills, and lets the same component serve the social widgets.
 *
 * Per-tile state (hover, active, gauge value) rides on instanced attributes,
 * never on separate materials.
 */

const vertexShader = /* glsl */ `
precision highp float;

in vec3 position;
in vec2 uv;
in vec3 aOffset;
in vec3 aColor;
in vec4 aState;   // x hover, y active, z gaugeValue, w cell index
in vec2 aParams;  // x size scale, y phase

uniform mat4 modelViewMatrix, projectionMatrix;
uniform float uTime, uSize, uCols, uBillboard;
uniform vec3 uCamPos;

out vec2 vUv;
out vec3 vColor;
out vec4 vState;
out vec2 vCellOrigin;

void main() {
  vUv = uv;
  vColor = aColor;
  vState = aState;

  float cell = aState.w;
  vCellOrigin = vec2(mod(cell, uCols), floor(cell / uCols)) / uCols;

  // hovered tiles lift toward the viewer and grow
  float lift = aState.x * 0.9 + aState.y * 1.6;
  float grow = 1.0 + aState.x * 0.18 + aState.y * 0.34;
  float bob = sin(uTime * 0.8 + aParams.y * 6.283) * 0.16;

  vec3 world = aOffset + vec3(0.0, bob, 0.0);
  vec3 toCam = normalize(uCamPos - world);
  world += toCam * lift;

  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  mv.xy += position.xy * uSize * aParams.x * grow;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
precision mediump float;

in highp vec2 vUv;
in vec3 vColor;
in vec4 vState;
in highp vec2 vCellOrigin;

uniform highp sampler2D uAtlas;
// uCols and uTime are highp in the vertex stage. A uniform shared between
// stages MUST carry the same precision qualifier or the program will not link.
uniform highp float uCols;
uniform highp float uTime;
uniform float uOpacity, uGauge;

out vec4 fragColor;

/** Hexagon distance in normalised tile space. */
float hexDist(vec2 p) {
  p = abs(p);
  return max(p.x * 0.8660254 + p.y * 0.5, p.y);
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float hover = vState.x;
  float act = vState.y;   // NOT "active" - that is a reserved word in GLSL ES
  float value = vState.z;

  float hd = hexDist(p);

  // --- hex frame ---
  float ring = (1.0 - smoothstep(0.90, 0.98, hd)) - (1.0 - smoothstep(0.78, 0.86, hd));
  ring = max(ring, 0.0);

  // --- gauge arc: 240 degrees, charges to the tile value ---
  float ang = atan(p.y, p.x);                 // -PI..PI
  float a01 = (ang + 3.14159265) / 6.2831853; // 0..1 CCW from -X
  // rotate so the gauge starts bottom-left and sweeps 240deg
  float sweep = fract(a01 + 0.6667);
  float onArc = step(sweep, 0.6667);
  float r = length(p);
  float band = (1.0 - smoothstep(0.99, 1.06, r)) - (1.0 - smoothstep(0.90, 0.96, r));
  band = max(band, 0.0) * onArc * uGauge;
  float filled = step(sweep, 0.6667 * value);
  float gauge = band * mix(0.14, 1.0, filled);

  // --- logo from the shared atlas ---
  // inset so the mark sits inside the hex with breathing room
  vec2 luv = (vUv - 0.5) / 0.62 + 0.5;
  float inside = step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0);
  vec2 auv = vCellOrigin + vec2(luv.x, 1.0 - luv.y) / uCols;
  float logo = texture(uAtlas, auv).a * inside;

  // --- interior wash + scan ---
  float body = 1.0 - smoothstep(0.80, 0.88, hd);
  float scan = 0.55 + 0.45 * sin(vUv.y * 34.0 - uTime * 2.2);
  float wash = body * (0.05 + hover * 0.10 + act * 0.18) * scan;

  float pulse = 0.85 + 0.15 * sin(uTime * 3.0);
  float intensity = (0.55 + hover * 0.6 + act * 1.0) * pulse;

  float a = (ring * 0.9 + gauge * 0.85 + logo * 1.15 + wash) * intensity * uOpacity;
  if (a < 0.004) discard;

  // the logo burns brighter than its frame so the mark stays legible
  vec3 col = vColor * (ring * 0.9 + gauge + wash) + mix(vColor, vec3(1.0), 0.45) * logo;
  fragColor = vec4(col * intensity * uOpacity, a);
}
`;

let material: THREE.RawShaderMaterial | null = null;
function getTileMaterial(atlas: THREE.Texture, cols: number) {
  if (!material) {
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
        uAtlas: { value: atlas },
        uCols: { value: cols },
        uTime: { value: 0 },
        uSize: { value: 1.6 },
        uOpacity: { value: 1 },
        uGauge: { value: 1 },
        uBillboard: { value: 1 },
        uCamPos: { value: new THREE.Vector3() },
      },
    });
  }
  material.uniforms.uAtlas.value = atlas;
  material.uniforms.uCols.value = cols;
  return material;
}

export interface MarkTile {
  id: string;
  /** Key into the mark atlas (skill id or social id). */
  markId: string;
  color: string;
  position: [number, number, number];
  /** 0..1 gauge fill. Ignored when `gauge` is false. */
  value?: number;
  scale?: number;
}

export function MarkTiles({
  tiles,
  hoveredId,
  activeId,
  size = 1.7,
  gauge = true,
  opacity = 1,
}: {
  tiles: MarkTile[];
  hoveredId?: string | null;
  activeId?: string | null;
  size?: number;
  gauge?: boolean;
  opacity?: number;
}) {
  const [atlas, setAtlas] = useState<MarkAtlas | null>(null);
  const markIds = useMemo(() => tiles.map((t) => t.markId), [tiles]);

  useEffect(() => {
    let alive = true;
    void buildMarkAtlas(markIds).then((a) => alive && setAtlas(a));
    return () => { alive = false; };
  }, [markIds]);

  const stateRef = useRef<Float32Array | null>(null);

  const geometry = useMemo(() => {
    if (!atlas) return null;
    const n = tiles.length;
    const offset = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const state = new Float32Array(n * 4);
    const params = new Float32Array(n * 2);
    const c = new THREE.Color();

    tiles.forEach((t, i) => {
      offset[i * 3] = t.position[0];
      offset[i * 3 + 1] = t.position[1];
      offset[i * 3 + 2] = t.position[2];
      c.set(t.color);
      color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b;
      state[i * 4 + 0] = 0;                        // hover
      state[i * 4 + 1] = 0;                        // active
      state[i * 4 + 2] = t.value ?? 1;             // gauge target
      state[i * 4 + 3] = atlas.index[t.markId] ?? 0;
      params[i * 2] = t.scale ?? 1;
      params[i * 2 + 1] = (i * 0.37) % 1;
    });

    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS, 2));
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3));
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    const st = new THREE.InstancedBufferAttribute(state, 4);
    st.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aState', st);
    g.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 2));
    g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    stateRef.current = state;
    return g;
  }, [tiles, atlas]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  const ref = useRef<THREE.Mesh>(null);
  const mat = atlas ? getTileMaterial(atlas.texture, atlas.cols) : null;

  useFrame(({ camera }, delta) => {
    if (!mat || !geometry) return;
    mat.uniforms.uTime.value = F.time;
    mat.uniforms.uSize.value = size;
    mat.uniforms.uOpacity.value = opacity;
    mat.uniforms.uGauge.value = gauge ? 1 : 0;
    (mat.uniforms.uCamPos.value as THREE.Vector3).copy(camera.position);

    const state = stateRef.current;
    if (!state) return;
    let dirty = false;
    tiles.forEach((t, i) => {
      const h = hoveredId === t.id ? 1 : 0;
      const a = activeId === t.id ? 1 : 0;
      const k = Math.min(1, delta * 8);
      const ci = i * 4;
      if (Math.abs(state[ci] - h) > 0.002) { state[ci] += (h - state[ci]) * k; dirty = true; }
      if (Math.abs(state[ci + 1] - a) > 0.002) { state[ci + 1] += (a - state[ci + 1]) * k; dirty = true; }
    });
    if (dirty) (geometry.getAttribute('aState') as THREE.BufferAttribute).needsUpdate = true;
  });

  if (!mat || !geometry) return null;
  return <mesh ref={ref} geometry={geometry} material={mat} frustumCulled={false} raycast={() => null} />;
}
