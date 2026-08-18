import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SECTIONS } from '@/state/sections';
import { scrollToProgress } from '@/scroll/ScrollProvider';
import { F } from '@/state/frameState';
import { TerminalText } from '@/text/TerminalText';
import { PALETTE } from '@/text/palette';
import { buildMarkAtlas, type MarkAtlas } from '@/objects/markAtlas';
import { navMarkId } from '@/objects/navMarks';
import { NineSlice } from '@/objects/NineSlice';
import type { TroikaText } from '@/text/TerminalText';

/**
 * The navigation.
 *
 * A quiet column down the LEFT edge — not a bar across the top, where the copy
 * lives as the camera flies into each room. Six icons; hovering slides it open
 * to show the labels. Nothing else: no decoration that does not say where you
 * are or where you can go.
 *
 * Drawn as HUD line-work, not lighting: one nine-sliced frame around the whole
 * column, and rows that are nothing but an icon and a label. Exactly ONE shape is
 * filled — the live section — with its icon and label knocked out dark against
 * it. No glow anywhere: bloom multiplies whatever this draws, and every earlier
 * attempt at a lit row smeared into the copy sitting on top of it.
 *
 * Every silhouette is an exact distance field, antialiased against the real
 * on-screen pixel size, so each line is one clean pixel at any fov or viewport.
 *
 * The housing is OPAQUE, so the rain and the content are cut off behind it
 * rather than showing through — the point of moving it aside.
 *
 * Parented to the camera so it rides along as a real object inside the world
 * rather than a DOM layer pasted over it. depthTest is off and renderOrder is
 * high so nothing can occlude it — navigation that disappears behind weather is
 * not navigation. Everything renders in the transparent queue for that reason:
 * an opaque-pass mesh would be drawn BEFORE the rain and painted over by it,
 * however high its renderOrder.
 *
 * ACCESSIBILITY: this is a visual affordance only. The keyboard and
 * screen-reader path is the .sr-only nav plus A11yLayer, which stay in the DOM.
 * A canvas-only nav would be unusable without a mouse.
 */

const NAV_Z = -1.05; // just inside the near plane
/** Distance from the left edge of the frame, in units at the nav's plane. */
const MARGIN = 0.034;

const N = SECTIONS.length;
const PITCH = 0.106; // row to row
const ICON = 0.044;
// Wide enough for the frame art: its right border alone is over half the source
// image's width, so a narrower rail leaves the middle slice with nothing to do.
const COLLAPSED_W = 0.142;
const EXPANDED_W = 0.355;
const ICON_X = COLLAPSED_W / 2;
const LABEL_X = 0.112;

/** Corner cut on the frame, and the smaller one on each tab. */
const FRAME_CUT = 0.052;
const TAB_CUT = 0.020;
/** Tab metrics, shared by the shader's fills and the sliced frames over them. */
const TAB_INSET = 0.026;
const TAB_H = 0.080;

const PLATE_H = N * PITCH + 0.076;
const ROW_Y = SECTIONS.map((_, i) => ((N - 1) / 2 - i) * PITCH);

/** A hair of padding around the panel so its antialiased edge has room. */
const PAD = 0.008;
const QUAD_H = PLATE_H + PAD * 2;

/**
 * The housing's shader works in QUAD-HEIGHT units — y spans -0.5..0.5 — so
 * every feature keeps a constant world size while the panel slides open and
 * only its x extent changes. The layout above, converted once at module load.
 */
const k = 1 / QUAD_H;
const f = (n: number) => n.toFixed(5);
const Q = {
  panelH: PLATE_H * k,
  pad: PAD * k,
  frameCut: FRAME_CUT * k,
  tabCut: TAB_CUT * k,
  pitch: PITCH * k,
  row0: ROW_Y[0] * k,
  tabH: TAB_H * k,
  inset: TAB_INSET * k,
};

/* ------------------------------ the housing ------------------------------ */

const plateVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const plateFragment = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;

  uniform float uAspect, uPanelW, uActiveY, uHoverY, uHoverOn, uAA;
  uniform vec3 uBody, uAccent;

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }

  /** A box with its top-right corner cut off at 45 degrees — the tab shape. */
  float sdTab(vec2 p, vec2 b, float cut) {
    return max(sdBox(p, b), (p.x + p.y - (b.x + b.y - cut)) * 0.7071);
  }

  void main() {
    // x measured from the quad's left edge, y from its centre — both in units
    // of the quad's height, so nothing stretches as the panel opens.
    float x = vUv.x * uAspect;
    float y = vUv.y - 0.5;

    float halfW = uPanelW * 0.5;
    // Do NOT name this "half": that is a reserved word in GLSL ES, so the
    // shader will not compile — which shows up as the panel simply not
    // being there, with nothing wrong on the JS side.
    vec2 box = vec2(halfW, ${f(Q.panelH)} * 0.5);
    vec2 p = vec2(x - (${f(Q.pad)} + halfW), y);

    // ---- the frame: a box with two opposite corners cut away ----
    float d = sdBox(p, box);
    d = max(d, (-p.x + p.y - (box.x + box.y - ${f(Q.frameCut)})) * 0.7071); // top-left
    d = max(d, ( p.x - p.y - (box.x + box.y - ${f(Q.frameCut)})) * 0.7071); // bottom-right
    float m = 1.0 - smoothstep(-uAA, uAA, d);

    vec3 col = uBody * m;
    float a = m;

    // ---- the fills ----
    // Only the FILLS live here now. Every line — this frame's and every tab's —
    // is nine-sliced from the frame sheet by <NineSlice />, so the corner art is
    // authored once and never stretches, whatever size a container ends up.
    vec2 tab = vec2(halfW - ${f(Q.inset)}, ${f(Q.tabH)} * 0.5);

    // the pointer's tab: barely filled
    float dH = sdTab(vec2(p.x, p.y - uHoverY), tab, ${f(Q.tabCut)});
    col = mix(col, uAccent, (1.0 - smoothstep(-uAA, uAA, dH)) * uHoverOn * 0.12 * m);

    // the live tab: SOLID. One filled shape in the whole panel, so there is
    // never any question which section you are in — and the icon and label on
    // top of it are knocked out dark rather than lit.
    float dA = sdTab(vec2(p.x, p.y - uActiveY), tab, ${f(Q.tabCut)});
    col = mix(col, uAccent, (1.0 - smoothstep(-uAA, uAA, dA)) * 0.92 * m);

    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

let plateMaterial: THREE.ShaderMaterial | null = null;
function getPlateMaterial(): THREE.ShaderMaterial {
  if (plateMaterial) return plateMaterial;
  plateMaterial = new THREE.ShaderMaterial({
    vertexShader: plateVertex,
    fragmentShader: plateFragment,
    // Transparent, but alpha 1 across the body: this puts it in the transparent
    // queue (so it sorts AFTER the rain by renderOrder) while still painting solid.
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: {
      uAspect: { value: 1 },
      uPanelW: { value: COLLAPSED_W / QUAD_H },
      uActiveY: { value: 0 },
      uHoverY: { value: 0 },
      uHoverOn: { value: 0 },
      uAA: { value: 0.002 },
      uBody: { value: new THREE.Color('#04150c') },
      uAccent: { value: new THREE.Color(PALETTE.rain) },
    },
  });
  return plateMaterial;
}

/* -------------------------------- the icons ------------------------------- */

const iconVertex = /* glsl */ `
precision highp float;

in vec3 position;
in vec2 uv;
in vec3 aOffset;
in vec3 aState;   // x active 0..1, y hover 0..1, z index
in float aCell;

uniform mat4 modelViewMatrix, projectionMatrix;
uniform float uSize;

out vec2 vUv;
out float vActive, vHover, vCell;

void main() {
  vUv = uv;
  vActive = aState.x;
  vHover = aState.y;
  vCell = aCell;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aOffset + vec3(position.xy * uSize, 0.0), 1.0);
}
`;

const iconFragment = /* glsl */ `
precision mediump float;

in vec2 vUv;
in float vActive, vHover, vCell;

// uCols is highp in the atlas maths. A uniform shared between stages MUST carry
// the same precision qualifier or the program fails to link.
uniform highp float uCols;
uniform highp sampler2D uAtlas;
uniform vec3 uIdle, uLive, uKnock;

out vec4 fragColor;

void main() {
  vec2 cell = vec2(mod(vCell, uCols), floor(vCell / uCols));
  // The mark atlas is built with flipY:false, so canvas row 0 is v=0. Flip v
  // here or every mark renders upside down (same as MarkTiles).
  float icon = texture(uAtlas, (cell + vec2(vUv.x, 1.0 - vUv.y)) / uCols).a;

  // Opaque on the live tab, because it is KNOCKED OUT of the solid fill: a dark
  // mark can only be painted over bright by covering it, never by adding to it.
  // Premultiplied output, so alpha IS the emitted brightness — dropping it here
  // is what keeps the marks from blooming. The live row is the exception: its
  // mark is knocked out DARK of the filled tab and needs full coverage to read.
  float a = icon * mix(0.42 + vHover * 0.22, 1.0, vActive);
  if (a < 0.004) discard;

  vec3 col = mix(mix(uIdle, uLive, vHover * 0.8), uKnock, vActive);
  fragColor = vec4(col * a, a);
}
`;

let iconMaterial: THREE.RawShaderMaterial | null = null;
function getIconMaterial(): THREE.RawShaderMaterial {
  if (iconMaterial) return iconMaterial;
  iconMaterial = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: iconVertex,
    fragmentShader: iconFragment,
    transparent: true,
    // The fragment writes premultiplied colour, which is what lets a DARK mark
    // sit on the bright tab; straight alpha would multiply it a second time and
    // fringe every glyph.
    premultipliedAlpha: true,
    depthWrite: false,
    depthTest: false, // never let the rain occlude the navigation
    toneMapped: false,
    uniforms: {
      uSize: { value: ICON },
      uCols: { value: 1 },
      uAtlas: { value: null },
      uIdle: { value: new THREE.Color(PALETTE.text) },
      uLive: { value: new THREE.Color(PALETTE.textBright) },
      uKnock: { value: new THREE.Color('#02120a') },
    },
  });
  return iconMaterial;
}

/**
 * Force a troika label into the TRANSPARENT queue.
 *
 * Troika renders with materials it derives itself — `material-*` props never
 * reach them, and the derived pair (fill + outline) defaults to opaque. Opaque
 * objects are drawn before every transparent one, so the housing painted the
 * labels out no matter what renderOrder they carried.
 *
 * Set on the derived materials directly rather than by handing troika a base
 * material: a `material` prop or a material child is bookkept by R3F, which
 * then re-applies what it read back — and what it reads back is troika's ARRAY
 * of two materials, which troika cannot use as a base (it tries to
 * addEventListener on it) and R3F cannot index without geometry groups.
 */
function forceTransparent(t: TroikaText): void {
  const mats = (Array.isArray(t.material) ? t.material : [t.material]) as THREE.Material[];
  for (const m of mats) {
    if (!m || m.transparent) continue;
    m.transparent = true;
    m.depthTest = false;
    m.depthWrite = false;
  }
}

/** The dark the live tab's icon and label are knocked out to. */
const KNOCK = '#02120a';

/**
 * The container's frame art, and its slices — the four numbers straight out of
 *   border-image: url(hud-frame.png) 69 47 38 31 fill / 69px 47px 38px 31px;
 * read top, right, bottom, left, in the image's OWN pixels.
 *
 * FRAME_SCALE is what `/ 69px 47px …` is doing: world units per source pixel.
 * The art is a JPEG, so it has no alpha and is keyed off its own brightness.
 * If the file ever goes missing the frame falls back to the generated sheet.
 */
const FRAME_SRC = '/img/fr1.jpg';
const FRAME_SLICE: [number, number, number, number] = [69, 47, 38, 31];
/**
 * Rendered border widths, top-right-bottom-left. Not slice x scale: the art's
 * right border is over half the source's width, and drawn at that proportion it
 * swallows the column. Narrowing it compresses that strip toward the edge, which
 * is the second half of a border-image declaration doing its job.
 */
const FRAME_BORDER: [number, number, number, number] = [0.060, 0.028, 0.034, 0.026];

const QUAD = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
const QUAD_UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
const MARK_IDS = SECTIONS.map((s) => navMarkId(s.id));

export function Nav3D() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const group = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Mesh>(null);
  const frame = useRef<THREE.Mesh | null>(null);
  const labels = useRef<(TroikaText | null)[]>([]);
  const labelColor = useRef<string[]>([]);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [atlas, setAtlas] = useState<MarkAtlas | null>(null);

  /** Damped 0..1: how far the panel has slid open. */
  const open = useRef(0);
  /** Damped row indices, so the marks SLIDE between rows rather than jumping. */
  const activeRowRef = useRef(0);
  const hoverRowRef = useRef(0);
  const state = useRef(new Float32Array(N * 3));

  useEffect(() => {
    let alive = true;
    buildMarkAtlas(MARK_IDS).then((a) => {
      if (alive) setAtlas(a);
    });
    return () => {
      alive = false;
    };
  }, []);

  const geometry = useMemo(() => {
    if (!atlas) return null;
    const offset = new Float32Array(N * 3);
    const cells = new Float32Array(N);
    SECTIONS.forEach((s, i) => {
      offset[i * 3] = ICON_X;
      offset[i * 3 + 1] = ROW_Y[i];
      offset[i * 3 + 2] = 0.002;
      cells[i] = atlas.index[navMarkId(s.id)] ?? 0;
      state.current[i * 3 + 2] = i;
    });
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(QUAD, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(QUAD_UV, 2));
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3));
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
    const st = new THREE.InstancedBufferAttribute(state.current, 3);
    st.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aState', st);
    g.instanceCount = N;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
    return g;
  }, [atlas]);

  const plateMat = getPlateMaterial();
  const iconMat = getIconMaterial();
  if (atlas && iconMat.uniforms.uAtlas.value !== atlas.texture) {
    iconMat.uniforms.uAtlas.value = atlas.texture;
    iconMat.uniforms.uCols.value = atlas.cols;
  }

  useFrame((_, delta) => {
    const kd = Math.min(1, delta * 9);
    open.current += ((hovered === null ? 0 : 1) - open.current) * kd;
    const width = COLLAPSED_W + (EXPANDED_W - COLLAPSED_W) * open.current;

    // Pin to the left of frame whatever the fov is doing — the fov is keyframed
    // from 55 to 78 across the journey, so anything placed at a fixed x drifts
    // across the frame and ends up on top of the content.
    const cam = camera as THREE.PerspectiveCamera;
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5) * Math.abs(NAV_Z);
    const halfW = halfH * cam.aspect;
    // Shrink on narrow viewports so an open panel can never span the frame.
    const fit = Math.min(1, (halfW * 0.88) / EXPANDED_W, (halfH * 1.7) / PLATE_H);
    const g = group.current;
    if (g) {
      g.position.set(-halfW + MARGIN * fit, 0, NAV_Z);
      g.scale.setScalar(fit);
    }

    const p = plate.current;
    if (p) {
      const quadW = width + PAD * 2;
      p.scale.set(quadW, QUAD_H, 1);
      p.position.x = quadW / 2 - PAD;
      plateMat.uniforms.uAspect.value = quadW / QUAD_H;
      plateMat.uniforms.uPanelW.value = width / QUAD_H;
      // Antialias against the REAL pixel size: one quad-height maps to this many
      // screen pixels, so the same half-pixel feather holds at any fov, dpr or
      // viewport, instead of a constant that is too soft here and too hard there.
      const pxPerQuadH = (QUAD_H * fit * size.height) / (2 * halfH);
      plateMat.uniforms.uAA.value = Math.max(0.0004, 0.75 / Math.max(pxPerQuadH, 1));
    }

    // Per-row active/hover, damped so nothing snaps.
    const st = state.current;
    let activeRow = activeRowRef.current;
    for (let i = 0; i < N; i++) {
      const [a, b] = SECTIONS[i].range;
      const isActive = F.smooth >= a && F.smooth < b ? 1 : 0;
      if (isActive) activeRow = i;
      st[i * 3] += (isActive - st[i * 3]) * Math.min(1, delta * 7);
      st[i * 3 + 1] += ((hovered === i ? 1 : 0) - st[i * 3 + 1]) * Math.min(1, delta * 9);
    }
    if (geometry) (geometry.getAttribute('aState') as THREE.BufferAttribute).needsUpdate = true;

    activeRowRef.current += (activeRow - activeRowRef.current) * Math.min(1, delta * 7);
    if (hovered !== null) hoverRowRef.current += (hovered - hoverRowRef.current) * Math.min(1, delta * 12);
    const rowToY = (row: number) => (((N - 1) / 2 - row) * PITCH) / QUAD_H;
    plateMat.uniforms.uActiveY.value = rowToY(activeRowRef.current);
    plateMat.uniforms.uHoverY.value = rowToY(hoverRowRef.current);
    plateMat.uniforms.uHoverOn.value = hovered === null ? 0 : open.current;

    // Labels fade in with the panel; the hovered one leads.
    const live = Math.round(activeRowRef.current);
    for (let i = 0; i < N; i++) {
      const t = labels.current[i];
      if (!t) continue;
      // Troika replaces its derived materials on re-sync, so this is re-asserted
      // every frame; it is a no-op once they are already transparent.
      forceTransparent(t);
      const o = open.current * (hovered === i ? 1 : 0.68);
      t.fillOpacity = o;
      // The outline has its own opacity; leaving it lit would print black
      // ghosts of the labels on the closed panel.
      t.outlineOpacity = o * 0.9;
      // On the solid tab the label is knocked out of the fill, so it flips to
      // the housing's own dark. Assigned only on change: troika re-syncs its
      // material when colour is set, and this runs every frame.
      const want = i === live ? KNOCK : PALETTE.textBright;
      if (labelColor.current[i] !== want) {
        labelColor.current[i] = want;
        t.color = want;
        t.outlineOpacity = 0;
      }
    }

    // The container's frame, rescaled every frame — which is the whole point of
    // slicing it: the corner art holds its size while the box around it moves.
    const fr = frame.current;
    if (fr) {
      fr.scale.set(width, PLATE_H, 1);
      fr.position.x = width / 2;
    }
    // Hit rows are only as wide as the panel actually is, so a collapsed nav
    // cannot swallow pointer events meant for the world behind it.
    for (let i = 0; i < N; i++) {
      const h = hits.current[i];
      if (!h) continue;
      h.scale.x = width;
      h.position.x = width / 2;
    }
  });

  // Parenting to the camera is what makes it ride along without per-frame maths.
  return (
    <primitive object={camera}>
      {/*
        NO renderOrder on this group. three reads a Group's renderOrder as the
        render list's `groupOrder`, which is compared BEFORE each object's own
        renderOrder — and the per-row <group>s below would then carry the
        default 0 and sort their labels ahead of a housing sitting at 995,
        which painted the labels out completely. With every group left at 0,
        the per-mesh renderOrder below is what decides, as intended.
      */}
      <group ref={group}>
        <mesh ref={plate} material={plateMat} renderOrder={995} raycast={() => null}>
          <planeGeometry args={[1, 1]} />
        </mesh>

        {/* the container, and one frame per row — all from the same sprite sheet */}
        {/*
          The container. `src` is an authored frame image sliced exactly like
          CSS border-image; if it is not on disk the drawn 'hud' variant is used
          instead, so this is never a broken frame — only a plainer one.
        */}
        <NineSlice
          variant="hud"
          src={FRAME_SRC}
          slice={FRAME_SLICE}
          borderWorld={FRAME_BORDER}
          keyBlack
          meshRef={frame}
          width={COLLAPSED_W}
          height={PLATE_H}
          border={0.044}
          // `fill` in the CSS: the art's own middle is drawn too. Harmless on
          // the drawn fallback, whose centre cell is empty.
          fill
          // Under 1: the art is already bright green, and anything at or over 1
          // is what the bloom pass turns into a halo. The frame should read as
          // drawn, not lit.
          intensity={0.5}
          position={[COLLAPSED_W / 2, 0, 0.001]}
          renderOrder={996}
        />
        {geometry && (
          <mesh
            geometry={geometry}
            material={iconMat}
            frustumCulled={false}
            renderOrder={998}
            raycast={() => null}
          />
        )}

        {SECTIONS.map((s, i) => (
          <group key={s.id}>
            <TerminalText
              ref={((t: TroikaText | null) => { labels.current[i] = t; }) as never}
              position={[LABEL_X, ROW_Y[i], 0.003]}
              anchorX="left"
              fontSize={0.025}
              color={PALETTE.textBright}
              outlineWidth={0.004}
              fillOpacity={0}
              outlineOpacity={0}
              renderOrder={999}
              letterSpacing={0.14}
            >
              {s.label.toUpperCase()}
            </TerminalText>

            {/* Invisible hit row, spanning the full open width so the panel stays
                open while the pointer travels out over the labels. */}
            <mesh
              ref={((h: THREE.Mesh | null) => { hits.current[i] = h; }) as never}
              position={[COLLAPSED_W / 2, ROW_Y[i], 0.012]}
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
              <planeGeometry args={[1, PITCH]} />
            </mesh>
          </group>
        ))}
      </group>
    </primitive>
  );
}
