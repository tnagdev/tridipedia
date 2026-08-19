import { useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '@/text/palette';
import { F } from '@/state/frameState';
import { cachedPlane, commitUniforms } from './resources';

/**
 * A project's screenshot, shown as a screen inside the world.
 *
 * ONE component for both places a thumbnail appears — the wall frame and the
 * open dossier — because they have to look like the same picture. Two shaders
 * with the same grade in them is two shaders that drift.
 *
 * NOT run through <AsciiImage />, though that was the first thing tried. The
 * ASCII path is right for the portrait, which is line art that survives being
 * reduced to glyphs. These are 1900px UI screenshots: at any size that fits on
 * a wall frame, glyph-quantising them destroys the only thing they were added
 * to convey. Instead the picture is shown straight and GRADED toward the
 * world's palette, with the CRT's own scanlines over it, so it reads as a
 * monitor standing in the rain rather than as a browser screenshot pasted on.
 * `grade` is the dial: 0 leaves the image alone, 1 makes it a green monochrome.
 *
 * The material is a module-level singleton like every other in here, so the
 * texture CANNOT be set from a render or a useFrame — three frames would all
 * end up drawing whichever one wrote last. It goes in through onBeforeRender,
 * the same contract MarkStack uses for its atlas.
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

  uniform sampler2D uMap;
  uniform float uHasMap, uQuadAspect, uImageAspect, uContain;
  uniform float uOpacity, uGrade, uTime, uHover, uHighlight;
  uniform vec3 uTint;

  void main() {
    if (uHasMap < 0.5 || uOpacity < 0.004) discard;

    // Fit the picture to the quad without ever stretching it. s is how much
    // wider the image is than the hole it goes in; cover crops the long axis,
    // contain lets it run past the edge and throws that part away.
    float s = uImageAspect / max(uQuadAspect, 0.0001);
    vec2 uv = vUv;
    if (uContain > 0.5) {
      if (s > 1.0) uv.y = 0.5 + (vUv.y - 0.5) * s;
      else         uv.x = 0.5 + (vUv.x - 0.5) / s;
    } else {
      if (s > 1.0) uv.x = 0.5 + (vUv.x - 0.5) / s;
      else         uv.y = 0.5 + (vUv.y - 0.5) * s;
    }
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    if (inside < 0.5) discard;

    vec3 src = texture2D(uMap, uv).rgb;
    float lum = dot(src, vec3(0.2126, 0.7152, 0.0722));

    // Roll the highlights off FIRST.
    //
    // These are UI screenshots, so most of the picture is near-white, and the
    // grade below used to scale the tint by up to 1.15 — a white pixel came out
    // at 1.33 in green, well past white, and bloom (which triggers at 0.25)
    // turned every light panel into a glowing block with the interface lost
    // inside it. Only the bright end is touched, so darker artwork is unaffected.
    vec3 tamed = src * mix(1.0, uHighlight, smoothstep(0.5, 1.0, lum));

    // Toward the world's own colour, by luminance, so structure survives. The
    // tint is clamped so grading can never make a pixel brighter than white.
    vec3 graded = mix(tamed, min(uTint * (0.10 + lum * 0.82), vec3(1.0)), uGrade);
    // A touch brighter under the pointer, so a hovered frame answers.
    graded *= 0.94 + uHover * 0.18;

    // The CRT this is notionally displayed on. Fine enough to read as a
    // surface rather than as stripes drawn over the picture.
    float scan = 0.90 + 0.10 * sin(vUv.y * 520.0 - uTime * 2.2);
    // Eased off at the edges so it sinks into its frame instead of ending.
    float vig = 1.0 - smoothstep(0.62, 1.02, length(vUv - 0.5) * 1.9);

    gl_FragColor = vec4(graded * scan * mix(0.55, 1.0, vig), uOpacity);
  }
`;

let material: THREE.ShaderMaterial | null = null;
function getThumbMaterial(): THREE.ShaderMaterial {
  if (material) return material;
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    // NORMAL, not additive: this is a picture, and additive would wash every
    // light pixel of a UI screenshot straight to white.
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uMap: { value: null },
      uHasMap: { value: 0 },
      uQuadAspect: { value: 1 },
      uImageAspect: { value: 1 },
      uContain: { value: 0 },
      uOpacity: { value: 1 },
      uGrade: { value: 0.22 },
      uHighlight: { value: 0.62 },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uTint: { value: new THREE.Color(PALETTE.rain) },
    },
  });
  return material;
}

/* ----------------------------- texture loading ---------------------------- */

const cache = new Map<string, Promise<THREE.Texture | null>>();

function load(src: string): Promise<THREE.Texture | null> {
  const hit = cache.get(src);
  if (hit) return hit;
  const job = new Promise<THREE.Texture | null>((resolve) => {
    new THREE.TextureLoader().load(
      src,
      (tex) => {
        // Without this the screenshots come back washed out: three treats an
        // untagged texture as linear, and these are sRGB PNGs.
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 4;
        resolve(tex);
      },
      undefined,
      () => resolve(null), // a missing thumbnail must never break a section
    );
  });
  cache.set(src, job);
  return job;
}

/**
 * Loads a thumbnail WITHOUT suspending.
 *
 * useLoader would throw a promise and take the whole section down to its
 * Suspense fallback while half a megabyte of PNG arrives — the wall would
 * vanish and come back. This resolves to null until the image is there, and
 * every caller already has something to draw in the meantime.
 */
export function useThumbnail(src: string | null | undefined): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!src) { setTex(null); return; }
    let alive = true;
    void load(src).then((t) => { if (alive) setTex(t); });
    return () => { alive = false; };
  }, [src]);
  return tex;
}

/* -------------------------------- component ------------------------------- */

export function ProjectThumb({
  texture,
  width,
  height,
  opacity = 1,
  hover = 0,
  grade = 0.22,
  highlight = 0.62,
  fit = 'cover',
  tint = PALETTE.rain,
  ...rest
}: {
  texture: THREE.Texture | null;
  width: number;
  height: number;
  opacity?: number;
  hover?: number;
  /** 0 shows the picture as shot, 1 makes it green monochrome. */
  grade?: number;
  /** How far the brightest parts are pulled down. 1 leaves them alone. */
  highlight?: number;
  /** `cover` fills the hole and crops; `contain` shows all of it. */
  fit?: 'cover' | 'contain';
  tint?: string;
  [key: string]: unknown;
}) {
  const mat = getThumbMaterial();
  const geo = cachedPlane(width, height);

  useFrame(() => {
    // ASSIGN F.time, never accumulate: the material is shared by every mounted
    // thumbnail, so `+=` would run the scanlines at N times speed.
    mat.uniforms.uTime.value = F.time;
  });

  if (!texture) return null;

  return (
    <mesh
      geometry={geo}
      material={mat}
      raycast={() => null}
      onBeforeRender={() => {
        const img = texture.image as { width?: number; height?: number } | undefined;
        mat.uniforms.uMap.value = texture;
        mat.uniforms.uHasMap.value = 1;
        mat.uniforms.uQuadAspect.value = width / height;
        mat.uniforms.uImageAspect.value = (img?.width ?? 1) / (img?.height ?? 1);
        mat.uniforms.uContain.value = fit === 'contain' ? 1 : 0;
        mat.uniforms.uOpacity.value = opacity;
        mat.uniforms.uGrade.value = grade;
        mat.uniforms.uHighlight.value = highlight;
        mat.uniforms.uHover.value = hover;
        (mat.uniforms.uTint.value as THREE.Color).set(tint);
        commitUniforms(mat);
      }}
      {...rest}
    />
  );
}
