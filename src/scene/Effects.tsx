import { useRef } from 'react';
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

  useFrame(() => {
    // Aberration tracks scroll velocity — the cheapest, most legible speed cue available.
    const v = reducedMotion ? 0 : Math.abs(F.velocity);
    aberration.current.set(0.0004 + v * 0.0026, 0.0004 + v * 0.0026);
  });

  return (
    <EffectComposer multisampling={tier.msaa}>
      {tier.bloomLevels > 0 ? (
        <Bloom
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
