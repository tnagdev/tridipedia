import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { F } from '@/state/frameState';
import { cachedPlane, commitUniforms } from './resources';

/**
 * Frosted glass behind a modal overlay.
 *
 * NOT a real blur, and deliberately so. Blurring what is behind this means
 * resolving the scene to a texture and running a separate pass over it, and
 * Effects.tsx already records the decision not to pay for that class of effect
 * here — DepthOfField is excluded by name at 2-4ms. What actually does the
 * perceptual work is knocking the background's CONTRAST down: the rain is a
 * field of bright points, bloom has already smeared each one, and dimming them
 * to a fifth leaves exactly the soft haze a blur would have produced.
 *
 * So: one quad, one shader, no passes, no render target.
 *
 * Two details carry it. The falloff is strongest behind the middle of frame and
 * eases toward the edges, so the world is still legibly there rather than
 * curtained off. And the grain is animated at two scales — without it a flat
 * wash over animated rain reads as a dead grey rectangle laid on the screen,
 * which is the one thing it must not look like.
 *
 * depthTest is OFF and renderOrder is low: it has to cover the world whatever
 * the depth buffer says, while everything in the overlay draws over it. Kept
 * well below the nav's 995-999, so navigation is never veiled by a popup.
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
  uniform float uOpacity, uTime, uAspect;
  uniform vec3 uTint;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  /**
   * Smoothly interpolated value noise.
   *
   * The grain below is hashed per CELL, which gives hard-edged speckle — right
   * for glass dust, wrong for the soft unfocused blobs that read as a blur.
   * Interpolating between the four corners of each cell costs three extra mixes
   * and is what turns speckle into haze.
   */
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    if (uOpacity < 0.002) discard;

    // Roughly circular in world units, squashed so a wide quad does not read
    // as an oval.
    vec2 q = (vUv - 0.5) * 2.0;
    q.x *= uAspect;
    float r = length(q) / max(uAspect, 1.0);
    // Barely any falloff now: the overlay's copy has to win against the rain
    // across the WHOLE frame, not just behind its middle. The edges still ease
    // off enough that the world reads as veiled rather than switched off.
    float fall = mix(1.0, 0.86, smoothstep(0.18, 1.05, r));

    // Glass grain: fixed fine static, plus a coarser layer that resamples a few
    // times a second. Both are cheap hashes of the quad's own uv.
    float g1 = hash(floor(vUv * 700.0));
    float g2 = hash(floor(vUv * 210.0) + floor(uTime * 9.0));
    float grain = (g1 - 0.5) * 0.055 + (g2 - 0.5) * 0.03;

    // And the haze that does the actual blurring work: broad, soft, slowly
    // drifting lobes of extra opacity. Where one sits, the rain behind it loses
    // another 12% of its contrast, and because the lobes are smooth rather than
    // per-cell the eye reads the whole field as out of focus instead of noisy.
    float haze = vnoise(vUv * vec2(9.0, 5.0) + vec2(uTime * 0.05, uTime * 0.031));
    haze += 0.5 * vnoise(vUv * vec2(23.0, 13.0) - vec2(uTime * 0.037, uTime * 0.021));
    haze = (haze / 1.5 - 0.5);

    float a = clamp(uOpacity * (fall + haze * 0.12) + grain * uOpacity, 0.0, 1.0);
    vec3 col = uTint * (0.085 + max(grain, 0.0) * 0.6 + max(haze, 0.0) * 0.10);
    gl_FragColor = vec4(col, a);
  }
`;

/** Module-level singleton: the renderer's program cache is keyed by material. */
let material: THREE.ShaderMaterial | null = null;
function getScrimMaterial(): THREE.ShaderMaterial {
  if (material) return material;
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    // NORMAL, not additive: the entire job is to take light AWAY from what is
    // behind. Additive would brighten the rain it is meant to be muting.
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: {
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uTint: { value: new THREE.Color('#0a1f14') },
    },
  });
  return material;
}

export function Scrim({
  width,
  height,
  opacityRef,
  strength = 0.66,
  tint = '#0a1f14',
  renderOrder = 880,
  ...rest
}: {
  width: number;
  height: number;
  /**
   * Read every frame, so the caller can fade this with its own open animation
   * without re-rendering. A prop would re-render the whole overlay per frame.
   */
  opacityRef: { current: number };
  strength?: number;
  tint?: string;
  renderOrder?: number;
  [key: string]: unknown;
}) {
  const mat = getScrimMaterial();
  const geo = cachedPlane(width, height);

  useFrame(() => {
    // ASSIGN F.time, never accumulate: the material is a singleton and every
    // mounted instance runs this callback.
    mat.uniforms.uTime.value = F.time;
  });

  return (
    <mesh
      geometry={geo}
      material={mat}
      renderOrder={renderOrder}
      frustumCulled={false}
      raycast={() => null}
      onBeforeRender={() => {
        // Per-instance values at draw time, the same contract HoloPanel and
        // StatBar use — assigning at render time would let whichever scrim drew
        // last decide the uniforms for all of them.
        mat.uniforms.uOpacity.value = opacityRef.current * strength;
        mat.uniforms.uAspect.value = width / height;
        (mat.uniforms.uTint.value as THREE.Color).set(tint);
        commitUniforms(mat);
      }}
      {...rest}
    />
  );
}
