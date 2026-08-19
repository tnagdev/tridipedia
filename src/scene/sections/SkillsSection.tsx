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
import { skills, getSection, journey } from '@/content/loadContent';
import { PALETTE } from '@/text/palette';
import { TECH_BRAND, brandFor } from '@/text/brand';
import { J } from '@/camera/journey';
import { damp } from '@/utils/damp';
import { setScrollLock } from '@/scroll/ScrollProvider';
import { getUi, setUi, useUi } from '@/state/store';
import { usePortrait } from '@/state/viewport';
import { navReserve, NAV_Z, REF_FOV as NAV_REF_FOV } from '@/scene/navMetrics';
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
/**
 * Portrait does not use a miss distance at all — it changes the ANCHOR.
 *
 * Everything above measures the offset from the camera's PATH, and that is only
 * the same thing as "off-axis" while the path runs roughly where the camera is
 * looking. Through the skills leg it does not: the journey swings ±8 units
 * sideways over about 28 of depth, a hard S, so a point on the path nine units
 * along it can sit far outside the frame. A landscape frustum is wide enough to
 * catch them anyway. A portrait one is not — measured, the first FOUR skills
 * never appeared on screen at all, at any offset, including offsets small enough
 * to put the mark practically on the path.
 *
 * So portrait anchors each mark to the camera's VIEW AXIS at its own moment
 * instead: AHEAD_P units down the line the camera is actually looking, then
 * offset in the camera's own right/up. Every mark is therefore centred in frame
 * when its slice begins, and drifts off as you fly past it rather than never
 * arriving. Measured over the whole leg, that takes the marks never seen from
 * four to none and lifts the average time on screen by a third.
 */
const AHEAD_P = 8;
/**
 * How far off that axis the marks alternate.
 *
 * Wider than it looks like a narrow frame can afford, and deliberately: a mark
 * placed down the sight line sits at the SAME screen position as the one before
 * it, just nearer, so a small offset piles them on top of each other and there
 * is no way to tap one in particular. Measured across the leg, 0.85 left two
 * marks 0.008 apart in NDC and some pair overlapping 75% of the time; 1.9 takes
 * that to 37%, which is less crowded than the landscape lattice manages.
 */
const RADIUS_P = 1.9;
/** Below the axis, always: the navigation is a bar across the TOP in portrait. */
const RISE_P = -1.0;
const STAGGER_P = 0.6;
/** Marks sit slightly ahead of their slice so you see them coming. */
const LEAD = 0.02;
/** Plate size, matching the weight the About grid gives a skill. */
const MARK_SIZE = 2.4;
const MARK_SIZE_P = 2.0;

const UP_HINT = new THREE.Vector3(0, 1, 0);
const ALT_HINT = new THREE.Vector3(1, 0, 0);

// Scratch for the camera-anchored overlay.
const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const UP = new THREE.Vector3();
const PARK = new THREE.Vector3();
const DOCK = new THREE.Vector3();

/**
 * Lattice layout derived entirely from the skill count.
 *
 * Built for both orientations at module load, because this runs before React
 * exists and World.tsx reads it to carve the rain's per-skill zones. Leaving
 * those zones on the landscape positions would tint empty air.
 */
function buildSkillLayout(portrait: boolean) {
  const n = skills.length;
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const LK = new THREE.Vector3();
  const S0 = new THREE.Vector3();
  const S1 = new THREE.Vector3();

  /** World units the camera covers per unit of journey progress, near `t`. */
  const speedAt = (t: number) => {
    J.pos.getPoint(J.remap(Math.max(0, t - 0.002)), S0);
    J.pos.getPoint(J.remap(Math.min(1, t + 0.002)), S1);
    return Math.max(1e-6, S0.distanceTo(S1) / 0.004);
  };

  return skills.map((s, i) => {
    const local = (i + 0.5) / n;
    const slice = SEC_START + local * SPAN + LEAD;
    /**
     * Portrait places the mark AHEAD_P units down the sight line, so it has to
     * step BACK the same distance in time or every mark ends up that far past
     * where its slice wanted it — and the last of them are then passed after the
     * section has handed over to Experience. Measured, the tail overran the
     * section boundary by a fifth of a slice; converting the distance into
     * progress through the local path speed halves that.
     */
    const t = THREE.MathUtils.clamp(
      portrait ? slice - AHEAD_P / speedAt(slice) : slice,
      0,
      1,
    );
    J.pos.getPoint(J.remap(t), P);
    if (portrait) {
      // The direction the camera is AIMED in at this moment — look-ahead and
      // all, exactly as CameraRig computes it — rather than the direction the
      // path happens to be heading.
      J.look.getPoint(J.remap(Math.min(t + journey.lookAhead, 1)), LK);
      T.subVectors(LK, P).normalize();
    } else {
      J.pos.getTangent(J.remap(t), T).normalize();
    }
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
    // Portrait swaps the axes over: the alternation goes vertical (B) and the
    // stagger horizontal (N). Same idea, turned to match the frame.
    const pos = portrait
      ? P.clone()
        .addScaledVector(T, AHEAD_P)
        .addScaledVector(N, side * RADIUS_P)
        .addScaledVector(B, RISE_P + ((i % 3) - 1) * STAGGER_P)
      : P.clone()
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
}

const LATTICE = { landscape: buildSkillLayout(false), portrait: buildSkillLayout(true) };

/** The landscape lattice, for anything that only needs the ids or the count. */
export const SKILL_LAYOUT = LATTICE.landscape;
export const skillLattice = (portrait: boolean) => (portrait ? LATTICE.portrait : LATTICE.landscape);

const MARK_IDS = SKILL_LAYOUT.map((l) => l.skill.id);

const MARKS = {
  landscape: buildMarks(LATTICE.landscape, MARK_SIZE),
  portrait: buildMarks(LATTICE.portrait, MARK_SIZE_P),
};

function buildMarks(layout: ReturnType<typeof buildSkillLayout>, size: number): StackItem[] {
  return layout.map((l) => ({
    id: `skill:${l.skill.id}`,
    markId: l.skill.id,
    color: l.brand.color,
    position: l.position,
    size,
    layers: 4,
    spread: 0.9,
    fan: 0.5,
  }));
}

/* ------------------------------ the overlay ------------------------------ */

/** How far in front of the camera the overlay sits, and how big it is there. */
const OVERLAY_DIST = 11;
/** Frustum half-height at the NAV's plane — navReserve answers in fractions. */
const navHalfH = Math.tan((NAV_REF_FOV * Math.PI) / 360) * Math.abs(NAV_Z);
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
/**
 * Landscape sets the plinth beside the copy; portrait stacks them, because the
 * pair spans about 17.7 units against a phone's 2.8 of half-width. Both built
 * once, and the landscape numbers are the ones that were always here.
 */
function buildOverlay(portrait: boolean) {
  if (!portrait) {
    return {
      COPY: { x: 0.6, width: 8.2, title: 2.30, blurb: 1.52, bar: -0.86, meta: -1.34, link: -1.96 },
      podium: [-5.2, -0.3, 0] as [number, number, number],
      podiumSize: 3.6,
      podiumRadius: 2.3,
      podiumHeight: 0.62,
      S: { title: 0.62, blurb: 0.28, meta: 0.22, link: 0.22, back: 0.30 },
      blurbLine: 1.55,
      barHeight: 0.14,
      back: [-8.9, 4.7] as [number, number],
      backHit: [-8.0, 4.7] as [number, number],
      backHitSize: [2.8, 0.8, 0.4] as [number, number, number],
      linkHit: [2.1, 0] as [number, number],
      linkHitSize: [4.4, 0.55, 0.4] as [number, number, number],
      /** Portrait only — see the fit in useFrame. */
      fitHalfW: null as number | null,
      contentH: 0,
      contentCentre: 0,
    };
  }

  /**
   * The vertical rhythm here is set by ONE fact about SkillPodium: it draws its
   * plinth at local y = -size * 0.70, so the plinth's underside sits
   * `size * 0.70 + height / 2` below whatever y the podium is given. At the old
   * size 2.4 that put the plinth's bottom edge at 0.87 and the title's top at
   * 0.90 — the heading was printed straight through the plinth. Every row below
   * is now measured from that underside rather than guessed at.
   */
  const podiumY = 3.0;
  const podiumSize = 2.0;
  const podiumHeight = 0.44;
  const plinthBottom = podiumY - podiumSize * 0.70 - podiumHeight / 2;
  const title = plinthBottom - 0.33;

  const COPY = {
    x: -2.6,
    width: 5.2,
    title,
    blurb: title - 0.46 - 0.29,
    bar: title - 0.46 - 0.29 - 1.92 - 0.33,
    meta: title - 0.46 - 0.29 - 1.92 - 0.33 - 0.55,
    link: title - 0.46 - 0.29 - 1.92 - 0.33 - 1.15,
  };
  const contentTop = 4.65 + 0.26 * 0.5;
  const contentBottom = COPY.link - 0.5;
  return {
    COPY,
    podium: [0, podiumY, 0] as [number, number, number],
    podiumSize,
    podiumRadius: 1.4,
    podiumHeight,
    S: { title: 0.46, blurb: 0.22, meta: 0.19, link: 0.19, back: 0.26 },
    blurbLine: 1.45,
    barHeight: 0.13,
    back: [-2.6, 4.65] as [number, number],
    backHit: [-1.35, 4.65] as [number, number],
    backHitSize: [3.0, 1.0, 0.4] as [number, number, number],
    linkHit: [1.9, 0] as [number, number],
    linkHitSize: [3.8, 0.8, 0.4] as [number, number, number],
    fitHalfW: 2.7 as number | null,
    contentH: contentTop - contentBottom,
    contentCentre: (contentTop + contentBottom) * 0.5,
  };
}

const OVERLAY = { landscape: buildOverlay(false), portrait: buildOverlay(true) };

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
  const size = useThree((s) => s.size);
  const hovered = useUi((s) => s.hovered);
  const deployed = useUi((s) => s.skillId);
  const portrait = usePortrait();
  const safeTop = useUi((s) => s.safeTop);
  const O = portrait ? OVERLAY.portrait : OVERLAY.landscape;
  const markSize = portrait ? MARK_SIZE_P : MARK_SIZE;

  const hoveredSkill = hovered?.startsWith('skill:') ? hovered : null;

  const dockGroup = useRef<THREE.Group>(null);
  /** Everything the overlay lays out, shifted clear of the portrait top bar. */
  const copyGroup = useRef<THREE.Group>(null);
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
  const lattice = skillLattice(portrait);
  const active = useMemo(
    () => lattice.find((l) => l.skill.id === deployed) ?? null,
    [deployed, lattice],
  );
  const lastActive = useRef(active);
  if (active) lastActive.current = active;
  const shown = active ?? lastActive.current ?? lattice[0];

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

        /**
         * Portrait alone gets a fit. The landscape overlay has never had one —
         * it is authored to a 16:9 frame and stays there — but a phone frustum
         * is 2.8 units of half-width against the ~9 this column wants, and
         * without this the plinth and the BACK label sit off both edges.
         *
         * Safe to apply as a group SCALE here, unlike the contact deck: this
         * group holds SkillPodium and StatBar, which take world-size props and
         * are already scaled by `e` today. There is no MarkStack inside it.
         */
        let fitP = 1;
        if (O.fitHalfW) {
          const camP = camera as THREE.PerspectiveCamera;
          const hH = Math.tan(THREE.MathUtils.degToRad(camP.fov) * 0.5) * OVERLAY_DIST;
          const hW = hH * camP.aspect;
          const navTop = navReserve({
            portrait: true,
            sizeW: size.width,
            halfW: navHalfH * camP.aspect,
            halfH: navHalfH,
            safeTopWorld: (safeTop * 2 * navHalfH) / Math.max(1, size.height),
          }).top * (hH * 2);
          fitP = Math.min(1, (hW * 0.94) / O.fitHalfW, (2 * hH - navTop) / O.contentH);
          const inner = copyGroup.current;
          if (inner) inner.position.y = fitP > 1e-4 ? -navTop * 0.5 / fitP - O.contentCentre : 0;
        }
        // Scales from ZERO, not from a residual 0.35. Damping only ever
        // approaches its target, so a floor meant the overlay shrank to a third
        // of full size and then vanished the instant it crossed the visibility
        // cutoff. From zero there is nothing left to pop.
        d.scale.setScalar(e * fitP);
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

  const first = lattice[0];
  const tint = shown.brand;
  const backHot = hovered === 'skill-back';

  return (
    <group ref={group}>
      <Conduit id="skills-spine" from={spine.from} to={spine.to} width={0.3} pulses={7} speed={0.2} />

      <MarkStack
        items={portrait ? MARKS.portrait : MARKS.landscape}
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
        lattice.map((l) => (
          <Hotspot
            key={l.skill.id}
            id={`skill:${l.skill.id}`}
            position={l.position}
            size={[markSize * 1.3, markSize * 1.3, markSize * 1.3]}
            onActivate={() => setUi({ skillId: l.skill.id })}
          />
        ))}

      {/* The overlay: plinth left, dossier right, both in the skill's own
          colour, flying in from the mark's own position and locking to the
          camera once there. */}
      <group ref={dockGroup} visible={false}>
        <group ref={copyGroup}>
        <group position={O.podium}>
          <SkillPodium
            markIds={MARK_IDS}
            markId={shown.skill.id}
            color={tint.color}
            size={O.podiumSize}
            radius={O.podiumRadius}
            height={O.podiumHeight}
            renderOrder={LAYER.podium}
            opacity={0.85}
          />
        </group>

        <group>
          <TerminalText
            ref={nameRef as never}
            position={[O.COPY.x, O.COPY.title, 0.06]}
            renderOrder={LAYER.copy}
            material-depthTest={false}
            anchorX="left"
            anchorY="top"
            fontSize={O.S.title}
            color={tint.glow}
            letterSpacing={0.10}
          >
            {first.skill.name.toUpperCase()}
          </TerminalText>
          <TerminalText
            ref={blurbRef as never}
            position={[O.COPY.x, O.COPY.blurb, 0.06]}
            renderOrder={LAYER.copy}
            material-depthTest={false}
            anchorX="left"
            anchorY="top"
            fontSize={O.S.blurb}
            lineHeight={O.blurbLine}
            maxWidth={O.COPY.width}
            color={tint.glow}
            fillOpacity={0.86}
          >
            {first.skill.blurb}
          </TerminalText>
          {/* Proficiency as an instrument rather than a sentence: no words spent. */}
          <StatBar
            width={O.COPY.width}
            height={O.barHeight}
            value={shown.skill.proficiency / 100}
            segments={20}
            position={[O.COPY.x + O.COPY.width / 2, O.COPY.bar, 0.05]}
            color={tint.color}
            renderOrder={LAYER.bar}
            depthTest={false}
          />
          <TerminalText
            ref={metaRef as never}
            position={[O.COPY.x, O.COPY.meta, 0.06]}
            renderOrder={LAYER.copy}
            material-depthTest={false}
            anchorX="left"
            fontSize={O.S.meta}
            color={tint.color}
            letterSpacing={0.06}
          >
            {experienceLine(first.skill)}
          </TerminalText>
          <TerminalText
            ref={linkRef as never}
            position={[O.COPY.x, O.COPY.link, 0.06]}
            renderOrder={LAYER.copy}
            material-depthTest={false}
            anchorX="left"
            fontSize={O.S.link}
            color={tint.glow}
            fillOpacity={hovered === 'skill-link' ? 1 : 0.6}
          >
            {`${hostOf(first.skill.url)}  ↗`}
          </TerminalText>
          <Hotspot
            id="skill-link"
            position={[O.COPY.x + O.linkHit[0], O.COPY.link, 0.2]}
            size={O.linkHitSize}
            onActivate={() => window.open(shown.skill.url, '_blank', 'noopener')}
          />
        </group>

        {/* Back out of the overlay. Escape does the same thing. */}
        <TerminalText
          position={[O.back[0], O.back[1], 0.06]}
          renderOrder={LAYER.copy}
          material-depthTest={false}
          anchorX="left"
          fontSize={O.S.back}
          color={backHot ? tint.glow : PALETTE.textDim}
          letterSpacing={0.14}
        >
          ← BACK
        </TerminalText>
        <Hotspot
          id="skill-back"
          position={[O.backHit[0], O.backHit[1], 0.2]}
          size={O.backHitSize}
          onActivate={() => setUi({ skillId: null })}
        />
        </group>
      </group>
    </group>
  );
}
