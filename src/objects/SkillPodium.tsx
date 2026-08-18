import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildMarkAtlas, type MarkAtlas } from './markAtlas';
import { QUAD_POSITIONS, QUAD_UVS } from '@/rain/quad';
import { F } from '@/state/frameState';
import { cachedGeometry } from './resources';

/**
 * A skill, taken off the lattice and stood on a plinth.
 *
 * Two parts, both analytic: a squat cylinder that sweeps a lit arc around
 * itself, and the mark hovering over it on a plate that YAWS. The plate is a
 * real rotation in world space, not the view-space billboard the lattice marks
 * use — turning edge-on and thinning to a line is the whole reason it reads as
 * a hologram on a turntable rather than a sticker that happens to be spinning.
 *
 * Both materials are module-level singletons, so a podium costs two draws
 * however many times it is mounted. Per-instance values go through
 * onBeforeRender, the same contract HoloPanel and StatBar use.
 */

/* ------------------------------- the plinth ------------------------------ */

const plinthVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const plinthFrag = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  varying vec3 vLocal;
  uniform float uTime, uOpacity, uSpin, uCap;
  uniform vec3 uColor;

  void main() {
    if (uCap > 0.5) {
      // Disc face. CircleGeometry's uv spans its bounding square, so recentre
      // it and throw away everything outside the radius.
      vec2 q = (vUv - 0.5) * 2.0;
      float r = length(q);
      if (r > 1.0) discard;
      float ang = atan(q.y, q.x) / 6.2831853 + 0.5;
      float capSweep = fract(ang - uTime * uSpin);
      float capHead = smoothstep(0.94, 1.0, capSweep);
      float capRings = smoothstep(0.44, 0.5, abs(fract(r * 5.0) - 0.5)) * 0.26;
      float capEdge = smoothstep(0.88, 0.99, r);
      float capA = (capHead * 0.35 + capRings + capEdge * 1.1 + 0.05) * uOpacity;
      if (capA < 0.004) discard;
      gl_FragColor = vec4(uColor * capA, capA);
      return;
    }

    // Cylinder uv: x runs around the circumference, y up the wall.
    float around = vUv.x;
    float up = vUv.y;

    // A lit arc chasing round the wall, which is what sells the rotation on a
    // shape that is otherwise rotationally symmetric and would look still.
    float sweep = fract(around - uTime * uSpin);
    float head = smoothstep(0.88, 1.0, sweep);
    float tail = smoothstep(0.0, 0.55, sweep) * 0.25;

    // Stacked machining rings up the wall.
    float rings = smoothstep(0.45, 0.5, abs(fract(up * 6.0) - 0.5)) * 0.35;

    // Both rims read brighter, the way a turned edge catches light.
    float rim = (1.0 - smoothstep(0.0, 0.12, up)) + (1.0 - smoothstep(0.0, 0.12, 1.0 - up));

    float a = (head * 0.9 + tail + rings + rim * 0.7) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

let plinthMat: THREE.ShaderMaterial | null = null;
function getPlinthMaterial() {
  if (plinthMat) return plinthMat;
  plinthMat = new THREE.ShaderMaterial({
    vertexShader: plinthVert,
    fragmentShader: plinthFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    // Screen-space, like the scrim it stands on: the camera is inside the
    // lattice and world geometry would otherwise punch through the plinth.
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uSpin: { value: 0.18 },
      uCap: { value: 0 },
      uColor: { value: new THREE.Color('#00d93f') },
    },
  });
  return plinthMat;
}

/* ------------------------------ the hologram ----------------------------- */

const holoVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const holoFrag = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uAtlas;
  uniform vec2 uCell;      // cell origin in uv
  uniform float uCols, uTime, uOpacity, uFacing;
  uniform vec3 uColor;

  void main() {
    // Same orientation contract as MarkStack: QUAD_UVS is V-inverted and the
    // atlas is uploaded flipY off, so the two already agree. No V flip here.
    //
    // U is another matter. A flat plate turned past ninety degrees shows its
    // BACK, and a back face samples the mark reversed — physically right, and
    // it reads as a bug every time, because a logo printed backwards just looks
    // broken. Mirroring u on the far side keeps the mark legible all the way
    // round, which is what a projected hologram would do anyway.
    vec2 quv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
    vec2 auv = uCell + quv / uCols;
    float mark = texture2D(uAtlas, auv).a;

    // Interference lines drifting up the plate.
    float scan = 0.72 + 0.28 * sin(vUv.y * 90.0 - uTime * 3.0);
    // A brighter band sweeping through, like a refresh pass.
    float band = smoothstep(0.86, 1.0, fract(vUv.y * 0.5 + uTime * 0.11)) * 0.5;

    // Overdriven on purpose. This is additive over a scrim that is itself over
    // the rain, so the mark competes with a lit background rather than the black
    // it was tuned against; at unity it read as a ghost. Above 1 also puts it
    // over the bloom threshold, which is what gives it the projector halo.
    float a = mark * (scan + band) * uOpacity * uFacing * 1.7;
    if (a < 0.004) discard;
    // Hot core, coloured halo: a projection, not a printed logo.
    vec3 col = mix(uColor, vec3(1.0), 0.35 + band);
    gl_FragColor = vec4(col * a, a);
  }
`;

let holoMat: THREE.ShaderMaterial | null = null;
function getHoloMaterial() {
  if (holoMat) return holoMat;
  holoMat = new THREE.ShaderMaterial({
    vertexShader: holoVert,
    fragmentShader: holoFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uAtlas: { value: null },
      uCell: { value: new THREE.Vector2() },
      uCols: { value: 1 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uFacing: { value: 1 },
      uColor: { value: new THREE.Color('#00d93f') },
    },
  });
  return holoMat;
}

/* --------------------------------- geometry -------------------------------- */

function podiumGeometry(radius: number, height: number) {
  return cachedGeometry(`podium-${radius}-${height}`, () => {
    const g = new THREE.CylinderGeometry(radius, radius * 1.12, height, 48, 1, true);
    return g;
  });
}

function capGeometry(radius: number) {
  return cachedGeometry(`podium-cap-${radius}`, () => new THREE.CircleGeometry(radius, 48));
}

function holoQuad() {
  return cachedGeometry('podium-holo-quad', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS, 2));
    return g;
  });
}

export function SkillPodium({
  markIds,
  markId,
  color,
  size = 2.0,
  radius = 1.5,
  height = 0.42,
  opacity = 1,
  spin = 0.9,
  renderOrder = 0,
}: {
  /** Every mark the atlas must carry. Pass the SAME array every render. */
  markIds: string[];
  /** Which of them to project. */
  markId: string;
  color: string;
  /** Width of the hologram plate. */
  size?: number;
  radius?: number;
  height?: number;
  opacity?: number;
  /** Turns per second of the hologram. */
  spin?: number;
  /** Base render order; the hologram draws two above it. */
  renderOrder?: number;
}) {
  const [atlas, setAtlas] = useState<MarkAtlas | null>(null);

  useEffect(() => {
    let alive = true;
    void buildMarkAtlas(markIds).then((a) => alive && setAtlas(a));
    return () => { alive = false; };
  }, [markIds]);

  const plinth = getPlinthMaterial();
  const holo = getHoloMaterial();
  const plinthGeo = podiumGeometry(radius, height);
  const capGeo = capGeometry(radius);
  const quad = holoQuad();
  const holoRef = useRef<THREE.Mesh>(null);
  const yaw = useRef(0);

  const cell = useMemo(() => {
    if (!atlas) return null;
    const i = atlas.index[markId] ?? 0;
    return new THREE.Vector2((i % atlas.cols) / atlas.cols, Math.floor(i / atlas.cols) / atlas.cols);
  }, [atlas, markId]);

  useFrame((_, delta) => {
    // F.time is reduced-motion aware and must be ASSIGNED, never accumulated:
    // these materials are singletons and every mount runs this callback.
    plinth.uniforms.uTime.value = F.time;
    holo.uniforms.uTime.value = F.time;

    const m = holoRef.current;
    if (!m) return;
    // The yaw IS integrated, because it belongs to this mesh's transform rather
    // than to the shared material — there is nothing to double-advance.
    yaw.current = (yaw.current + delta * spin) % (Math.PI * 2);
    m.rotation.y = yaw.current;
  });

  if (!atlas || !cell) return null;

  return (
    <group>
      <mesh
        geometry={plinthGeo}
        material={plinth}
        position={[0, -size * 0.70, 0]}
        renderOrder={renderOrder}
        raycast={() => null}
        onBeforeRender={() => {
          plinth.uniforms.uCap.value = 0;
          plinth.uniforms.uOpacity.value = opacity;
          (plinth.uniforms.uColor.value as THREE.Color).set(color);
        }}
      />
      <mesh
        geometry={capGeo}
        material={plinth}
        position={[0, -size * 0.70 + height * 0.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={renderOrder + 1}
        raycast={() => null}
        onBeforeRender={() => {
          plinth.uniforms.uCap.value = 1;
          plinth.uniforms.uOpacity.value = opacity * 0.9;
          (plinth.uniforms.uColor.value as THREE.Color).set(color);
        }}
      />
      <mesh
        ref={holoRef}
        geometry={quad}
        material={holo}
        scale={[size, size, 1]}
        renderOrder={renderOrder + 2}
        raycast={() => null}
        onBeforeRender={() => {
          holo.uniforms.uAtlas.value = atlas.texture;
          holo.uniforms.uCols.value = atlas.cols;
          (holo.uniforms.uCell.value as THREE.Vector2).copy(cell);
          (holo.uniforms.uColor.value as THREE.Color).set(color);
          holo.uniforms.uOpacity.value = opacity;
          // Thins toward nothing as the plate turns edge-on, so the rotation
          // reads as a flat projection being turned rather than a solid card.
          const c = Math.abs(Math.cos(yaw.current));
          holo.uniforms.uFacing.value = 0.25 + 0.75 * c;
        }}
      />
    </group>
  );
}
