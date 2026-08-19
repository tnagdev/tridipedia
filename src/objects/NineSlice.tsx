import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildFrameAtlas, frameEntry, type FrameVariant } from './frameAtlas';
import { cachedPlane } from './resources';
import { PALETTE } from '@/text/palette';

/**
 * A frame drawn by nine-slicing, with the same semantics as CSS `border-image`.
 *
 * The quad is a unit plane scaled to whatever size is asked for; the shader maps
 * each fragment back into the source by SLICE rather than by stretching the
 * whole image. Within a border of an edge it reads that corner or edge region
 * 1:1, and between them it stretches the middle — so corner detail keeps the
 * size it was authored at however the box is resized, which is the entire point.
 *
 * The four borders are independent, exactly like the four numbers in
 *   border-image: url(f.png) 69 47 38 31 fill / 69px 47px 38px 31px;
 * so an asymmetric frame — a deep top, a shallow bottom — slices correctly.
 *
 * The source is either the generated sprite sheet (`variant`) or an image
 * (`src`). An image that fails to load falls back to the variant, so a missing
 * asset degrades to the drawn frame instead of to nothing.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;

  uniform highp sampler2D uSheet;
  uniform vec2 uSize;      // the frame's world size
  uniform vec4 uBorder;    // world border: top, right, bottom, left
  uniform vec4 uRect;      // source rect in uv: u0, v0, u1, v1
  uniform vec4 uSlice;     // uv inset of each slice line: top, right, bottom, left
  uniform vec2 uTexel;     // one texel of the source, in uv
  uniform float uFill;     // 0 = hollow frame, 1 = the middle region is drawn too
  uniform vec3 uColor;
  uniform float uIntensity, uOpacity, uTint, uKey;

  /**
   * One axis of the slice map.
   *
   * The sample is clamped to stay half a texel inside its own region: bilinear
   * filtering reaches half a texel past wherever it is told to look, and at a
   * region boundary that half texel lands in the NEIGHBOURING region, printing a
   * speck of whatever is drawn there.
   */
  float sliceAxis(float x, float size, float b0, float b1, float t0, float t1,
                  float s0, float s1, float texel, out float region) {
    float ta = t0 + s0;
    float tb = t1 - s1;
    float lo, hi, u;

    if (x < b0) {
      region = 0.0;
      lo = t0; hi = ta;
      u = t0 + (x / max(b0, 1e-5)) * s0;
    } else if (x > size - b1) {
      region = 2.0;
      lo = tb; hi = t1;
      u = tb + ((x - (size - b1)) / max(b1, 1e-5)) * s1;
    } else {
      region = 1.0;
      lo = ta; hi = tb;
      // Stretched, like border-image's default. Nothing repeats, so there are
      // no seams to bleed across in the first place.
      u = ta + ((x - b0) / max(size - b0 - b1, 1e-5)) * (tb - ta);
    }
    return clamp(u, lo + texel * 0.5, hi - texel * 0.5);
  }

  void main() {
    // Measured from the frame's TOP-left: every source here is uploaded with
    // flipY off, so v = 0 is the source's top row.
    vec2 p = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);

    // Borders can never eat more than the box they sit on; CSS scales them down
    // together in that case rather than letting the map fold over itself.
    float sx = min(1.0, uSize.x / max(uBorder.w + uBorder.y, 1e-5));
    float sy = min(1.0, uSize.y / max(uBorder.x + uBorder.z, 1e-5));
    vec4 b = vec4(uBorder.x * sy, uBorder.y * sx, uBorder.z * sy, uBorder.w * sx);

    float rx, ry;
    float u = sliceAxis(p.x, uSize.x, b.w, b.y, uRect.x, uRect.z, uSlice.w, uSlice.y, uTexel.x, rx);
    float v = sliceAxis(p.y, uSize.y, b.x, b.z, uRect.y, uRect.w, uSlice.x, uSlice.z, uTexel.y, ry);

    // The centre region is skipped unless fill is asked for.
    if (uFill < 0.5 && rx > 0.5 && rx < 1.5 && ry > 0.5 && ry < 1.5) discard;

    vec4 src = texture2D(uSheet, vec2(u, v));

    // A JPEG has no alpha, so its black background arrives as opaque black and
    // would print a solid rectangle over the scene. uKey derives the alpha from
    // the art's own brightness instead — the threshold starts above the level
    // JPEG ringing reaches, so the lines key cleanly and the mush around them
    // does not.
    float lit = max(max(src.r, src.g), src.b);
    // The threshold sits well up the range: below it are the art's dark fill and
    // the JPEG's ringing around the lines, and letting those through at partial
    // alpha hazes the whole frame.
    float a = mix(src.a, smoothstep(0.16, 0.46, lit), uKey) * uOpacity;
    if (a < 0.004) discard;

    // uTint 1 replaces the source's colour (the generated sheet is a white
    // silhouette); uTint 0 keeps it (an authored image brings its own).
    vec3 col = mix(src.rgb, uColor, uTint);
    // Premultiplied, and free to exceed alpha: the excess is what the bloom
    // pass turns into the neon halo.
    gl_FragColor = vec4(col * a * uIntensity, a);
  }
`;

let material: THREE.ShaderMaterial | null = null;
function getFrameMaterial(): THREE.ShaderMaterial {
  if (material) return material;
  const atlas = buildFrameAtlas();
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: {
      uSheet: { value: atlas.texture },
      uSize: { value: new THREE.Vector2(1, 1) },
      uBorder: { value: new THREE.Vector4(0.04, 0.04, 0.04, 0.04) },
      uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uSlice: { value: new THREE.Vector4(0.33, 0.33, 0.33, 0.33) },
      uTexel: { value: new THREE.Vector2(0.001, 0.001) },
      uFill: { value: 0 },
      uColor: { value: new THREE.Color(PALETTE.neon) },
      uIntensity: { value: 1 },
      uOpacity: { value: 1 },
      uTint: { value: 1 },
      uKey: { value: 0 },
    },
  });
  return material;
}

/* ------------------------- optional image sources ------------------------- */

interface LoadedFrame {
  texture: THREE.Texture;
  width: number;
  height: number;
}

const imageCache = new Map<string, Promise<LoadedFrame | null>>();

/**
 * Loads a frame image, or resolves null if it is not there.
 *
 * Null rather than throwing: a frame asset that has not been dropped in yet must
 * degrade to the drawn fallback, not take the navigation down with it.
 */
function loadFrame(src: string): Promise<LoadedFrame | null> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const job = new Promise<LoadedFrame | null>((resolve) => {
    new THREE.TextureLoader().load(
      src,
      (texture) => {
        // flipY off, so v = 0 is the image's TOP row and the slice maths above
        // reads the same way for an image as for the generated sheet.
        texture.flipY = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        const img = texture.image as { width: number; height: number };
        resolve({ texture, width: img.width, height: img.height });
      },
      undefined,
      () => resolve(null),
    );
  });
  imageCache.set(src, job);
  return job;
}

/** Live per-instance state, mutated from a useFrame — props are a render-time snapshot. */
export interface NineSliceState {
  color?: string;
  intensity?: number;
  opacity?: number;
}

export interface NineSliceProps {
  /** The drawn fallback, and the source when no `src` is given. */
  variant: FrameVariant;
  width: number;
  height: number;
  /**
   * An authored frame image. Slices are given in ITS OWN pixels,
   * top-right-bottom-left, exactly like border-image's four numbers.
   */
  src?: string;
  slice?: [number, number, number, number];
  /** World units per source pixel — border-image's `/ 69px 47px …`, as one number. */
  scale?: number;
  /**
   * Explicit world border widths, top-right-bottom-left, overriding `scale`.
   *
   * border-image's second half is exactly this: the rendered widths need not
   * match the slice sizes. Narrowing a side compresses that strip of art rather
   * than cropping it, which is how you keep a heavy authored border from eating
   * the box it is framing.
   */
  borderWorld?: [number, number, number, number];
  /** Draw the middle region as well. border-image's `fill`. */
  fill?: boolean;
  /** World size of the drawn variant's corner slices. Ignored once `src` loads. */
  border?: number;
  color?: string;
  /** Above 1 to make the line bloom. */
  intensity?: number;
  opacity?: number;
  /** Recolour the source. On by default for the white-silhouette sheet; off for an image. */
  tint?: boolean;
  /**
   * Depth-test the frame. OFF for HUD chrome parented to the camera, which must
   * never be occluded; ON for a frame that lives in the world and should sit
   * behind whatever is genuinely in front of it.
   */
  depth?: boolean;
  /** Derive alpha from brightness. Needed for any source without an alpha channel — a JPEG. */
  keyBlack?: boolean;
  position?: [number, number, number];
  renderOrder?: number;
  /** Hand the mesh out so a parent can drive its position and scale per frame. */
  meshRef?: React.MutableRefObject<THREE.Mesh | null>;
}

export function NineSlice({
  variant,
  width,
  height,
  src,
  slice,
  scale = 0.0013,
  borderWorld,
  fill = false,
  border = 0.04,
  color = PALETTE.neon,
  intensity = 1,
  opacity = 1,
  tint,
  keyBlack = false,
  depth = false,
  position,
  renderOrder = 0,
  meshRef,
}: NineSliceProps) {
  const mat = getFrameMaterial();
  const atlas = buildFrameAtlas();
  const geo = cachedPlane(1, 1);
  const own = useRef<THREE.Mesh>(null);
  const [image, setImage] = useState<LoadedFrame | null>(null);

  useEffect(() => {
    if (!src) return;
    let alive = true;
    loadFrame(src).then((f) => {
      if (alive) setImage(f);
    });
    return () => {
      alive = false;
    };
  }, [src]);

  return (
    <mesh
      ref={(m) => {
        (own as React.MutableRefObject<THREE.Mesh | null>).current = m;
        // Created HERE, so a parent can mutate it from its very first frame
        // without having to know this component's internals.
        if (m && !m.userData.nine) m.userData.nine = {} as NineSliceState;
        if (meshRef) meshRef.current = m;
      }}
      geometry={geo}
      material={mat}
      position={position}
      scale={[width, height, 1]}
      renderOrder={renderOrder}
      raycast={() => null}
      onBeforeRender={() => {
        // Per-instance values pushed at draw time, so every frame in the site
        // shares ONE material and one compiled program.
        const m = own.current;
        if (!m) return;
        // Size comes from the mesh's OWN scale rather than from the prop, so a
        // parent animating the scale can never desync the slice map from the
        // quad it is being mapped onto.
        const w = m.scale.x;
        const h = m.scale.y;
        const live = (m.userData.nine ?? {}) as NineSliceState;
        const u = mat.uniforms;

        if (image && slice) {
          const [t, r, b, l] = slice;
          u.uSheet.value = image.texture;
          (u.uRect.value as THREE.Vector4).set(0, 0, 1, 1);
          (u.uSlice.value as THREE.Vector4).set(
            t / image.height,
            r / image.width,
            b / image.height,
            l / image.width,
          );
          if (borderWorld) (u.uBorder.value as THREE.Vector4).fromArray(borderWorld);
          else (u.uBorder.value as THREE.Vector4).set(t * scale, r * scale, b * scale, l * scale);
          (u.uTexel.value as THREE.Vector2).set(1 / image.width, 1 / image.height);
          u.uTint.value = tint ? 1 : 0;
          u.uKey.value = keyBlack ? 1 : 0;
        } else {
          const e = frameEntry(variant);
          u.uSheet.value = atlas.texture;
          (u.uRect.value as THREE.Vector4).fromArray(e.rect);
          (u.uSlice.value as THREE.Vector4).fromArray(e.slice);
          const bw = Math.min(border, w * 0.49, h * 0.49);
          (u.uBorder.value as THREE.Vector4).set(bw, bw, bw, bw);
          (u.uTexel.value as THREE.Vector2).set(atlas.texelU, atlas.texelV);
          u.uTint.value = tint === false ? 0 : 1;
          u.uKey.value = 0; // the generated sheet has a real alpha channel
        }

        // Read per draw by three's state cache, so one material can serve both a
        // camera-parented frame and a world-space one.
        mat.depthTest = depth;

        (u.uSize.value as THREE.Vector2).set(w, h);
        u.uFill.value = fill ? 1 : 0;
        (u.uColor.value as THREE.Color).set(live.color ?? color);
        u.uIntensity.value = live.intensity ?? intensity;
        u.uOpacity.value = live.opacity ?? opacity;
      }}
    />
  );
}
