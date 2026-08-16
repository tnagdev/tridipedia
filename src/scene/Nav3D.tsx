import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SECTIONS } from '@/state/sections';
import { scrollToProgress } from '@/scroll/ScrollProvider';
import { F } from '@/state/frameState';
import { TerminalText } from '@/text/TerminalText';
import { PALETTE } from '@/text/palette';

/**
 * The 3D top navigation.
 *
 * Parented to the camera so it rides along as a real object inside the world
 * rather than a DOM layer pasted over it. Six extruded hex chips on a rail;
 * the active one lights and spins, and the rail fills to show progress.
 *
 * depthTest is off and renderOrder is high so the rain can never occlude it —
 * navigation that disappears behind weather is not navigation.
 *
 * ACCESSIBILITY: this is a visual affordance only. The keyboard and
 * screen-reader path is the .sr-only nav plus A11yLayer, which stay in the DOM.
 * A canvas-only nav would be unusable without a mouse.
 */

const CHIP_W = 0.064;
const CHIP_H = 0.064;
const GAP = 0.205;
const NAV_Z = -1.05; // just inside the near plane
/** How far up the frame the bar sits, as a fraction of the visible half-height. */
const NAV_TOP = 0.80;
/** Rail height relative to the nav group origin. */
const RAIL_Y = -0.03;

const vertexShader = /* glsl */ `
precision highp float;

in vec3 position;
in vec2 uv;
in vec3 aOffset;
in vec3 aState;   // x active 0..1, y hover 0..1, z index

uniform mat4 modelViewMatrix, projectionMatrix;
uniform float uTime, uW, uH;

out vec2 vUv;
out float vActive, vHover;

void main() {
  vUv = uv;
  vActive = aState.x;
  vHover = aState.y;

  // Active chip tilts and lifts; hovered chip lifts slightly.
  float lift = aState.x * 0.012 + aState.y * 0.008;
  float spin = aState.x * sin(uTime * 1.4 + aState.z) * 0.30;

  vec3 p = vec3(position.x * uW, position.y * uH, 0.0);
  // rotate about Y for the spin
  float c = cos(spin), s = sin(spin);
  p = vec3(p.x * c, p.y, p.x * s);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(aOffset + p + vec3(0.0, lift, 0.0), 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision mediump float;

in vec2 vUv;
in float vActive, vHover;

uniform float uTime;
uniform vec3 uIdle, uLive;

out vec4 fragColor;

/** Signed distance to a hexagon, in normalised chip space. */
float hex(vec2 p) {
  p = abs(p);
  return max(p.x * 0.866 + p.y * 0.5, p.y);
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float d = hex(p);

  float edge = 1.0 - smoothstep(0.86, 0.98, d);
  float inner = 1.0 - smoothstep(0.60, 0.72, d);
  float ring = edge - inner;

  // Active chips get a filled, scanning core.
  float scan = 0.6 + 0.4 * sin(vUv.y * 26.0 - uTime * 3.2);
  float core = inner * (0.10 + vActive * 0.42 * scan + vHover * 0.16);

  float a = ring * (0.95 + vActive * 0.75 + vHover * 0.5) + core;
  if (a < 0.004) discard;

  vec3 col = mix(uIdle, uLive, clamp(vActive + vHover * 0.6, 0.0, 1.0));
  fragColor = vec4(col * a, a);
}
`;

let chipMaterial: THREE.RawShaderMaterial | null = null;
function getChipMaterial() {
  if (chipMaterial) return chipMaterial;
  chipMaterial = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false, // never let the rain occlude the navigation
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uW: { value: CHIP_W },
      uH: { value: CHIP_H },
      uIdle: { value: new THREE.Color(PALETTE.text) },
      uLive: { value: new THREE.Color(PALETTE.textBright) },
    },
  });
  return chipMaterial;
}

const QUAD = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
const QUAD_UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);

export function Nav3D() {
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const stateRef = useRef<Float32Array | null>(null);
  const railRef = useRef<THREE.Mesh>(null);

  const n = SECTIONS.length;
  const xs = useMemo(() => SECTIONS.map((_, i) => (i - (n - 1) / 2) * GAP), [n]);

  const geometry = useMemo(() => {
    const offset = new Float32Array(n * 3);
    const state = new Float32Array(n * 3);
    xs.forEach((x, i) => {
      // Y and Z live on the parent group, which is repositioned every frame
      // from the camera's CURRENT fov — the fov is keyframed from 55 to 78
      // across the journey, so anything pinned at a fixed Y drifts down the
      // frame and ends up sitting on top of the content.
      offset[i * 3] = x;
      // Nodes sit ON the rail, like stations on a line, rather than floating
      // above it — the rail then reads as a route with stops, not two
      // unrelated rows of decoration.
      offset[i * 3 + 1] = RAIL_Y;
      offset[i * 3 + 2] = 0;
      state[i * 3 + 2] = i;
    });
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(QUAD, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(QUAD_UV, 2));
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3));
    const st = new THREE.InstancedBufferAttribute(state, 3);
    st.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aState', st);
    g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
    stateRef.current = state;
    return g;
  }, [n, xs]);

  const mat = getChipMaterial();

  useFrame((_, delta) => {
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    mat.uniforms.uTime.value = F.time;

    // Keep the bar pinned to the top of frame whatever the fov is doing, and
    // shrink it on narrow viewports so it never overruns the edges.
    const g = group.current;
    if (g) {
      const cam = camera as THREE.PerspectiveCamera;
      const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5) * Math.abs(NAV_Z);
      const halfW = halfH * cam.aspect;
      const span = (xs[n - 1] - xs[0]) + CHIP_W;
      const fit = Math.min(1, (halfW * 1.62) / span);
      g.position.set(0, halfH * NAV_TOP, NAV_Z);
      g.scale.setScalar(fit);
    }

    const state = stateRef.current;
    if (state) {
      for (let i = 0; i < n; i++) {
        const [a, b] = SECTIONS[i].range;
        const isActive = F.smooth >= a && F.smooth < b ? 1 : 0;
        const isHover = hovered === i ? 1 : 0;
        state[i * 3] += (isActive - state[i * 3]) * Math.min(1, delta * 7);
        state[i * 3 + 1] += (isHover - state[i * 3 + 1]) * Math.min(1, delta * 9);
      }
      (geometry.getAttribute('aState') as THREE.BufferAttribute).needsUpdate = true;
    }

    // Rail fills left-to-right with journey progress.
    const rail = railRef.current;
    if (rail) {
      const span = xs[n - 1] - xs[0] + CHIP_W;
      rail.scale.x = Math.max(0.001, F.smooth);
      rail.position.x = xs[0] - CHIP_W / 2 + (span * F.smooth) / 2;
    }
  });

  // Parenting to the camera is what makes it ride along without per-frame maths.
  return (
    <primitive object={camera}>
      <group ref={group} renderOrder={999}>
        <mesh geometry={geometry} material={mat} frustumCulled={false} renderOrder={999} raycast={() => null} />

        {/* rail: unfilled track + filled progress */}
        <mesh position={[0, RAIL_Y, 0]} renderOrder={998} raycast={() => null}>
          <planeGeometry args={[xs[n - 1] - xs[0] + CHIP_W, 0.0026]} />
          <meshBasicMaterial color={PALETTE.textDim} transparent opacity={0.28} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh ref={railRef} position={[0, RAIL_Y, -0.001]} renderOrder={999} raycast={() => null}>
          <planeGeometry args={[xs[n - 1] - xs[0] + CHIP_W, 0.0042]} />
          <meshBasicMaterial color={PALETTE.text} transparent opacity={0.9} depthTest={false} toneMapped={false} />
        </mesh>

        {SECTIONS.map((s, i) => (
          <group key={s.id}>
            <TerminalText
              position={[xs[i], RAIL_Y - 0.062, 0]}
              fontSize={0.0215}
              color={hovered === i ? PALETTE.textBright : PALETTE.text}
              outlineWidth={0.0035}
              material-depthTest={false}
              renderOrder={1000}
              letterSpacing={0.14}
            >
              {s.label.toUpperCase()}
            </TerminalText>

            {/* invisible hit target — sized generously for comfortable clicking */}
            <mesh
              position={[xs[i], RAIL_Y - 0.03, 0.002]}
              visible={false}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(i);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHovered((h) => (h === i ? null : h));
                document.body.style.cursor = 'auto';
              }}
              onClick={(e) => {
                e.stopPropagation();
                history.replaceState(null, '', `#${s.id}`);
                scrollToProgress(s.range[0] + 0.012, { duration: 2.2 });
              }}
            >
              <planeGeometry args={[GAP * 0.94, 0.17]} />
            </mesh>
          </group>
        ))}
      </group>
    </primitive>
  );
}
