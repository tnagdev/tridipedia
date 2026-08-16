import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText } from '@/text/TerminalText';
import { ScrambleText } from '@/text/ScrambleText';
import { HeroFormation } from '@/rain/HeroFormation';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { profile } from '@/content/loadContent';
import { PALETTE } from '@/text/palette';
import type { TroikaText } from '@/text/TerminalText';

/** 01 — "Boot". You open INSIDE the rain, not looking at it. */
export function HeroSection({ formationCount }: { formationCount: number }) {
  const p = useSectionProgress('hero');
  const group = useRef<THREE.Group>(null);
  const tagline = useRef<TroikaText>(null);
  const hint = useRef<TroikaText>(null);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    // Everything in the section fades with `band`, so it enters and leaves on its own.
    const o = p.current.band;
    g.visible = o > 0.001;

    const t = clock.elapsedTime;
    // fillOpacity is a troika property, not a material one — setting it does
    // not trigger a text re-layout the way changing `text` would.
    if (tagline.current) tagline.current.fillOpacity = Math.min(1, o * 1.4);
    if (hint.current) {
      // The scroll hint pulses, then gets out of the way once you start moving.
      hint.current.fillOpacity = Math.max(0, 1 - p.current.local * 4) * (0.45 + 0.35 * Math.sin(t * 2.2));
    }
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <HeroFormation
        text={profile.brand.toUpperCase()}
        count={formationCount}
        progress={p}
        position={[0, 4.6, -6]}
        worldWidth={13}
      />

      <TerminalText ref={tagline as never} position={[0, -0.6, -6]} fontSize={0.5} color={PALETTE.accent}>
        {profile.tagline}
      </TerminalText>

      <ScrambleText
        words={profile.roles}
        suffix=" DEVELOPER"
        position={[0, -1.7, -6]}
        fontSize={0.34}
        color={PALETTE.textDim}
      />

      <TerminalText ref={hint as never} position={[0, -3.2, -6]} fontSize={0.24} color={PALETTE.textDim}>
        SCROLL TO BEGIN ▼
      </TerminalText>
    </group>
  );
}
