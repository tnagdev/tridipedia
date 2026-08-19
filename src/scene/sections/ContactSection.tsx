import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText, type TroikaText } from '@/text/TerminalText';
import { Hotspot } from '@/objects/Hotspot';
import { HudBracket } from '@/objects/HudBracket';
import { MarkStack, type StackItem } from '@/objects/MarkStack';
import { HeroFormation } from '@/rain/HeroFormation';
import { SOCIAL_BRAND, brandFor } from '@/text/brand';
import { useSectionProgress, type SectionProgress } from '@/scroll/useSectionProgress';
import { content, socials } from '@/content/loadContent';
import { scrollToProgress } from '@/scroll/ScrollProvider';
import { useUi } from '@/state/store';
import { useReducedMotion } from '@/perf/useReducedMotion';
import { PALETTE } from '@/text/palette';
import { clamp01, smoothstep } from '@/scroll/easing';
import { damp } from '@/utils/damp';
import { F } from '@/state/frameState';
import { getRainMaterial } from '@/rain/RainMaterial';
import { GLYPHS, glyphIndexOf } from '@/rain/glyphAtlas';

/**
 * 06 — THE SIGNAL. The finale.
 *
 * The rainfall of the entire site has already reversed by the time you arrive —
 * that is authored in site.json (`flowDir [0,1,0]`, `converge 1`), and with the
 * rotation fix in RainDriver it arrives as a sweep through the tunnel rather
 * than a cut. This section is what REACTS to it, in three beats:
 *
 *   0.00 - 0.30  ASCENT     the rise surges and the funnel tightens; the world's
 *                           near and far planes pull in around you
 *   0.30 - 0.62  FORMATION  the rising rain condenses into LET'S TALK, the whole
 *                           rainfall re-spells itself as the email address, and
 *                           bloom surges. This is the bang.
 *   0.62 - 0.96  CONSOLE    the particles dissolve into real type in the same
 *                           place, and the contact deck resolves under it
 *
 * There is NO PANEL. A HoloPanel draws an opaque, depth-writing back plate, so
 * the old board punched a black rectangle into the middle of the converging
 * funnel at the exact moment of the finale — it was deleting the spectacle it
 * was supposed to sit in. Contrast comes instead from the rain's own text zone
 * (site.json carves a 12-unit hole here, and RainDriver already opens it across
 * beats 1-2) and from troika's per-glyph outline.
 *
 * Every beat is a function of `local` alone. NOTHING here may be gated on
 * `band` or `exit`: for a section whose range ends at 1.0 those fall to zero at
 * the very end of the scroll, so a finale built on them fades out precisely as
 * you arrive.
 */

/* --------------------------------- anchor -------------------------------- */

/** On the funnel axis, 15.2 units from where the camera parks, 0.7 deg off-axis. */
const ANCHOR: [number, number, number] = [0, 21.5, -350.5];

/** 10 characters. sampleTextPoints shrink-to-fits, and past ~12 the strokes thin. */
const HEADLINE = "LET'S TALK";

/* --------------------------------- layout -------------------------------- */
/**
 * Local units, every one of them multiplied by `fit` at use.
 *
 * `fit` may NOT be applied as a group scale. MarkStack's plates and the
 * formation's glyphs both size their quads in VIEW space, so a parent scale
 * shrinks their layout while leaving the quads at full size — on a portrait
 * phone the social plates would physically overlap. Baking the factor into the
 * numbers is the only thing that actually works.
 */
const Y = {
  word: 6.2,
  email: 2.6,
  status: 0.9,
  socials: -2.0,
  caption: -4.6,
  return: -7.4,
};

const SOCIAL_SIZE = 2.9;
const SOCIAL_STEP = 3.7;
const SOCIAL_X = socials.map((_, i) => (i - (socials.length - 1) / 2) * SOCIAL_STEP);

const RETURN_LABEL = 'RETURN TO HOME';
const STATUS = 'OPEN FOR COLLABORATION  ·  READY TO CONNECT';

/* ------------------------------- the re-spell ----------------------------- */

/**
 * '@' has no cell in the glyph atlas; ':' does, and reads as a terminal
 * separator. Anything else without a cell is simply dropped rather than
 * clamped to index 0, which would print a stray katakana in the middle of the
 * address.
 */
const SPELL_SUB: Record<string, string> = { '@': ':' };

function spellCells(s: string): number[] {
  const out: number[] = [];
  for (const ch of s.toUpperCase()) {
    const c = glyphIndexOf(SPELL_SUB[ch] ?? ch);
    if (c >= 0) out.push(c);
  }
  return out.length ? out : [Math.max(0, glyphIndexOf('.'))];
}

const EMAIL_TEXT = content.email ?? 'awaiting signal';
const EMAIL_CELLS = spellCells(content.email ?? 'HELLO');
const EMAIL_SPELL_LEN = Math.min(24, EMAIL_CELLS.length);

/** The scramble pool, restricted to glyphs the atlas actually carries. */
const POOL = GLYPHS.filter((g) => /[A-Z0-9<>|=+\-*:.]/.test(g));

/* ------------------------------ scratch state ----------------------------- */

const NEAR_FADE = new THREE.Vector2();
const FAR_FADE = new THREE.Vector2();

export function ContactSection({ formationCount = 0 }: { formationCount?: number }) {
  const p = useSectionProgress('contact');
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const hovered = useUi((s) => s.hovered);
  /** Section index 5 — arms the hotspots. three raycasts hidden objects too. */
  const live = useUi((s) => s.section) === 5;
  const reduced = useReducedMotion();

  const group = useRef<THREE.Group>(null);
  const headRef = useRef<TroikaText>(null);
  const emailRef = useRef<TroikaText>(null);
  const statusRef = useRef<TroikaText>(null);
  const captionRef = useRef<TroikaText>(null);
  const returnRef = useRef<TroikaText>(null);
  const spellAmt = useRef(0);
  const lastEmail = useRef('');
  /**
   * MarkStack and HudBracket take their opacity/lock as PROPS, captured at
   * render — a ref written in useFrame would never reach them, which is exactly
   * why the plates stayed invisible the first time round. Both damp internally
   * (MarkStack at lambda 9, HudBracket on its own lockRef), so flipping one
   * boolean gives a smooth fade for the cost of a single re-render, which is
   * what this codebase allows: renders on mount, tier change and hover only.
   */
  const [deckOn, setDeckOn] = useState(false);
  const deckOnRef = useRef(false);

  /**
   * A private progress ref for the formation.
   *
   * HeroFormation hard-codes `uForm = min(1, local/0.65)` and `uOpacity = exit`.
   * Handing it this section's own ref would give a word that holds full opacity
   * until 0.85 and vanishes at exactly 1.0 — sitting on top of the console and
   * disappearing at the moment of arrival. Driving a synthesised ref instead
   * needs no change to the component: the `0.65 *` below cancels its own
   * `/0.65`, and `exit` is just a number to write the dissolve envelope into.
   */
  const fp = useRef<SectionProgress>({ local: 0, eased: 0, enter: 0, exit: 0, band: 0 });

  /**
   * Scale factor for the parked frame. Recomputed only on resize, never per
   * frame — `useThree(s => s.size)` re-renders on resize alone.
   */
  const { fit, shiftX } = useMemo(() => {
    const DIST = 15.2;
    const FOV = 74;
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV * 0.5)) * DIST;
    const halfW = halfH * (size.width / Math.max(1, size.height));
    /**
     * The nav is camera-locked chrome roughly 96 CSS pixels wide down the left
     * edge, at EVERY viewport size — so as a fraction of the frame it grows as
     * the frame narrows. Content centred on the frame is therefore centred
     * slightly under the nav at any width, and on a portrait phone the first
     * social plate lands directly behind it. Reserve the gutter and centre in
     * what is left.
     */
    const gutter = (96 / Math.max(1, size.width)) * (halfW * 2);
    // 9.7 = half-width of the widest element plus margin; 9.2 = half-height of
    // the whole stack plus margin.
    const f = Math.min(1, Math.max(0.5, Math.min((halfW - gutter) / 9.7, halfH / 9.2)));
    return { fit: f, shiftX: gutter * 0.5 };
  }, [size.width, size.height]);

  /** Fill the spell array once, and put everything back on the way out. */
  useEffect(() => {
    const u = getRainMaterial().uniforms;
    const arr = u.uSpellGlyphs.value as number[];
    for (let i = 0; i < 24; i++) arr[i] = EMAIL_CELLS[i % EMAIL_CELLS.length];
    // The accent, not white: the fragment mixes toward this at vSpell * 0.85,
    // so pure white would erase the site's identity at its own climax.
    (u.uSpellColor.value as THREE.Color).set(PALETTE.accent);

    return () => {
      // NOT optional. "Contact never unmounts" is only true going forward —
      // useSectionActive drops it the moment smooth < 0.84, which is every
      // scroll back and every nav click. Without this the whole site stays
      // blown out, spelling the address, with the far field cropped at 27.
      u.uSpell.value = 0;
      u.uSpellLen.value = 0;
      (u.uNearFade.value as THREE.Vector2).set(1.6, 5.5);
      (u.uFarFade.value as THREE.Vector2).set(55, 95);
      F.bloom = 0;
    };
  }, []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    // `enter`, never `band` — see the header note.
    g.visible = p.current.enter > 0.001;
    if (!g.visible) return;

    const L = p.current.local;
    const ss = (a: number, b: number) => smoothstep(a, b, L);

    const ascend = ss(0.0, 0.3);
    const tighten = ss(0.05, 0.42) * (1 - ss(0.62, 0.86));
    const charge = ss(0.18, 0.44);
    const bang = ss(0.3, 0.52) * (1 - ss(0.62, 0.8));
    const form = clamp01((L - 0.3) / 0.3);
    const wordOn = ss(0.24, 0.34) * (1 - ss(0.62, 0.78));
    // With no formation to dissolve, the type has to arrive on the beat rather
    // than 16% after it.
    const title = formationCount > 0 ? ss(0.6, 0.76) : ss(0.44, 0.66);
    const deck = ss(0.66, 0.86);
    const resolve = ss(0.7, 0.88);
    const settle = ss(0.8, 0.96);

    if ((deck > 0.5) !== deckOnRef.current) {
      deckOnRef.current = deck > 0.5;
      setDeckOn(deckOnRef.current);
    }

    /* ---------------------------- the card ---------------------------- */
    // A true billboard, not lookAt: the camera pitch swings 7 deg to 73 deg
    // across this section, and lookAt derives its up from world up, so the card
    // would visibly roll on the approach and go ill-conditioned near vertical.
    g.quaternion.copy(camera.quaternion);

    /* ------------------------- the rain, beat 1 ------------------------ */
    // MULTIPLY, never assign, for anything RainDriver writes. It assigns fresh
    // every frame from the section data, so a multiplier modifies the authored
    // art direction instead of replacing it, and there is no discontinuity when
    // this section mounts. This depends on RainDriver's useFrame running FIRST,
    // which it does because World renders it as its first child — if that order
    // ever changes, every one of these silently becomes a no-op, and the
    // failure looks like "the finale got boring" rather than like a bug.
    const u = getRainMaterial().uniforms;
    u.uSpeed.value *= 1 + ascend * 0.4 + bang * 0.4;
    u.uIntensity.value *= 1 + bang * 0.55;
    u.uGlyphSize.value *= 1 - charge * 0.18 + bang * 0.1;
    // Hard ceiling 1.613, where columns land exactly on the axis; past it the
    // funnel turns inside out. 1.38 is tight and still volumetric.
    u.uConverge.value = Math.min(1.45, u.uConverge.value * (1 + tighten * 0.38));
    u.uDensity.value *= 1 - deck * 0.25;

    // Nobody else writes these two, so they are owned outright rather than
    // multiplied. Pulling the far plane from 95 to 45 culls most of the far
    // field through the clip-eject — which is what pays for the formation's
    // extra instances, in the very frames that add them.
    NEAR_FADE.set(1.6 + charge * 3.0, 5.5 + charge * 6.0);
    FAR_FADE.set(55 - charge * 28, 95 - charge * 50);
    (u.uNearFade.value as THREE.Vector2).copy(NEAR_FADE);
    (u.uFarFade.value as THREE.Vector2).copy(FAR_FADE);

    /* ------------------------ the re-spell, beat 2 --------------------- */
    // 0.92 rather than 1.0 leaves a few percent of the original flicker, so the
    // columns still read as alive rather than as a printed sign.
    spellAmt.current = damp(spellAmt.current, bang * 0.92, 5, delta);
    u.uSpell.value = spellAmt.current;
    u.uSpellLen.value = EMAIL_SPELL_LEN;

    F.bloom = bang;

    /* ------------------------ the camera, beat 2 ----------------------- */
    // Post-multiplied onto the rig rather than authored as keyframes: CameraRig
    // is mounted before World, so its useFrame runs first and this lands on top
    // of whatever the spline said. Keyframing a push this short would also have
    // to survive check-journey's step-ratio test, and this does not.
    if (!reduced) {
      const cam = camera as THREE.PerspectiveCamera;
      const want = cam.fov - 6.5 * bang;
      if (Math.abs(cam.fov - want) > 0.01) {
        cam.fov = want;
        cam.updateProjectionMatrix();
      }
      // A short shake across the peak only, not the whole beat.
      const k = ss(0.4, 0.5) * (1 - ss(0.52, 0.62)) * 0.05;
      if (k > 0.0005) {
        camera.position.x += Math.sin(F.time * 41.0) * k;
        camera.position.y += Math.sin(F.time * 37.3) * k;
      }
    }

    /* ------------------------ the formation, beat 2 -------------------- */
    fp.current.local = 0.65 * form;
    fp.current.exit = wordOn;

    /* -------------------------- the copy, beat 3 ----------------------- */
    if (headRef.current) headRef.current.fillOpacity = title;

    const em = emailRef.current;
    if (em) {
      em.fillOpacity = deck;
      // Scroll-driven decrypt. Quantised so `text` re-runs troika's layout at
      // about 14/s rather than 60/s, and guarded so it only fires on change.
      const revealed = Math.floor(resolve * EMAIL_TEXT.length);
      const tick = Math.floor(F.time * 14);
      let out = '';
      for (let i = 0; i < EMAIL_TEXT.length; i++) {
        out += i < revealed ? EMAIL_TEXT[i] : POOL[(tick * 7 + i * 13) % POOL.length];
      }
      if (resolve >= 1) out = EMAIL_TEXT;
      if (out !== lastEmail.current) {
        em.text = out;
        lastEmail.current = out;
      }
    }

    // clipRect wipes: a material uniform, so no layout runs. Declared in
    // TerminalText's own interface and, until now, used nowhere.
    if (statusRef.current) {
      // 35 characters at 0.4 with 0.14 letter-spacing runs about 9.7 wide, so
      // a 9-wide wipe clipped the C off "CONNECTION" and never showed it.
      const w = 12 * fit;
      statusRef.current.clipRect = [-w / 2, -0.5, -w / 2 + w * settle, 0.5];
      statusRef.current.fillOpacity = deck * 0.8;
    }
    if (returnRef.current) {
      const w = 8 * fit;
      returnRef.current.clipRect = [-w / 2, -0.6, -w / 2 + w * settle, 0.6];
    }
    if (captionRef.current) captionRef.current.fillOpacity = deck;
  });

  const hoveredSocial = hovered?.startsWith('social:') ? hovered.slice(7) : null;
  const caption = useMemo(() => {
    const s = socials.find((x) => x.id === hoveredSocial);
    return s ? `${s.label.toUpperCase()}  ${s.handle}  ↗` : socials.map((x) => x.label.toUpperCase()).join('  ·  ');
  }, [hoveredSocial]);

  const marks = useMemo<StackItem[]>(
    () =>
      socials.map((s, i) => ({
        id: `social:${s.id}`,
        markId: s.id,
        color: brandFor(SOCIAL_BRAND, s.id).color,
        position: [SOCIAL_X[i] * fit, Y.socials * fit, 0.6 * fit],
        size: SOCIAL_SIZE * fit,
        layers: 4,
        spread: 0.9,
        fan: 0.34,
      })),
    [fit],
  );

  return (
    <group ref={group} position={ANCHOR} visible={false}>
      {/* Inside the billboarded group, so a local x offset is a SCREEN-space
          offset — which is what clearing the nav gutter needs to be. */}
      <group position={[shiftX, 0, 0]}>
        {/* Corner brackets and nothing else — additive, no back plate, so the
          funnel reads straight through the copy. */}
        <HudBracket
          width={22 * fit}
          height={17 * fit}
          lock={deckOn ? 1 : 0}
          opacity={0.55}
          color={PALETTE.neon}
          position={[0, -0.4 * fit, -0.8]}
        />

        {/* The word, made of rain. Parented so one transform gives it position,
          orientation and framing — the camera looks 73 degrees up the funnel
          axis at the end, so anything world-anchored here stacks on screen. */}
        {formationCount > 0 && (
          <HeroFormation
            text={HEADLINE}
            count={formationCount}
            progress={fp}
            position={[0, Y.word * fit, -0.4]}
            worldWidth={17 * fit}
            glyphSize={0.24 * fit}
          />
        )}

        {/* ...and the type it settles into, in the same place. */}
        <TerminalText
          ref={headRef as never}
          position={[0, Y.word * fit, 0]}
          fontSize={1.8 * fit}
          color={PALETTE.textBright}
          letterSpacing={0.08}
          fillOpacity={0}
        >
          {HEADLINE}
        </TerminalText>

        <TerminalText
          ref={emailRef as never}
          position={[0, Y.email * fit, 0]}
          fontSize={1.0 * fit}
          color={PALETTE.accent}
          fillOpacity={0}
        >
          {EMAIL_TEXT}
        </TerminalText>

        <TerminalText
          ref={statusRef as never}
          position={[0, Y.status * fit, 0]}
          fontSize={0.4 * fit}
          color={PALETTE.textDim}
          letterSpacing={0.14}
          fillOpacity={0}
        >
          {STATUS}
        </TerminalText>

        <MarkStack items={marks} hoveredId={hovered} opacity={deckOn ? 1 : 0} />

        {/* One caption for all four, so the marks are not fenced in by labels. */}
        <TerminalText
          ref={captionRef as never}
          position={[0, Y.caption * fit, 0]}
          fontSize={0.52 * fit}
          color={hoveredSocial ? PALETTE.textBright : PALETTE.textDim}
          letterSpacing={0.08}
          fillOpacity={0}
        >
          {caption}
        </TerminalText>

        <TerminalText
          ref={returnRef as never}
          position={[0, Y.return * fit, 0]}
          fontSize={0.58 * fit}
          color={hovered === 'return' ? PALETTE.textBright : PALETTE.textDim}
          letterSpacing={0.12}
        >
          {RETURN_LABEL}
        </TerminalText>

        {/*
        Armed on the section index rather than left to `visible` to suppress
        them: three raycasts hidden objects, so an unarmed hotspot would still
        swallow the pointer from three sections away.

        The ids are load-bearing — A11yLayer builds its keyboard targets from
        `social:${id}` and `return`.
      */}
        {live &&
          socials.map((s, i) => (
            <Hotspot
              key={s.id}
              id={`social:${s.id}`}
              position={[SOCIAL_X[i] * fit, Y.socials * fit, 0.9]}
              size={[(SOCIAL_STEP - 0.3) * fit, (SOCIAL_SIZE + 0.4) * fit, 1.6]}
              onActivate={() => s.url && window.open(s.url, '_blank', 'noopener')}
            />
          ))}
        {live && (
          <Hotspot
            id="return"
            position={[0, Y.return * fit, 0.4]}
            size={[8 * fit, 1.3 * fit, 1.2]}
            onActivate={() => scrollToProgress(0, { duration: 5 })}
          />
        )}
      </group>
    </group>
  );
}
