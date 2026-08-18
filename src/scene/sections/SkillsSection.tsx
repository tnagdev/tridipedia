import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText, type TroikaText } from '@/text/TerminalText';
import { MarkStack, type StackItem } from '@/objects/MarkStack';
import { SkillPodium } from '@/objects/SkillPodium';
import { StatBar } from '@/objects/StatBar';
import { Hotspot } from '@/objects/Hotspot';
import { Conduit } from '@/objects/Conduit';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { skills, getSection } from '@/content/loadContent';
import { PALETTE } from '@/text/palette';
import { TECH_BRAND, brandFor } from '@/text/brand';
import { J } from '@/camera/journey';
import { damp } from '@/utils/damp';
import { setScrollLock } from '@/scroll/ScrollProvider';
import { getUi, setUi, useUi } from '@/state/store';
import { getRainMaterial } from '@/rain/RainMaterial';
import { glyphIndexOf } from '@/rain/glyphAtlas';

/**
 * 03 — THE SKILL LATTICE.
 *
 * Marks are strung along the CAMERA SPLINE ITSELF rather than at hand-placed
 * world coordinates: each skill takes an equal slice of the section's scroll
 * range, and its position is sampled off the curve at that point plus a small
 * offset. Two consequences worth the trouble:
 *
 *  - The camera is guaranteed to meet every mark, at any fov, without a single
 *    coordinate tuned by eye.
 *  - The layout is a pure function of skills.length. Adding a tenth skill to
 *    site.json re-spaces the lattice automatically; no code changes.
 *
 * The marks are the same object as the About section's buttons — a stack of
 * plates in the technology's own brand colour that peels apart under the
 * pointer — so a skill looks the same wherever you meet it.
 *
 * Click one and it OPENS: the mark leaves the lattice and flies into a
 * full-frame overlay, landing on a rotating plinth as a hologram beside a
 * dossier in the technology's own colour. The rain re-spells itself in that
 * skill's name at the same time (uSpell in rain.vert.glsl) — clicking
 * reprograms the Matrix.
 */

const [SEC_START, SEC_END] = getSection('skills').range;
const SPAN = SEC_END - SEC_START;

/**
 * How far each mark sits off the camera's path.
 *
 * This is the MISS DISTANCE, and it is the whole difference between flying
 * through the lattice and watching it stream past the edge of frame. Marks are
 * roughly 9 units apart along the path, so an offset of 3 puts a mark about 18
 * degrees off-axis as you come up on it — comfortably inside the frame — while
 * the old 9.5 put it nearer 45 and half of them never crossed the screen at all.
 */
const RADIUS = 3.0;
/** Marks sit slightly ahead of their slice so you see them coming. */
const LEAD = 0.02;
/** Plate size, matching the weight the About grid gives a skill. */
const MARK_SIZE = 2.4;

const UP_HINT = new THREE.Vector3(0, 1, 0);
const ALT_HINT = new THREE.Vector3(1, 0, 0);

// Scratch for the camera-anchored overlay.
const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const UP = new THREE.Vector3();
const PARK = new THREE.Vector3();
const DOCK = new THREE.Vector3();

/** Lattice layout derived entirely from the skill count. */
export const SKILL_LAYOUT = (() => {
  const n = skills.length;
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();

  return skills.map((s, i) => {
    const local = (i + 0.5) / n;
    const t = THREE.MathUtils.clamp(SEC_START + local * SPAN + LEAD, 0, 1);
    J.pos.getPoint(J.remap(t), P);
    J.pos.getTangent(J.remap(t), T).normalize();
    N.crossVectors(Math.abs(T.y) > 0.95 ? ALT_HINT : UP_HINT, T).normalize();
    B.crossVectors(T, N).normalize();

    // A controlled zig-zag rather than a golden-angle helix. The helix spread
    // marks evenly around the path, which reads well in a diagram and badly in
    // a first-person fly-through: a third of them ended up overhead, where they
    // collide with the camera-locked nav bar, and the rest arrived at whatever
    // clock position the sequence happened to land on. Alternating left and
    // right with a small vertical stagger puts every mark in the same part of
    // frame as you approach it, and always below the nav.
    const side = i % 2 === 0 ? -1 : 1;
    const rise = ((i % 3) - 1) * 0.8;
    const pos = P.clone()
      .addScaledVector(N, side * RADIUS)
      .addScaledVector(B, rise - 1.2);

    return {
      skill: s,
      brand: brandFor(TECH_BRAND, s.id),
      position: [pos.x, pos.y, pos.z] as [number, number, number],
      range: [SEC_START + (i / n) * SPAN, SEC_START + ((i + 1) / n) * SPAN] as [number, number],
      index: i,
    };
  });
})();

const MARK_IDS = SKILL_LAYOUT.map((l) => l.skill.id);

const MARKS: StackItem[] = SKILL_LAYOUT.map((l) => ({
  id: `skill:${l.skill.id}`,
  markId: l.skill.id,
  color: l.brand.color,
  position: l.position,
  size: MARK_SIZE,
  layers: 4,
  spread: 0.9,
  fan: 0.5,
}));

/* ------------------------------ the overlay ------------------------------ */

/** How far in front of the camera the overlay sits, and how big it is there. */
const OVERLAY_DIST = 11;
/**
 * The overlay is a screen-space LAYER, not world geometry: the camera stands
 * inside the lattice, so depth alone can never keep the rain off the copy.
 * Everything in it runs depthTest off and is ordered by hand. Kept below the
 * nav's 995-999 so the navigation is never covered by a popup.
 */
const LAYER = { podium: 810, bar: 820, copy: 830 };

/**
 * The overlay is deliberately UNFRAMED: a plinth, a column of type, and the
 * glass behind them. A panel around the copy was one box too many — the scrim
 * already separates it from the world, and its frame only competed with the
 * hologram for attention. Positions are absolute rather than derived from a
 * panelBox, because there is no panel left to derive them from.
 */
const COPY = {
  x: 0.6,
  width: 8.2,
  title: 2.30,
  blurb: 1.52,
  bar: -0.86,
  meta: -1.34,
  link: -1.96,
};

/** Atlas cells for a skill name, used by the rain re-spell. */
function spellCells(name: string): number[] {
  const clean = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.split('').map((c) => Math.max(0, glyphIndexOf(c)));
}

const SPELL_CACHE = new Map<string, number[]>(
  SKILL_LAYOUT.map((l) => [l.skill.id, spellCells(l.skill.name)]),
);

/** Never empty: falls back to the numbers already in site.json. */
function experienceLine(s: (typeof skills)[number]): string {
  return s.note ?? `${s.years} YRS HANDS-ON  ·  ${s.proficiency}% CONFIDENCE`;
}

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function SkillsSection() {
  const p = useSectionProgress('skills');
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const hovered = useUi((s) => s.hovered);
  const deployed = useUi((s) => s.skillId);

  const hoveredSkill = hovered?.startsWith('skill:') ? hovered : null;

  const dockGroup = useRef<THREE.Group>(null);
  const nameRef = useRef<TroikaText>(null);
  const blurbRef = useRef<TroikaText>(null);
  const metaRef = useRef<TroikaText>(null);
  const linkRef = useRef<TroikaText>(null);
  const dock = useRef(0);
  const spellAmt = useRef(0);
  const shownId = useRef<string | null>(null);

  /**
   * The skill the overlay is showing. Held after deselection so it can play its
   * exit with the right copy still in it instead of blanking mid-flight.
   */
  const active = useMemo(
    () => SKILL_LAYOUT.find((l) => l.skill.id === deployed) ?? null,
    [deployed],
  );
  const lastActive = useRef(active);
  if (active) lastActive.current = active;
  const shown = active ?? lastActive.current ?? SKILL_LAYOUT[0];

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

  // The overlay is modal, so the journey holds where it is until it closes.
  useEffect(() => {
    setScrollLock(deployed !== null);
    return () => setScrollLock(false);
  }, [deployed]);

  // Opening unmounts the lattice hotspots, and a hotspot that disappears under
  // the pointer never gets to fire its pointer-out — the hover would stay stuck
  // on the mark that opened the overlay for as long as it was up.
  useEffect(() => {
    if (deployed && getUi().hovered?.startsWith('skill:')) setUi({ hovered: null });
  }, [deployed]);

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

    // --- the overlay flies in from wherever the mark was standing ---
    // Leaves a shade slower than it arrives, so the exit reads as deliberate.
    dock.current = damp(dock.current, active ? 1 : 0, active ? 6 : 5, delta);
    const d = dockGroup.current;
    if (d) {
      d.visible = dock.current > 0.0008;
      if (d.visible) {
        camera.getWorldDirection(FWD);
        RIGHT.crossVectors(FWD, camera.up).normalize();
        UP.crossVectors(RIGHT, FWD).normalize();

        // Where it ends up: locked to the camera, so it holds ONE legible size
        // for the whole section however far away the mark it came from was.
        DOCK.copy(camera.position).addScaledVector(FWD, OVERLAY_DIST);
        // Where it starts: the mark's own place in the lattice.
        PARK.set(...(shown.position as [number, number, number]));

        const e = dock.current * dock.current * (3 - 2 * dock.current); // smoothstep
        d.position.lerpVectors(PARK, DOCK, e);
        d.quaternion.copy(camera.quaternion);
        // Scales from ZERO, not from a residual 0.35. Damping only ever
        // approaches its target, so a floor meant the overlay shrank to a third
        // of full size and then vanished the instant it crossed the visibility
        // cutoff. From zero there is nothing left to pop.
        d.scale.setScalar(e);
      }
    }

    // Swap copy only when the shown skill actually changes — assigning troika
    // `text` re-runs layout and must never happen per frame.
    if (shown.skill.id !== shownId.current) {
      shownId.current = shown.skill.id;
      if (nameRef.current) nameRef.current.text = shown.skill.name.toUpperCase();
      if (blurbRef.current) blurbRef.current.text = shown.skill.blurb;
      if (metaRef.current) metaRef.current.text = experienceLine(shown.skill);
      if (linkRef.current) linkRef.current.text = `${hostOf(shown.skill.url)}  ↗`;
    }
  });

  const first = SKILL_LAYOUT[0];
  const tint = shown.brand;
  const backHot = hovered === 'skill-back';

  return (
    <group ref={group}>
      <Conduit id="skills-spine" from={spine.from} to={spine.to} width={0.3} pulses={7} speed={0.2} />

      <MarkStack
        items={MARKS}
        hoveredId={hoveredSkill}
        hiddenId={active ? `skill:${active.skill.id}` : null}
        opacity={active ? 0 : 1}
      />

      {/*
        Raycast targets: the marks are one instanced mesh and cannot be picked
        individually, so each gets an invisible box.

        Unmounted entirely while the overlay is up. Nothing is laid over the
        world any more, and the camera stands right among the lattice, so an
        open skill's own box is NEARER than the overlay and would win the ray —
        it was eating the link and closing the panel on a click meant for it.
      */}
      {!deployed &&
        SKILL_LAYOUT.map((l) => (
          <Hotspot
            key={l.skill.id}
            id={`skill:${l.skill.id}`}
            position={l.position}
            size={[MARK_SIZE * 1.3, MARK_SIZE * 1.3, MARK_SIZE * 1.3]}
            onActivate={() => setUi({ skillId: l.skill.id })}
          />
        ))}

      {/* The overlay: plinth left, dossier right, both in the skill's own
          colour, flying in from the mark's own position and locking to the
          camera once there. */}
      <group ref={dockGroup} visible={false}>
        <group position={[-5.2, -0.3, 0]}>
          <SkillPodium
            markIds={MARK_IDS}
            markId={shown.skill.id}
            color={tint.color}
            size={3.6}
            radius={2.3}
            height={0.62}
            renderOrder={LAYER.podium}
            opacity={0.85}
          />
        </group>

        <group>
          <TerminalText
            ref={nameRef as never}
            position={[COPY.x, COPY.title, 0.06]}
            renderOrder={LAYER.copy}
            material-depthTest={false}
            anchorX="left"
            anchorY="top"
            fontSize={0.62}
            color={tint.glow}
            letterSpacing={0.10}
          >
            {first.skill.name.toUpperCase()}
          </TerminalText>
          <TerminalText
            ref={blurbRef as never}
            position={[COPY.x, COPY.blurb, 0.06]}
            renderOrder={LAYER.copy}
            material-depthTest={false}
            anchorX="left"
            anchorY="top"
            fontSize={0.28}
            lineHeight={1.55}
            maxWidth={COPY.width}
            color={tint.glow}
            fillOpacity={0.86}
          >
            {first.skill.blurb}
          </TerminalText>
          {/* Proficiency as an instrument rather than a sentence: no words spent. */}
          <StatBar
            width={COPY.width}
            height={0.14}
            value={shown.skill.proficiency / 100}
            segments={20}
            position={[COPY.x + COPY.width / 2, COPY.bar, 0.05]}
            color={tint.color}
            renderOrder={LAYER.bar}
            depthTest={false}
          />
          <TerminalText
            ref={metaRef as never}
            position={[COPY.x, COPY.meta, 0.06]}
            renderOrder={LAYER.copy}
            material-depthTest={false}
            anchorX="left"
            fontSize={0.22}
            color={tint.color}
            letterSpacing={0.06}
          >
            {experienceLine(first.skill)}
          </TerminalText>
          <TerminalText
            ref={linkRef as never}
            position={[COPY.x, COPY.link, 0.06]}
            renderOrder={LAYER.copy}
            material-depthTest={false}
            anchorX="left"
            fontSize={0.22}
            color={tint.glow}
            fillOpacity={hovered === 'skill-link' ? 1 : 0.6}
          >
            {`${hostOf(first.skill.url)}  ↗`}
          </TerminalText>
          <Hotspot
            id="skill-link"
            position={[COPY.x + 2.1, COPY.link, 0.2]}
            size={[4.4, 0.55, 0.4]}
            onActivate={() => window.open(shown.skill.url, '_blank', 'noopener')}
          />
        </group>

        {/* Back out of the overlay. Escape does the same thing. */}
        <TerminalText
          position={[-8.9, 4.7, 0.06]}
          renderOrder={LAYER.copy}
          material-depthTest={false}
          anchorX="left"
          fontSize={0.30}
          color={backHot ? tint.glow : PALETTE.textDim}
          letterSpacing={0.14}
        >
          ← BACK
        </TerminalText>
        <Hotspot
          id="skill-back"
          position={[-8.0, 4.7, 0.2]}
          size={[2.8, 0.8, 0.4]}
          onActivate={() => setUi({ skillId: null })}
        />
      </group>
    </group>
  );
}
