import { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText } from '@/text/TerminalText';
import { HoloPanel } from '@/objects/HoloPanel';
import { StatBar } from '@/objects/StatBar';
import { panelBox } from '@/objects/panelLayout';
import { AsciiImage } from '@/objects/AsciiImage';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { profile, yearsOfExperience, experience } from '@/content/loadContent';
import { PALETTE } from '@/text/palette';
import type { TroikaText } from '@/text/TerminalText';

const Z = -40;

/** 02 — "The Terminal Room". The corridor blooms open into a room. */
const tele = panelBox({ width: 7.2, height: 3.0, header: 0.26 });
const currentRole = experience[experience.length - 1]?.role ?? '';

export function AboutSection({ avatarSrc }: { avatarSrc: string | null }) {
  const p = useSectionProgress('about');
  const group = useRef<THREE.Group>(null);
  const bio = useRef<TroikaText>(null);
  const cursor = useRef<TroikaText>(null);
  const opacity = useRef(0);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const band = p.current.band;
    g.visible = band > 0.001;
    opacity.current = band;

    // Reveal the bio with troika's clipRect rather than re-sync()ing the text,
    // which would re-run layout every frame.
    const t = bio.current;
    if (t) {
      const bb = t.geometry?.boundingBox;
      if (bb) {
        const top = bb.max.y;
        const h = bb.max.y - bb.min.y;
        const reveal = Math.min(1, Math.max(0, (p.current.local - 0.18) / 0.5));
        t.clipRect = [-20, top - h * reveal, 20, top + 0.5];
      }
    }
    if (cursor.current) cursor.current.fillOpacity = band * (Math.sin(clock.elapsedTime * 5) > 0 ? 1 : 0.05);
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <HoloPanel width={11.4} height={8.4} position={[-2.2, 1.4, Z - 1.2]} header={0.13} fill={0.2} curve={1} />
      {/*
        A telemetry readout, not a decorative solid. The wireframe that used to
        sit here carried no information and tangled with the portrait; this
        reports the same facts the machine already knows about itself, derived
        from site.json rather than typed twice.
      */}
      <group position={[7.4, -2.9, Z - 0.4]}>
        <HoloPanel width={7.2} height={3.0} header={0.26} footer={0} fill={0.2} curve={0.3} grid={0.5} backPlate={false} />
        <TerminalText
          position={[tele.left, tele.headerY, 0.06]}
          anchorX="left"
          fontSize={tele.captionSize}
          color={PALETTE.accent}
          letterSpacing={0.16}
        >
          SYSTEM :: TELEMETRY
        </TerminalText>
        <TerminalText
          position={[tele.left, tele.top - tele.bodySize * 0.4, 0.06]}
          anchorX="left"
          fontSize={tele.captionSize}
          color={PALETTE.textDim}
        >
          {`UPTIME ${yearsOfExperience} YRS   ·   SINCE ${profile.codingSince}`}
        </TerminalText>
        <StatBar
          width={tele.width}
          height={0.16}
          value={1}
          segments={yearsOfExperience}
          position={[0, tele.top - tele.bodySize * 1.5, 0.06]}
          color={PALETTE.accent}
        />
        <TerminalText
          position={[tele.left, tele.bottom + tele.bodySize * 0.5, 0.06]}
          anchorX="left"
          fontSize={tele.captionSize}
          color={PALETTE.textDim}
        >
          {`ROLE ${currentRole}`}
        </TerminalText>
        <TerminalText
          position={[tele.left, tele.bottom - tele.bodySize * 0.3, 0.06]}
          anchorX="left"
          fontSize={tele.captionSize}
          color={PALETTE.textDim}
        >
          {`NODE ${profile.location}   ·   STATUS RUNNING`}
        </TerminalText>
      </group>

      <TerminalText position={[-7.4, 4.6, Z]} fontSize={0.34} anchorX="left" color={PALETTE.accent}>
        {`> cat about.md`}
      </TerminalText>

      <TerminalText
        ref={bio as never}
        position={[-7.4, 3.4, Z]}
        fontSize={0.3}
        anchorX="left"
        anchorY="top"
        maxWidth={9.4}
        lineHeight={1.6}
        color={PALETTE.text}
      >
        {profile.bio}
      </TerminalText>

      <TerminalText position={[-7.4, -2.9, Z]} fontSize={0.26} anchorX="left" color={PALETTE.textDim}>
        {`${yearsOfExperience} years · ${profile.location}`}
      </TerminalText>
      <TerminalText ref={cursor as never} position={[-3.2, -2.9, Z]} fontSize={0.26} color={PALETTE.accent}>
        █
      </TerminalText>

      {avatarSrc && (
        <Suspense fallback={null}>
          <AsciiImage src={avatarSrc} width={5.9} height={5.9} cols={78} rows={78} position={[7.4, 2.1, Z]} gain={2.3} />
        </Suspense>
      )}
    </group>
  );
}
