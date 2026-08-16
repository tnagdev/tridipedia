import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText } from '@/text/TerminalText';
import { Hotspot } from '@/objects/Hotspot';
import { MarkTiles, type MarkTile } from '@/objects/MarkTiles';
import { SOCIAL_BRAND, brandFor, PLACEHOLDER_MARK } from '@/text/brand';
import { HoloPanel } from '@/objects/HoloPanel';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { content, socials } from '@/content/loadContent';
import { scrollToProgress } from '@/scroll/ScrollProvider';
import { useUi } from '@/state/store';
import { PALETTE } from '@/text/palette';

const Z = -350;
const Y = 22;

export const CONTACT_LAYOUT = socials.map((s, i) => ({
  social: s,
  /** The widget tile. Text sits below it. */
  tilePos: [(i - (socials.length - 1) / 2) * 6.4, Y - 1.6, Z] as [number, number, number],
  position: [(i - (socials.length - 1) / 2) * 6.4, Y - 4.4, Z] as [number, number, number],
}));

/**
 * Social widgets carry their REAL brand colours, except where the link is not
 * published yet — those fall back to a desaturated placeholder mark so the
 * empty state reads as deliberate rather than broken.
 */
const SOCIAL_TILES: MarkTile[] = CONTACT_LAYOUT.map((c) => {
  const brand = c.social.url ? brandFor(SOCIAL_BRAND, c.social.id) : PLACEHOLDER_MARK;
  return {
    id: c.social.id,
    markId: c.social.id,
    color: brand.color,
    position: c.tilePos,
    value: 1,
  };
});

/** 06 — "The Signal". The entire rainfall of the site reverses and rises. */
export function ContactSection() {
  const p = useSectionProgress('contact');
  const group = useRef<THREE.Group>(null);
  const hovered = useUi((s) => s.hovered);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = p.current.enter > 0.001;
  });

  return (
    <group ref={group}>
      {/*
        The social widgets ARE the focal object at the convergence point — the
        rain funnels into something with a purpose instead of a decorative
        solid. One instanced draw for all of them.
      */}
      <MarkTiles
        tiles={SOCIAL_TILES}
        hoveredId={hovered?.startsWith('social:') ? hovered.slice(7) : null}
        size={3.0}
        gauge={false}
      />

      <HoloPanel width={17} height={9.4} position={[0, Y - 1.2, Z - 0.5]} header={0.14} fill={0.16} curve={0.5} />

      <TerminalText position={[0, Y + 3.0, Z]} fontSize={1.35} color={PALETTE.accent}>
        {'> contact --send'}
      </TerminalText>

      <TerminalText
        position={[0, Y + 1.4, Z]}
        fontSize={0.74}
        color={content.email ? PALETTE.text : PALETTE.textDim}
        fillOpacity={content.email ? 1 : 0.72}
      >
        {content.email ?? 'email — awaiting data'}
      </TerminalText>

      {CONTACT_LAYOUT.map((item) => {
        const isHot = hovered === `social:${item.social.id}`;
        return (
          <group key={item.social.id}>
            <TerminalText
              position={item.position}
              fontSize={0.74}
              color={isHot ? PALETTE.textBright : item.social.url ? PALETTE.text : PALETTE.textDim}
              fillOpacity={item.social.url ? 1 : 0.66}
            >
              {item.social.label}
            </TerminalText>
            <TerminalText
              position={[item.position[0], item.position[1] - 1.0, item.position[2]]}
              fontSize={0.52}
              color={PALETTE.textDim}
              fillOpacity={0.7}
            >
              {item.social.handle}
            </TerminalText>
            <Hotspot
              id={`social:${item.social.id}`}
              position={item.tilePos}
              size={[3.4, 3.4, 2.0]}
              onActivate={() => item.social.url && window.open(item.social.url, '_blank', 'noopener')}
            />
          </group>
        );
      })}

      {/* Flies the camera backwards through the entire journey. Free, and a lovely ending. */}
      <TerminalText
        position={[0, Y - 8.4, Z]}
        fontSize={0.52}
        color={hovered === 'return' ? PALETTE.textBright : PALETTE.textDim}
      >
        ↑ RETURN TO ORIGIN
      </TerminalText>
      <Hotspot
        id="return"
        position={[0, Y - 6.2, Z]}
        size={[7, 1.4, 1.2]}
        onActivate={() => scrollToProgress(0, { duration: 5 })}
      />
    </group>
  );
}
