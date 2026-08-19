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
import { usePortrait } from '@/state/viewport';
import { navReserve, NAV_Z, REF_FOV } from '@/scene/navMetrics';

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

/**
 * The frustum half-height at the NAV's plane, not this section's. navReserve
 * answers in fractions of the frame, and a fraction only means anything if both
 * sides measure it at the same depth.
 */
const navHalfH = Math.tan((REF_FOV * Math.PI) / 360) * Math.abs(NAV_Z);

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

/**
 * Landscape and portrait, built once each at module load.
 *
 * The landscape numbers are the ones that were always here, moved rather than
 * re-derived. Portrait is not a scaled copy of them: four social plates in a row
 * are 14.8 units wide against a frame half-width of 5.3, so the row has to
 * become a 2x2 block and the type has to come down with it. Scaling alone would
 * have put the email address at a quarter size.
 */
function buildLayout(portrait: boolean) {
  const n = socials.length;
  if (!portrait) {
    return {
      Y: { word: 6.2, email: 2.6, status: 0.9, socials: -2.0, caption: -4.6, return: -7.4 },
      socialSize: 2.9,
      socialStep: 3.7,
      socialX: socials.map((_, i) => (i - (n - 1) / 2) * 3.7),
      socialY: socials.map(() => -2.0),
      /** Half-extents the fit is solved against. */
      halfW: 9.7,
      halfH: 9.2,
      size: { head: 1.8, email: 1.0, status: 0.4, caption: 0.52, return: 0.58 },
      bracket: [22, 17] as [number, number],
      bracketY: -0.4,
      /** Landscape's stack is already centred on the camera axis. */
      contentCentre: 0,
      formationW: 17,
      /** Wipe widths for the two clipRect reveals. */
      clip: { status: 12, return: 8 },
      returnHit: 1.3,
      captionMax: undefined as number | undefined,
    };
  }

  // Two rows of two, centred.
  const step = 3.4;
  const cols = 2;
  const rowStep = 3.5;
  /*
   * An even vertical rhythm, and the deck CENTRED in the band the top bar
   * leaves rather than parked at the top of it.
   *
   * The old spacing was the landscape one scaled down, which put 2.6 units of
   * nothing between the headline and the address — a deliberate pause in a
   * 16:9 frame, a hole in a phone-shaped one — and left the headline sitting on
   * the bracket's top edge with 1.8 units of slack under RETURN TO HOME.
   */
  const Y = { word: 7.2, email: 4.8, status: 3.6, socials: 1.2, caption: -4.8, return: -6.6 };
  const size = { head: 1.3, email: 0.62, status: 0.27, caption: 0.34, return: 0.48 };
  const contentTop = Y.word + size.head * 0.5;
  const contentBottom = Y.return - size.return;
  return {
    /*
     * The last row stops short of the bottom edge: in portrait the Text Mode
     * toggle is fixed DOM chrome in the bottom-right corner, and RETURN TO HOME
     * ran straight underneath it.
     */
    Y,
    socialSize: 2.6,
    socialStep: step,
    socialX: socials.map((_, i) => ((i % cols) - (cols - 1) / 2) * step),
    socialY: socials.map((_, i) => Y.socials - Math.floor(i / cols) * rowStep),
    halfW: 4.9,
    halfH: (contentTop - contentBottom) * 0.5 + 0.8,
    // 43 characters of STATUS at 0.27 with 0.14 tracking runs about 8.6 wide;
    // the caption's unhovered form is 37 and needs the same care.
    size,
    /**
     * The frame is sized and placed FROM the content, not guessed at: an even
     * margin all round, centred on what it is framing. Hard-coding 19.0 against
     * a 16.7-tall stack is what printed its top edge through the headline.
     */
    bracket: [9.8, contentTop - contentBottom + 1.6] as [number, number],
    bracketY: (contentTop + contentBottom) * 0.5,
    /** Where the stack's own centre sits, so shiftY can put it in the band. */
    contentCentre: (contentTop + contentBottom) * 0.5,
    formationW: 9.4,
    clip: { status: 9, return: 6 },
    returnHit: 2.2,
    captionMax: 9.2 as number | undefined,
  };
}

const LAYOUT = { landscape: buildLayout(false), portrait: buildLayout(true) };

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
  const portrait = usePortrait();
  const safeTop = useUi((s) => s.safeTop);
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
  const lay = portrait ? LAYOUT.portrait : LAYOUT.landscape;

  /**
   * On iOS the URL bar collapsing changes innerHeight — and therefore the
   * aspect — on every scroll gesture. Landscape reads the live height exactly,
   * as it always did; portrait rounds it, so the whole layout (and the mark
   * geometry that hangs off `fit`) is not rebuilt mid-fling.
   */
  const memoH = portrait ? Math.round(size.height / 24) * 24 : size.height;

  const { fit, shiftX, shiftY } = useMemo(() => {
    const DIST = 15.2;
    const FOV = 74;
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV * 0.5)) * DIST;
    const halfW = halfH * (size.width / Math.max(1, memoH));
    /**
     * What the camera-locked nav takes out of the frame, as a fraction of it.
     * In landscape that is a gutter down the LEFT — the rail is about 96 CSS
     * pixels wide at every viewport size, so as a fraction it grows as the frame
     * narrows, and content centred on the frame ends up centred under the rail.
     * In portrait the nav is a bar across the TOP, so the gutter is vertical and
     * the horizontal one is gone. navReserve() owns both, from the nav's own
     * constants rather than from a number copied over here.
     */
    const nav = navReserve({
      portrait,
      sizeW: size.width,
      halfW: navHalfH * (size.width / Math.max(1, memoH)),
      halfH: navHalfH,
      safeTopWorld: (safeTop * 2 * navHalfH) / Math.max(1, memoH),
    });
    const gutter = nav.left * (halfW * 2);
    const top = nav.top * (halfH * 2);
    /**
     * The floor used to be Math.max(0.5, …), which on a phone clamped a true
     * 0.28 UP to 0.5 and drew the deck 1.8x too wide — the socials row and the
     * bracket ran off the right edge. Portrait does not need it, because the
     * portrait layout is authored to fit rather than scaled down to fit.
     */
    const f = portrait
      ? Math.min(1, (halfW * 0.92) / lay.halfW, (halfH - top * 0.5) / lay.halfH)
      : Math.min(1, Math.max(0.5, Math.min((halfW - gutter) / lay.halfW, halfH / lay.halfH)));
    /*
     * Centre the stack in the band the top bar leaves, rather than merely
     * pushing it down by half the bar. Landscape has no band and a stack already
     * centred on the axis, so both terms are zero and this is exactly the
     * identity it has always been.
     */
    const sy = portrait ? -top * 0.5 - lay.contentCentre * f : 0;
    return { fit: f, shiftX: portrait ? 0 : gutter * 0.5, shiftY: sy };
  }, [size.width, memoH, portrait, lay, safeTop]);

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
      const w = lay.clip.status * fit;
      statusRef.current.clipRect = [-w / 2, -0.5, -w / 2 + w * settle, 0.5];
      statusRef.current.fillOpacity = deck * 0.8;
    }
    if (returnRef.current) {
      const w = lay.clip.return * fit;
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
        position: [lay.socialX[i] * fit, lay.socialY[i] * fit, 0.6 * fit],
        size: lay.socialSize * fit,
        layers: 4,
        spread: 0.9,
        fan: 0.34,
      })),
    [fit, lay],
  );

  return (
    <group ref={group} position={ANCHOR} visible={false}>
      {/* Inside the billboarded group, so a local x offset is a SCREEN-space
          offset — which is what clearing the nav gutter needs to be. */}
      <group position={[shiftX, shiftY, 0]}>
        {/* Corner brackets and nothing else — additive, no back plate, so the
          funnel reads straight through the copy. */}
        <HudBracket
          width={lay.bracket[0] * fit}
          height={lay.bracket[1] * fit}
          lock={deckOn ? 1 : 0}
          opacity={0.55}
          color={PALETTE.neon}
          position={[0, lay.bracketY * fit, -0.8]}
        />

        {/* The word, made of rain. Parented so one transform gives it position,
          orientation and framing — the camera looks 73 degrees up the funnel
          axis at the end, so anything world-anchored here stacks on screen. */}
        {formationCount > 0 && (
          <HeroFormation
            text={HEADLINE}
            count={formationCount}
            progress={fp}
            position={[0, lay.Y.word * fit, -0.4]}
            /*
             * worldWidth and glyphSize move TOGETHER. HeroFormation sizes its
             * quads in view space, so narrowing the word without narrowing the
             * glyphs collapses it into overlapping blobs.
             */
            worldWidth={lay.formationW * fit}
            glyphSize={0.24 * (lay.formationW / 17) * fit}
          />
        )}

        {/* ...and the type it settles into, in the same place. */}
        <TerminalText
          ref={headRef as never}
          position={[0, lay.Y.word * fit, 0]}
          fontSize={lay.size.head * fit}
          color={PALETTE.textBright}
          letterSpacing={0.08}
          fillOpacity={0}
        >
          {HEADLINE}
        </TerminalText>

        <TerminalText
          ref={emailRef as never}
          position={[0, lay.Y.email * fit, 0]}
          fontSize={lay.size.email * fit}
          color={PALETTE.accent}
          fillOpacity={0}
        >
          {EMAIL_TEXT}
        </TerminalText>

        <TerminalText
          ref={statusRef as never}
          position={[0, lay.Y.status * fit, 0]}
          fontSize={lay.size.status * fit}
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
          position={[0, lay.Y.caption * fit, 0]}
          fontSize={lay.size.caption * fit}
          maxWidth={lay.captionMax ? lay.captionMax * fit : undefined}
          color={hoveredSocial ? PALETTE.textBright : PALETTE.textDim}
          letterSpacing={0.08}
          fillOpacity={0}
        >
          {caption}
        </TerminalText>

        <TerminalText
          ref={returnRef as never}
          position={[0, lay.Y.return * fit, 0]}
          fontSize={lay.size.return * fit}
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
              position={[lay.socialX[i] * fit, lay.socialY[i] * fit, 0.9]}
              size={[(lay.socialStep - 0.3) * fit, (lay.socialSize + 0.4) * fit, 1.6]}
              onActivate={() => s.url && window.open(s.url, '_blank', 'noopener')}
            />
          ))}
        {live && (
          <Hotspot
            id="return"
            position={[0, lay.Y.return * fit, 0.4]}
            size={[8 * fit, lay.returnHit * fit, 1.2]}
            onActivate={() => scrollToProgress(0, { duration: 5 })}
          />
        )}
      </group>
    </group>
  );
}
