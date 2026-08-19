import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText } from '@/text/TerminalText';
import { VolumeText } from '@/objects/VolumeText';
import { ScrambleText } from '@/text/ScrambleText';
import { HeroFormation } from '@/rain/HeroFormation';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { smoothstep } from '@/scroll/easing';
import { profile } from '@/content/loadContent';
import { PALETTE } from '@/text/palette';
import type { TroikaText } from '@/text/TerminalText';

/**
 * The scroll prompt.
 *
 * Set VERTICALLY, one glyph per line, so it reads as a column of this rain
 * rather than as a banner hung in front of the scene — but it HOLDS, dead centre
 * of frame, instead of falling with the rest. It is the one fixed thing in a
 * world that is entirely in motion, which is what makes the eye go to it.
 *
 * The characters are solid and they turn: <VolumeText /> builds each one from a
 * stack of quads along its own local Z and swings it on its own axis, phase-
 * offset per character so the word ripples down the column. That rotation is
 * the only movement here now, and it is enough.
 *
 * Sized to fill most of the frame height while staying wholly on screen — at
 * these numbers the column is about 24 units against a 35-unit frame.
 */
const HINT = 'SCROLL TO BEGIN';
const HINT_SIZE = 2.6;
/**
 * Well under 1, so the glyphs sit tight enough to read as one heavy line rather
 * than as separated characters. The atlas leaves roughly a quarter of each cell
 * as padding, so they close up without actually colliding.
 */
const HINT_SPACING = 0.62;

/**
 * Where it sits. The hero camera starts at (0, 2, 22) looking level at (0, 2, 0),
 * so the frame's centre line at this depth is y 2 — not y 0. The column is
 * centred on its own origin, so this puts it dead centre of frame.
 */
const HINT_POS: [number, number, number] = [0, 2, -2];

/** 01 — "Boot". You open INSIDE the rain, not looking at it. */
export function HeroSection({ formationCount }: { formationCount: number }) {
  const p = useSectionProgress('hero');
  const group = useRef<THREE.Group>(null);
  const tagline = useRef<TroikaText>(null);
  /** Driven per frame; VolumeText reads it in onBeforeRender. */
  const hintOpacity = useRef(0);
  const hintGroup = useRef<THREE.Group>(null);

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

    // The prompt lives OUTSIDE the faded group above, and that is the whole
    // point of it: the group is gated on `band`, which is zero at local 0, so
    // the site opens on bare rain with nothing in it — deliberately, per the
    // note above. The one moment a scroll prompt is needed is the one moment
    // every other thing in the hero is hidden.
    const hg = hintGroup.current;
    if (hg) {
      // It does not move. The only thing driven here is whether it is still
      // wanted: gone once you start scrolling, because it has done its job by
      // then and a prompt that outstays its welcome reads as decoration.
      const fade = 1 - smoothstep(0, 0.12, p.current.local);
      hg.visible = fade > 0.002;

      const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);
      hintOpacity.current = fade * (0.82 + 0.18 * pulse);
    }
  });

  return (
    <>
      <group ref={hintGroup} position={HINT_POS} visible={false}>
        <VolumeText
          text={HINT}
          size={HINT_SIZE}
          spacing={HINT_SPACING}
          direction="down"
          depth={0.95}
          slices={16}
          spin={0.7}
          swing={0.8}
          phase={0.42}
          color={PALETTE.rain}
          headColor={PALETTE.rainHead}
          opacityRef={hintOpacity}
        />
      </group>

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
      </group>
    </>
  );
}
