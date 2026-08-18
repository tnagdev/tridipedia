import { useRef } from 'react';
import type { BloomEffect } from 'postprocessing';
import { useFrame } from '@react-three/fiber';
import {
  EffectComposer, Bloom, Vignette, Noise, ChromaticAberration, Scanline, ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { F } from '@/state/frameState';
import type { TierSpec } from '@/perf/tier';

/**
 * `postprocessing` merges compatible effects into ONE fullscreen shader, so
 * the real pass count is: scene -> bloom mip chain -> one merged pass.
 * Bloom is the only effect here with meaningful cost; the rest are ~free.
 *
 * DepthOfField is deliberately absent — the rain's own far-fade already reads
 * as depth haze, and a real depth pass is not worth 2-4ms for that.
 */
export function Effects({ tier, reducedMotion }: { tier: TierSpec; reducedMotion: boolean }) {
  const aberration = useRef(new THREE.Vector2(0.0004, 0.0004));
  // Typed as the CLASS, not the instance: @react-three/postprocessing's
  // wrapEffect declares its ref as `typeof Effect`, though what it actually
  // hands back at runtime is the effect instance. Cast once where it is read.
  const bloom = useRef<typeof BloomEffect>(null);

  useFrame(() => {
    // Aberration tracks scroll velocity — the cheapest, most legible speed cue available.
    const v = reducedMotion ? 0 : Math.abs(F.velocity);
    aberration.current.set(0.0004 + v * 0.0026, 0.0004 + v * 0.0026);

    // Bloom is driven through the REF, never through props. wrapEffect memoises
    // an effect's constructor args on JSON.stringify(props), so animating
    // `intensity` as a prop would tear down and rebuild the BloomEffect — and
    // its mip chain — on every single frame.
    //
    // Ceilings, found by eye: past intensity ~2.6 the additive field smears
    // into a white sheet, and below threshold ~0.12 the green mid-tone blooms
    // and text loses the outline contrast it relies on.
    const b = bloom.current as unknown as BloomEffect | null;
    if (b) {
      b.intensity = 1.15 + F.bloom * 1.05;
      b.luminanceMaterial.threshold = 0.25 - F.bloom * 0.07;
    }
  });

  return (
    <EffectComposer multisampling={tier.msaa}>
      {tier.bloomLevels > 0 ? (
        <Bloom
          ref={bloom}
          mipmapBlur
          levels={tier.bloomLevels}
          intensity={1.15}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.4}
        />
      ) : (
        <></>
      )}
      {tier.chromaticAberration ? (
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={aberration.current}
          radialModulation={false}
          modulationOffset={0}
        />
      ) : (
        <></>
      )}
      <Noise premultiply opacity={0.085} />
      <Scanline density={1.15} opacity={0.055} />
      <Vignette darkness={0.62} offset={0.28} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
