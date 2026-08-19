import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '@/text/palette';
import { commitUniforms, cachedPlane } from './resources';
import { F } from '@/state/frameState';

/**
 * HoloPanel v2 — an instrument housing rather than a dark rectangle.
 *
 * All chrome is drawn analytically in ONE fragment shader: corner brackets that
 * fly in and lock, a header band with status LEDs, a footer strip with ruler
 * ticks and signal bars, an inner bevel, a prismatic edge fringe, scanlines and
 * a boot-open wipe. None of it costs a troika Text instance, so the text budget
 * is spent only on actual words.
 *
 * Two themes selected by uniform, so the material stays a singleton:
 *   'matrix' — the house green
 *   'ark'    — Ironman arc-reactor cyan with a gold accent
 *
 * depthWrite stays ON: the rain is depthTest:true, so a panel physically cuts
 * the rain behind it. That is the guaranteed contrast floor, independent of
 * whether the rain shader's text-zone spheres happen to be tuned for the angle.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uCurve;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Gentle barrel so it reads as a curved projection surface, not a sticker.
    p.z -= (p.x * p.x * 0.012 + p.y * p.y * 0.020) * uCurve;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;

  uniform float uTime, uOpacity, uHeader, uFooter, uAspect, uFill, uGrid, uChamfer, uEdgeOn;
  uniform float uLineK;     // 1 = the original uv-space line weight
  uniform float uRadius;    // rounded corner, in fractions of panel height
  uniform float uBracket;   // 0..1 weight of the corner brackets
  uniform float uBoot;      // 0..1 open animation
  uniform float uLock;      // 0..1 corner brackets flying in
  uniform float uChrome;    // 0 = plain, 1 = window chrome (popup)
  uniform float uSignal;    // 0..1 drives the footer signal bars
  uniform vec3 uBody, uEdge, uAccent;

  float bar(float x, float c, float w) {
    return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.0016, abs(x - c));
  }

  /**
   * Distance to one 45-degree corner cut, given the distances to the two edges
   * that meet there. Returns a large number when uChamfer is 0, so an unchamfered
   * panel is bit-for-bit what it was before this existed.
   */
  float cornerCut(float a, float b) {
    if (uChamfer <= 0.0) return 1e3;
    return (a + b - uChamfer) * 0.7071;
  }

  /**
   * Distance to a ROUNDED corner, the same way cornerCut gives the distance to a
   * mitred one. Only the square of side uRadius tucked into the corner is
   * affected; everywhere else this returns a large number and the straight edges
   * are left exactly as they were.
   */
  float cornerRound(float a, float b) {
    if (uRadius <= 0.0) return 1e3;
    if (a >= uRadius || b >= uRadius) return 1e3;
    return uRadius - length(vec2(uRadius - a, uRadius - b));
  }

  void main() {
    vec2 uv = vUv;

    // ---- boot: the panel opens from a horizontal slit ----
    float openH = mix(0.012, 1.0, smoothstep(0.0, 0.72, uBoot));
    float halfOpen = openH * 0.5;
    if (abs(uv.y - 0.5) > halfOpen) discard;
    // bright scanning edge while opening
    float scanEdge = (1.0 - smoothstep(0.0, 0.02, abs(abs(uv.y - 0.5) - halfOpen)))
                   * (1.0 - smoothstep(0.75, 1.0, uBoot));

    // distance to border, aspect-corrected so corners are square in world space
    vec2 d = min(uv, 1.0 - uv);
    d.x *= uAspect;
    float bd = min(d.x, d.y);

    // Cut the corners off at 45 degrees. Folding this into bd rather than
    // masking afterwards means the frame line, the bevel and the fill all
    // follow the new silhouette for free.
    vec2 dl = vec2(uv.x * uAspect, uv.y);          // to the left / bottom edges
    vec2 dr = vec2((1.0 - uv.x) * uAspect, 1.0 - uv.y); // to the right / top edges
    bd = min(bd, cornerCut(dl.x, dl.y));
    bd = min(bd, cornerCut(dr.x, dl.y));
    bd = min(bd, cornerCut(dl.x, dr.y));
    bd = min(bd, cornerCut(dr.x, dr.y));
    bd = min(bd, cornerRound(dl.x, dl.y));
    bd = min(bd, cornerRound(dr.x, dl.y));
    bd = min(bd, cornerRound(dl.x, dr.y));
    bd = min(bd, cornerRound(dr.x, dr.y));

    float body = smoothstep(0.0, 0.004, bd);
    float fill = body * uFill;

    // ---- frame line with a prismatic fringe ----
    // bd is measured in fractions of the panel's HEIGHT, so a band written as a
    // fixed bd is a fixed fraction of the height and its WORLD weight changes
    // with the panel: a 2.4-tall tile drew a line 40% the weight of a 5.6-tall
    // one, thin enough to alias into a row of dashes along the bottom edge.
    // uLineK rescales the band so a caller can pin it to a world size instead.
    float k = uLineK;
    float frameR = 1.0 - smoothstep(0.0015 * k, 0.0038 * k, abs(bd - 0.0075 * k));
    float frameG = 1.0 - smoothstep(0.0015 * k, 0.0038 * k, abs(bd - 0.0065 * k));
    float frameB = 1.0 - smoothstep(0.0015 * k, 0.0038 * k, abs(bd - 0.0055 * k));
    vec3 fringe = vec3(frameR, frameG, frameB) * 0.5;
    float frame = max(frameR, max(frameG, frameB));

    // ---- corner brackets: fly in from outside and lock ----
    vec2 c = abs(uv - 0.5) * 2.0;
    float slide = (1.0 - uLock) * 0.5;
    vec2 cs = c - slide;
    float cornerZone = step(0.66, max(cs.x, cs.y)) * step(0.42, min(cs.x, cs.y));
    float brackets = frame * cornerZone * uLock * uBracket;

    // ---- inner bevel: a lit top lip gives the plate thickness ----
    float bevel = (1.0 - smoothstep(0.0, 0.016 * k, abs(bd - 0.020 * k))) * 0.16
                * smoothstep(0.5, 0.92, uv.y);

    // ---- header band ----
    float headerY = 1.0 - uHeader;
    float inHeader = step(headerY, uv.y) * body;
    float headerFill = inHeader * 0.09;
    float headerRule = (1.0 - smoothstep(0.0009, 0.0026, abs(uv.y - headerY))) * body;

    // status LEDs, left of the header
    float leds = 0.0;
    for (int i = 0; i < 3; ++i) {
      float fi = float(i);
      vec2 p = vec2(0.028 + fi * 0.019, headerY + uHeader * 0.5);
      vec2 q = (uv - p) * vec2(uAspect, 1.0);
      float dot0 = 1.0 - smoothstep(0.0042, 0.0058, length(q));
      // each LED blinks on its own clock so the panel feels alive
      float on = 0.45 + 0.55 * step(0.0, sin(uTime * (1.1 + fi * 0.7) + fi * 2.0));
      leds += dot0 * on;
    }

    // window chrome, right of the header (popups only)
    float chrome = 0.0;
    if (uChrome > 0.5) {
      vec2 q1 = (uv - vec2(1.0 - 0.030, headerY + uHeader * 0.5)) * vec2(uAspect, 1.0);
      // an X glyph
      float x1 = 1.0 - smoothstep(0.0012, 0.0026, abs(abs(q1.x) - abs(q1.y)));
      chrome += x1 * step(length(q1), 0.010);
      // a minimise dash
      vec2 q2 = (uv - vec2(1.0 - 0.062, headerY + uHeader * 0.5)) * vec2(uAspect, 1.0);
      chrome += (1.0 - smoothstep(0.0010, 0.0022, abs(q2.y))) * step(abs(q2.x), 0.009);
    }

    // ---- footer strip: ruler ticks + signal bars ----
    float footerY = uFooter;
    float inFooter = (1.0 - step(footerY, uv.y)) * body * step(0.0, uFooter);
    float footerRule = (1.0 - smoothstep(0.0009, 0.0026, abs(uv.y - footerY))) * body * step(0.0001, uFooter);
    float ticks = 0.0;
    if (uFooter > 0.0001) {
      float t = fract(uv.x * 34.0);
      float major = step(0.5, fract(uv.x * 34.0 / 5.0));
      ticks = (1.0 - smoothstep(0.06, 0.12, t)) * inFooter * (0.35 + major * 0.35);
    }
    float bars = 0.0;
    for (int i = 0; i < 5; ++i) {
      float fi = float(i);
      float bx = 1.0 - 0.030 - fi * 0.017;
      float h = (fi + 1.0) / 5.0;
      float lit = step(fi / 5.0, uSignal);
      float inBar = step(abs(uv.x - bx) * uAspect, 0.0052)
                  * step(footerY * 0.22, uv.y) * step(uv.y, footerY * 0.22 + h * footerY * 0.5);
      bars += inBar * mix(0.12, 1.0, lit);
    }

    // ---- interior grid, on the same unit the layout system uses ----
    vec2 g = abs(fract(uv * vec2(16.0 * uAspect, 11.0)) - 0.5);
    float grid = (1.0 - smoothstep(0.46, 0.5, max(g.x, g.y))) * body * 0.030 * uGrid;

    // ---- scanlines + a slow roll ----
    float scan = (0.5 + 0.5 * sin(uv.y * 480.0)) * body * 0.020;
    float roll = smoothstep(0.972, 1.0, fract(uv.y * 0.5 - uTime * 0.055)) * body * 0.030;

    // ---- compose ----
    float glowMask = brackets + headerRule + footerRule + leds + chrome + bars + scanEdge;
    float bodyMask = fill + grid + scan + roll + headerFill + bevel + ticks;

    // uEdgeOn 0 keeps the housing — the fill, the grid, the depth-writing back
    // plate that cuts the rain — and drops every LINE, for panels that are
    // getting their frame from somewhere else.
    glowMask *= uEdgeOn;
    frame *= uEdgeOn;

    vec3 col = uBody * bodyMask
             + uEdge * (glowMask + frame * 0.22)
             + fringe * uEdge * 0.35 * uEdgeOn
             + uAccent * (leds * 0.6 + bars * 0.5 + chrome * 0.8) * uEdgeOn;

    float a = (bodyMask + glowMask + frame * 0.28) * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(col, a);
  }
`;

let material: THREE.ShaderMaterial | null = null;
function getPanelMaterial() {
  if (material) return material;
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uHeader: { value: 0.14 },
      uFooter: { value: 0.075 },
      uAspect: { value: 1 },
      uFill: { value: 0.16 },
      uGrid: { value: 1 },
      uChamfer: { value: 0 },
      uEdgeOn: { value: 1 },
      uLineK: { value: 1 },
      uRadius: { value: 0 },
      uBracket: { value: 1 },
      uCurve: { value: 1 },
      uBoot: { value: 1 },
      uLock: { value: 1 },
      uChrome: { value: 0 },
      uSignal: { value: 0.6 },
      uBody: { value: new THREE.Color(PALETTE.rain) },
      uEdge: { value: new THREE.Color(PALETTE.accent) },
      uAccent: { value: new THREE.Color(PALETTE.textBright) },
    },
  });
  return material;
}

/**
 * The plate behind the front plate. OPAQUE on purpose.
 *
 * As a transparent material it sorted into the transparent pass alongside the
 * rain, so bloom-blurred rain glowed straight through the console and left a
 * soft bright blob across the copy. Opaque means it renders in the opaque pass
 * first and its depth write rejects everything behind it — which is what makes
 * a panel genuinely readable rather than merely darker.
 */
const backVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * A ShaderMaterial rather than a MeshBasicMaterial purely so the back plate can
 * carry the SAME chamfer as the front. A rectangular plate behind a cut-cornered
 * panel shows its square corners poking out of the diagonals — and because this
 * plate is what occludes the rain, they show up as bright rectangles of nothing.
 * Still opaque and still depth-writing: discard leaves no depth behind either.
 */
const backFragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uAspect, uChamfer, uRadius;
  uniform vec3 uColor;

  float cornerCut(float a, float b) {
    if (uChamfer <= 0.0) return 1e3;
    return (a + b - uChamfer) * 0.7071;
  }

  float cornerRound(float a, float b) {
    if (uRadius <= 0.0) return 1e3;
    if (a >= uRadius || b >= uRadius) return 1e3;
    return uRadius - length(vec2(uRadius - a, uRadius - b));
  }

  void main() {
    vec2 dl = vec2(vUv.x * uAspect, vUv.y);
    vec2 dr = vec2((1.0 - vUv.x) * uAspect, 1.0 - vUv.y);
    float bd = min(min(cornerCut(dl.x, dl.y), cornerCut(dr.x, dl.y)),
                   min(cornerCut(dl.x, dr.y), cornerCut(dr.x, dr.y)));
    bd = min(bd, min(min(cornerRound(dl.x, dl.y), cornerRound(dr.x, dl.y)),
                     min(cornerRound(dl.x, dr.y), cornerRound(dr.x, dr.y))));
    if (bd < 0.0) discard;
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

let backMaterial: THREE.ShaderMaterial | null = null;
function getBackMaterial() {
  if (backMaterial) return backMaterial;
  backMaterial = new THREE.ShaderMaterial({
    vertexShader: backVertexShader,
    fragmentShader: backFragmentShader,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color('#02150a') },
      uAspect: { value: 1 },
      uChamfer: { value: 0 },
      uRadius: { value: 0 },
      uEdgeOn: { value: 1 },
    },
  });
  return backMaterial;
}

export type PanelTheme = 'matrix' | 'ark';

/**
 * `body` is the INTERIOR wash and must be a dark housing colour, not the neon.
 * Using the bright rain green here made the whole interior glow like a lamp
 * once bloom got hold of it and drowned the copy sitting on top. Only `edge`
 * and `accent` — the frame, brackets, LEDs and bars — are allowed to be hot.
 */
const THEMES: Record<PanelTheme, { body: string; edge: string; accent: string; back: string }> = {
  matrix: { body: '#0e3a1e', edge: PALETTE.accent, accent: PALETTE.textBright, back: '#020c06' },
  ark: { body: '#123040', edge: '#BFF0FF', accent: '#FFB23F', back: '#03101a' },
};

export interface HoloPanelProps {
  width: number;
  height: number;
  opacity?: number;
  /** Header band height as a fraction of panel height. 0 disables it. */
  header?: number;
  /** Footer strip height as a fraction. 0 disables it. */
  footer?: number;
  fill?: number;
  grid?: number;
  curve?: number;
  /** 0..1 open animation. */
  boot?: number;
  /** 0..1 corner-bracket lock-in. */
  lock?: number;
  /** Show window chrome (close/minimise) — for popups. */
  chrome?: boolean;
  /** 0..1 footer signal bars. */
  signal?: number;
  theme?: PanelTheme;
  /**
   * Overrides the theme's line, body and back-plate colours for a panel that
   * belongs to something with its own identity — a technology's brand, say.
   * The two themes cover the house styles; this covers the one-offs.
   */
  edgeColor?: string;
  bodyColor?: string;
  backColor?: string;
  /** Draw the depth back-plate. Off for panels stacked on other panels. */
  backPlate?: boolean;
  /**
   * Corner cut, in WORLD units. 0 keeps the plain rectangle. Cuts every corner
   * at 45 degrees, and the frame, bevel and back plate all follow.
   */
  chamfer?: number;
  /**
   * Rounded corner, in WORLD units, as an alternative silhouette to `chamfer`.
   * Both can be set, but one or the other is the point.
   */
  radius?: number;
  /** 0 drops the frame line, brackets and LEDs, leaving only the housing. */
  edge?: number;
  /**
   * Weight of the corner brackets, which burn far brighter than the frame line.
   * Below 1 for panels sitting close to the camera, where full-strength corners
   * bloom into four blobs.
   */
  bracket?: number;
  /**
   * Frame line weight in WORLD units, instead of the default fraction-of-height.
   * Pass the same value to every panel in a group and they all carry one line
   * weight however their heights differ.
   */
  lineWidth?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  renderOrder?: number;
}

export function HoloPanel({
  width,
  height,
  opacity = 1,
  header = 0.14,
  footer = 0.075,
  fill = 0.16,
  grid = 1,
  curve = 1,
  boot = 1,
  lock = 1,
  chrome = false,
  signal = 0.6,
  theme = 'matrix',
  edgeColor,
  bodyColor,
  backColor,
  backPlate = true,
  chamfer = 0,
  radius = 0,
  edge = 1,
  bracket = 1,
  lineWidth,
  ...rest
}: HoloPanelProps) {
  const mat = getPanelMaterial();
  const back = getBackMaterial();
  const geo = cachedPlane(width, height, 32, 24);
  const backGeo = cachedPlane(width * 1.03, height * 1.03);

  /**
   * How far the vertex curve bows the front plate away from the camera at its
   * deepest point — the corners. It grows with the panel, and the back plate
   * used to sit at a FIXED -0.09: on anything past roughly 7 x 5 world units the
   * corners sank BEHIND the opaque, depth-writing back plate and were culled, so
   * a large panel lost its frame corners and side edges and looked chopped off.
   * Parking the plate behind the deepest the front can reach fixes it at every
   * size, and the extra depth is invisible at these distances.
   */
  const curveDepth =
    ((width * 0.5) ** 2 * 0.012 + (height * 0.5) ** 2 * 0.020) * curve;
  const backZ = -(0.09 + curveDepth);
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // ASSIGN F.time, never accumulate delta: these materials are module-level
    // singletons, so every mounted instance runs this and `+= delta` advances
    // the SHARED clock once per mounted instance - three panels on screen ran
    // their scanlines at 3x speed. F.time is also reduced-motion aware;
    // clock.elapsedTime is not.
    mat.uniforms.uTime.value = F.time;
  });

  const t = THEMES[theme];

  return (
    <group {...rest}>
      {backPlate && (
        <mesh
          geometry={backGeo}
          material={back}
          position={[0, 0, backZ]}
          raycast={() => null}
          visible={boot > 0.05 && opacity > 0.02}
          onBeforeRender={() => {
            const u = back.uniforms;
            (u.uColor.value as THREE.Color).set(backColor ?? t.back);
            // The back plate is 3% oversized, so its chamfer must be too, or the
            // cut lands inside the front plate's and leaves a notch of backing.
            u.uAspect.value = width / height;
            u.uChamfer.value = (chamfer * 1.03) / height;
            u.uRadius.value = (radius * 1.03) / height;
            commitUniforms(back);
          }}
        />
      )}
      <mesh
        ref={ref}
        geometry={geo}
        material={mat}
        raycast={() => null}
        onBeforeRender={() => {
          // Per-panel values are pushed at draw time so every panel in the site
          // shares ONE material and one compiled program.
          const u = mat.uniforms;
          u.uOpacity.value = opacity;
          u.uHeader.value = header;
          u.uFooter.value = footer;
          u.uFill.value = fill;
          u.uGrid.value = grid;
          u.uCurve.value = curve;
          u.uBoot.value = boot;
          u.uLock.value = lock;
          u.uChrome.value = chrome ? 1 : 0;
          u.uSignal.value = signal;
          u.uAspect.value = width / height;
          // bd is measured in fractions of the panel's height, so the chamfer
          // has to be converted into that space to stay a world-space size.
          u.uChamfer.value = chamfer / height;
          u.uRadius.value = radius / height;
          u.uEdgeOn.value = edge;
          u.uBracket.value = bracket;
          // 0.0065 is where the default band sits, so k = 1 reproduces it exactly.
          u.uLineK.value = lineWidth ? lineWidth / height / 0.0065 : 1;
          (u.uBody.value as THREE.Color).set(bodyColor ?? t.body);
          (u.uEdge.value as THREE.Color).set(edgeColor ?? t.edge);
          (u.uAccent.value as THREE.Color).set(t.accent);
          commitUniforms(mat);
        }}
      />
    </group>
  );
}
