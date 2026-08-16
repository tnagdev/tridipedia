import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText, type TroikaText } from '@/text/TerminalText';
import { MarkTiles, type MarkTile } from '@/objects/MarkTiles';
import { HoloPanel } from '@/objects/HoloPanel';
import { HudBracket } from '@/objects/HudBracket';
import { StatBar } from '@/objects/StatBar';
import { Conduit } from '@/objects/Conduit';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { skills, getSection } from '@/content/loadContent';
import { PALETTE } from '@/text/palette';
import { TECH_BRAND, brandFor } from '@/text/brand';
import { panelBox } from '@/objects/panelLayout';
import { J } from '@/camera/journey';
import { F } from '@/state/frameState';
import { clamp01 } from '@/scroll/easing';
import { getUi, setUi, useUi } from '@/state/store';
import { getRainMaterial } from '@/rain/RainMaterial';
import { glyphIndexOf } from '@/rain/glyphAtlas';

/**
 * 03 — THE SKILL LATTICE.
 *
 * Chips are strung in a helix around the CAMERA SPLINE ITSELF rather than at
 * hand-placed world coordinates: each skill takes an equal slice of the
 * section's scroll range, and its position is sampled off the curve at that
 * point plus a radial offset. Two consequences worth the trouble:
 *
 *  - The camera is guaranteed to fly straight through the lattice, at any fov,
 *    without a single coordinate tuned by eye.
 *  - The layout is a pure function of skills.length. Adding a tenth skill to
 *    site.json re-spaces the helix automatically; no code changes.
 *
 * The game: hover a chip and its gauge charges to the real proficiency. Click
 * and the chip DEPLOYS — the whole rain re-spells itself with that skill's name
 * in its brand colour (uSpell in rain.vert.glsl). Clicking reprograms the
 * Matrix, which is the point.
 */

const [SEC_START, SEC_END] = getSection('skills').range;
const SPAN = SEC_END - SEC_START;

/** Radial distance of the chips from the camera path. */
const RADIUS = 9.5;
/** Chips sit slightly ahead of their slice so you see them coming. */
const LEAD = 0.02;

const UP_HINT = new THREE.Vector3(0, 1, 0);
const ALT_HINT = new THREE.Vector3(1, 0, 0);

// Scratch for the camera-anchored readout.
const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const UP = new THREE.Vector3();

/** Helix layout derived entirely from the skill count. */
export const SKILL_LAYOUT = (() => {
  const n = skills.length;
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  // Golden angle keeps chips from stacking behind one another however many
  // there are, unlike a fixed step which repeats every few items.
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));

  return skills.map((s, i) => {
    const local = (i + 0.5) / n;
    const t = THREE.MathUtils.clamp(SEC_START + local * SPAN + LEAD, 0, 1);
    J.pos.getPoint(J.remap(t), P);
    J.pos.getTangent(J.remap(t), T).normalize();
    N.crossVectors(Math.abs(T.y) > 0.95 ? ALT_HINT : UP_HINT, T).normalize();
    B.crossVectors(T, N).normalize();

    // Flattened and biased BELOW the path rather than a true circular helix.
    // A full-circle helix puts roughly a third of the chips directly overhead,
    // where they collide with the camera-locked nav bar across the top of frame
    // — the nav has depthTest off, so nothing can pass behind it.
    const theta = i * GOLDEN;
    const pos = P.clone()
      .addScaledVector(N, Math.cos(theta) * RADIUS)
      .addScaledVector(B, Math.sin(theta) * RADIUS * 0.45 - 2.6);

    return {
      skill: s,
      brand: brandFor(TECH_BRAND, s.id),
      position: [pos.x, pos.y, pos.z] as [number, number, number],
      range: [SEC_START + (i / n) * SPAN, SEC_START + ((i + 1) / n) * SPAN] as [number, number],
      index: i,
    };
  });
})();

const TILES: MarkTile[] = SKILL_LAYOUT.map((l) => ({
  id: l.skill.id,
  markId: l.skill.id,
  color: l.brand.color,
  position: l.position,
  value: l.skill.proficiency / 100,
}));

/** Atlas cells for a skill name, used by the rain re-spell. */
function spellCells(name: string): number[] {
  const clean = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.split('').map((c) => Math.max(0, glyphIndexOf(c)));
}

const SPELL_CACHE = new Map<string, number[]>(
  SKILL_LAYOUT.map((l) => [l.skill.id, spellCells(l.skill.name)]),
);

export function SkillsSection() {
  const p = useSectionProgress('skills');
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const hovered = useUi((s) => s.hovered);
  const deployed = useUi((s) => s.skillId);

  const hoveredSkill = hovered?.startsWith('skill:') ? hovered.slice(6) : null;

  const readout = useRef<THREE.Group>(null);
  const nameRef = useRef<TroikaText>(null);
  const metaRef = useRef<TroikaText>(null);
  const activeRef = useRef(0);
  const spellAmt = useRef(0);
  const box = useMemo(() => panelBox({ width: 8.6, height: 5.0, header: 0.2 }), []);

  const spine = useMemo(() => {
    const A = new THREE.Vector3();
    const Bv = new THREE.Vector3();
    J.pos.getPoint(J.remap(SEC_START + 0.01), A);
    J.pos.getPoint(J.remap(SEC_END - 0.01), Bv);
    return {
      from: [A.x, A.y, A.z] as [number, number, number],
      to: [Bv.x, Bv.y, Bv.z] as [number, number, number],
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && getUi().skillId) setUi({ skillId: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Releasing the rain on unmount is essential — otherwise the entire world
  // keeps spelling "REACT" for the rest of the journey.
  useEffect(() => {
    return () => {
      const u = getRainMaterial().uniforms;
      u.uSpell.value = 0;
      u.uSpellLen.value = 0;
    };
  }, []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    g.visible = p.current.band > 0.001;

    const u = getRainMaterial().uniforms;

    if (!g.visible) {
      spellAmt.current += (0 - spellAmt.current) * Math.min(1, delta * 6);
      u.uSpell.value = spellAmt.current;
      if (getUi().skillId) setUi({ skillId: null });
      return;
    }

    const local = clamp01((F.smooth - SEC_START) / SPAN);
    const idx = Math.min(SKILL_LAYOUT.length - 1, Math.floor(local * SKILL_LAYOUT.length));
    const focusId = deployed ?? hoveredSkill ?? SKILL_LAYOUT[idx].skill.id;
    const focus = SKILL_LAYOUT.find((l) => l.skill.id === focusId) ?? SKILL_LAYOUT[idx];

    // --- rain re-spell ---
    const wantSpell = deployed ? 1 : 0;
    spellAmt.current += (wantSpell - spellAmt.current) * Math.min(1, delta * 5);
    u.uSpell.value = spellAmt.current;
    if (deployed) {
      const cells = SPELL_CACHE.get(deployed);
      if (cells && cells.length) {
        const arr = u.uSpellGlyphs.value as number[];
        for (let i = 0; i < 24; i++) arr[i] = cells[i % cells.length];
        u.uSpellLen.value = Math.min(24, cells.length);
        (u.uSpellColor.value as THREE.Color).set(brandFor(TECH_BRAND, deployed).color);
      }
    }

    // --- readout is CAMERA-anchored, not chip-anchored ---
    // Anchored to the chip it sat at whatever distance that chip happened to be
    // — as little as 5 units — where a 9.6-wide panel swallows the whole frame.
    // Camera-anchored it holds one legible size for the entire section, the
    // same fix the job card and dossier needed.
    const r = readout.current;
    if (r) {
      camera.getWorldDirection(FWD);
      RIGHT.crossVectors(FWD, camera.up).normalize();
      UP.crossVectors(RIGHT, FWD).normalize();
      r.position
        .copy(camera.position)
        .addScaledVector(FWD, 15)
        .addScaledVector(RIGHT, 3.0)
        .addScaledVector(UP, -3.4);
      r.quaternion.copy(camera.quaternion);
      r.visible = p.current.band > 0.02;
    }

    // Swap copy only when the focus actually changes — assigning troika `text`
    // re-runs layout and must never happen per frame.
    if (focus.index !== activeRef.current) {
      activeRef.current = focus.index;
      if (nameRef.current) nameRef.current.text = focus.skill.name.toUpperCase();
      if (metaRef.current) metaRef.current.text = `${focus.skill.proficiency}%   ·   ${focus.skill.years} YRS`;
    }
  });

  const first = SKILL_LAYOUT[0];

  return (
    <group ref={group}>
      <Conduit id="skills-spine" from={spine.from} to={spine.to} width={0.3} pulses={7} speed={0.2} />

      <MarkTiles tiles={TILES} hoveredId={hoveredSkill} activeId={deployed} size={2.6} gauge />

      {/* Raycast targets: the tiles are one instanced mesh and cannot be picked
          individually, so each chip gets an invisible box. */}
      {SKILL_LAYOUT.map((l) => (
        <mesh
          key={l.skill.id}
          position={l.position}
          visible={false}
          onPointerOver={(e) => {
            e.stopPropagation();
            setUi({ hovered: `skill:${l.skill.id}` });
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setUi({ hovered: null });
            document.body.style.cursor = 'auto';
          }}
          onClick={(e) => {
            e.stopPropagation();
            setUi({ skillId: getUi().skillId === l.skill.id ? null : l.skill.id });
          }}
        >
          <boxGeometry args={[3.6, 3.6, 3.6]} />
        </mesh>
      ))}

      {/* ONE readout for the current chip rather than a label per chip — keeps
          the live text count at 4 however many skills exist. */}
      <group ref={readout}>
        <HoloPanel width={8.6} height={5.0} header={0.2} footer={0} fill={0.2} curve={0.4} grid={0.6} />
        <HudBracket width={9.3} height={5.6} lock={1} opacity={0.7} color={first.brand.color} />
        <TerminalText
          ref={nameRef as never}
          position={[box.left, box.headerY, 0.06]}
          anchorX="left"
          fontSize={box.titleSize}
          color={PALETTE.textBright}
          letterSpacing={0.12}
        >
          {first.skill.name.toUpperCase()}
        </TerminalText>
        <StatBar
          width={box.width}
          height={0.2}
          value={(deployed ? SKILL_LAYOUT.find((l) => l.skill.id === deployed)?.skill.proficiency ?? 0 : first.skill.proficiency) / 100}
          position={[0, box.top - 0.45, 0.06]}
          color={PALETTE.accent}
        />
        <TerminalText
          ref={metaRef as never}
          position={[box.left, box.bottom + box.bodySize * 0.9, 0.06]}
          anchorX="left"
          fontSize={box.captionSize}
          color={PALETTE.textDim}
        >
          {`${first.skill.proficiency}%   ·   ${first.skill.years} YRS`}
        </TerminalText>
        <TerminalText
          position={[box.right, box.bottom + box.bodySize * 0.9, 0.06]}
          anchorX="right"
          fontSize={box.captionSize}
          color={deployed ? '#FFB23F' : PALETTE.textDim}
        >
          {deployed ? '[ ESC TO RELEASE ]' : '[ CLICK TO DEPLOY ]'}
        </TerminalText>
      </group>
    </group>
  );
}
