import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText } from '@/text/TerminalText';
import { HoloPanel } from '@/objects/HoloPanel';
import { AsciiPortrait } from '@/objects/AsciiPortrait';
import { MarkStack, type StackItem } from '@/objects/MarkStack';
import { Hotspot } from '@/objects/Hotspot';
import { panelBox, stack } from '@/objects/panelLayout';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import {
  content, profile, experience, skills, socials, jobRangeLabel,
} from '@/content/loadContent';
import { TECH_BRAND, SOCIAL_BRAND, brandFor } from '@/text/brand';
import { useUi } from '@/state/store';
import { usePortrait } from '@/state/viewport';
import { PALETTE } from '@/text/palette';
import type { TroikaText } from '@/text/TerminalText';

const Z = -40;

/**
 * 02 — "The Profile".
 *
 * The corridor opens into a room holding one object: the developer's profile,
 * laid out as a bento of instrument tiles rather than one large slab. Each tile
 * is a single subject, sized to its content, and every row inside it is placed
 * by stack() from the tile's own box — so nothing can drift into anything else
 * when the type scale is retuned.
 *
 * The frame on every tile is HoloPanel's OWN line-work: one shader draws the
 * chamfer, the frame line and the corner brackets together, so they can never
 * disagree about where the corner is. (A nine-slice bezel was tried here and
 * pulled back out — its border art has to be bound to the panel's chamfer by
 * hand, and the graduation detail that makes such a frame worth having reads as
 * rows of dashes at the distance these tiles are actually seen from.)
 *
 * The avatar is the block portrait carried over from the old Next.js site,
 * drawn by <AsciiPortrait />. It is the art itself, not a photo converted at
 * runtime, so it renders exactly as it was drawn.
 *
 * Chrome costs no words. The frames, the social plates, the skill plates and
 * the card's contact buttons are all shaders; the nine troika Text instances
 * here are spent entirely on things that are actually read.
 */

/* ---------------------------- bento grid ---------------------------- */

/* ---------------------------- content ---------------------------- */

const current = experience[experience.length - 1];

/**
 * site.json carries no runtime validation, so an unfilled field arrives as
 * undefined and would render the literal string at 0.60 world units. Every read
 * on the card falls back to something already true.
 */
const CARD = {
  name: profile.fullName ?? profile.name,
  designation: (profile.designation ?? current.role).toUpperCase(),
  title: profile.title ?? profile.roles.join(' · '),
};

/**
 * The current role, in a line. Falls back to the stack so the tile is never
 * empty if a job arrives without one.
 */
const CURRENT_BLURB = current.blurb ?? current.tech.join('  ·  ');


/**
 * The whole bento, for both orientations, built once each at module load.
 *
 * A function rather than a set of consts because this runs before React exists
 * — the marks and the grid are needed at module scope — and because the
 * landscape branch has to stay bit-for-bit what it was. Every `portrait ? … : …`
 * below keeps the original expression on the right.
 */
function buildAbout(portrait: boolean) {
const GAP = portrait ? 0.20 : 0.4;
const LEFT = portrait ? -2.4 : -9.0;
const TOP = portrait ? 4.08 : 3.9;

/**
 * Landscape is three columns side by side; portrait is ONE, because at the
 * camera's park a phone frustum is 3.1 units of half-width against the 9 this
 * bento spans. Three columns cannot be narrowed into that — only stacked.
 */
const COL = portrait
  ? { portrait: 4.8, main: 4.8, side: 4.8 }
  : { portrait: 5.0, main: 7.6, side: 4.6 };
const CX = portrait
  ? { portrait: 0, main: 0, side: 0 }
  : {
    portrait: LEFT + COL.portrait / 2,
    main: LEFT + COL.portrait + GAP + COL.main / 2,
    side: LEFT + COL.portrait + GAP + COL.main + GAP + COL.side / 2,
  };

/**
 * The portrait stack, top to bottom, and the running y it produces.
 *
 * Solved against the frame the camera ACTUALLY parks in, which is not the one
 * site.json's keyframes suggest: loadContent rebuilds the journey at runtime
 * (buildProjectsJourney retimes every section), and the About park lands 10.0
 * units from this group rather than 11.6. Measured, that frame is 5.77 of
 * half-height and 2.57 of half-width on a 0.445-aspect phone — so the column is
 * 4.8 wide and the stack has 9.9 units to live in once the top bar's band is
 * taken out.
 *
 * Solved rather than fitted at runtime, because the root group may never carry
 * a scale: every mark here is drawn by a MarkStack, and those size their quads
 * in view space — a parent scale would move the plates without shrinking them
 * and they would overlap.
 *
 * The stack also stops about 0.8 short of the bottom edge. That is the Text Mode
 * toggle, which is fixed DOM chrome in the bottom-right corner in portrait: the
 * only section whose content reaches the foot of the frame is this one, and
 * without the reserve the last row of skill plates sits underneath it.
 */
const PH: Record<string, number> = { identity: 1.75, bio: 3.45, socials: 0.85, skills: 2.35 };
/**
 * The current-role card is NOT in the portrait stack.
 *
 * It is the one tile whose content the site states again in full a section
 * later — Experience opens on the same job, with the same dates and a paragraph
 * instead of a line. On a desktop that repetition costs nothing because the
 * bento has a column going spare; in a single phone column it costs the bio and
 * the skill grid the room they actually need.
 */
const CUR_SHOW = !portrait;
const pRun = (() => {
  let y = TOP;
  const out: Record<string, number> = {};
  for (const k of ['identity', 'bio', 'socials', 'skills']) {
    const h = PH[k];
    out[k] = y - h / 2;
    y -= h + GAP;
  }
  return out;
})();

/**
 * Tile = width, height, centre. Heights are sized to the content they hold and
 * every column ends flush at the same bottom edge — that flush line is what
 * makes a bento read as a grid rather than as scattered panels. All three
 * columns run 7.8 tall: 5.6+0.4+1.8, 2.4+0.4+5.0, 2.8+0.4+4.6.
 *
 * The skills block is COL.side square, because that is the only height at which
 * three square plates spanning the column's width also fit its height. The
 * experience card gives up the difference.
 */
const TILE = portrait
  ? {
    // The avatar has no tile of its own: stacked in one column there is no
    // room for a whole row of it, and it belongs next to the name anyway —
    // which is exactly where Text Mode puts it. Zero size keeps the standalone
    // tile out of the stack; the identity card below draws it instead.
    portrait: { w: 0, h: 0, x: 0, y: 0 },
    identity: { w: COL.main, h: PH.identity, x: 0, y: pRun.identity },
    bio: { w: COL.main, h: PH.bio, x: 0, y: pRun.bio },
    // Off the stack and never drawn — see CUR_SHOW. Kept at a real size so the
    // box and row maths below stay finite.
    current: { w: COL.side, h: 1.0, x: 0, y: 0 },
    socials: { w: COL.portrait, h: PH.socials, x: 0, y: pRun.socials },
    skills: { w: COL.side, h: PH.skills, x: 0, y: pRun.skills },
  }
  : {
    portrait: { w: COL.portrait, h: 5.6, x: CX.portrait, y: TOP - 2.8 },
    socials: { w: COL.portrait, h: 1.8, x: CX.portrait, y: TOP - 5.6 - GAP - 0.9 },
    identity: { w: COL.main, h: 2.4, x: CX.main, y: TOP - 1.2 },
    bio: { w: COL.main, h: 5.0, x: CX.main, y: TOP - 2.4 - GAP - 2.5 },
    current: { w: COL.side, h: 2.8, x: CX.side, y: TOP - 1.4 },
    skills: { w: COL.side, h: COL.side, x: CX.side, y: TOP - 2.8 - GAP - COL.side / 2 },
  };

/** Corner radius shared by every tile, so the bento reads as one set of parts. */
const RADIUS = 0.36;

/**
 * One frame weight across the bento, in world units. Without it HoloPanel sizes
 * its line as a fraction of panel height, so the short tiles drew a noticeably
 * lighter frame than the tall ones and their bottom edges broke into dashes.
 */
const FRAME_LINE = 0.030;

/**
 * Corner brackets at a third weight. At full strength they burn far brighter
 * than the frame line they sit on, and this close to the camera each corner
 * blooms into a blob rather than reading as a bracket.
 */
const BRACKET = 0.34;

/**
 * Content is measured from a tile shrunk by the frame first.
 *
 * panelBox's padding is proportional AND spends only 0.4 of it vertically, so
 * on a short tile the top row lands about 0.06 in from the edge — printed over
 * the frame line. Insetting the box instead keeps a constant margin on every
 * tile whatever its proportions.
 */
const FRAME_INSET = 0.16;
const tileBox = (w: number, h: number) =>
  panelBox({ width: w - FRAME_INSET * 2, height: h - FRAME_INSET * 2, header: 0 });

const IDENTITY = tileBox(TILE.identity.w, TILE.identity.h);
const BIO = tileBox(TILE.bio.w, TILE.bio.h);
const CURRENT = tileBox(TILE.current.w, TILE.current.h);

/* ---------------------------- type scale ---------------------------- */

const S = portrait
  ? { name: 0.34, desig: 0.14, title: 0.14, prompt: 0.18, bio: 0.175 }
  : { name: 0.60, desig: 0.25, title: 0.21, prompt: 0.24, bio: 0.235 };
/** A narrow measure wants tighter leading, and 423 characters need every line. */
const BIO_LINE = portrait ? 1.30 : 1.5;

/** Explicit, because panelBox's derived captionSize is fine print at this tile size. */
const C = portrait
  ? { role: 0.20, company: 0.15, meta: 0.13, body: 0.14 }
  : { role: 0.30, company: 0.215, meta: 0.185, body: 0.19 };

const ID_ROWS = stack(IDENTITY, [
  { size: S.name, gap: 0.16 },
  { size: S.desig, gap: 0.24 },
  { size: S.title },
]);

/**
 * Contact sits in the card's top-right corner as two buttons rather than two
 * lines of type: nobody reads an address off a wall, and a mark costs no troika
 * Text instance where a line of text costs one.
 */
const ID_ICON_SIZE = portrait ? 0.38 : 0.56;
const ID_ICON_Y = IDENTITY.top - ID_ICON_SIZE * 0.55;
const ID_ICON_X = portrait
  ? { email: IDENTITY.right - 0.72, phone: IDENTITY.right - 0.22 }
  : { email: IDENTITY.right - 1.06, phone: IDENTITY.right - 0.32 };
/**
 * The ASCII portrait keeps its own tile in landscape and is dropped in
 * portrait — not for want of vertical room but for want of HORIZONTAL room:
 * beside the name it takes a third of the column, and the designation
 * ("Senior Full Stack AI Engineer") then wraps in a card built for one line.
 * The name is what the card is for; the picture is what a phone can spare.
 */
const ID_TEXT_X = IDENTITY.left;
/** Keeps even a long name clear of the contact buttons. */
const ID_NAME_MAX = IDENTITY.width - (portrait ? 1.15 : 2.0);

/**
 * Portrait spends no line on the `> cat about.md` prompt. It is scene-setting,
 * and half a unit of a phone's About panel is 420 characters of the bio read at
 * a size someone can actually read.
 */
const BIO_ROWS = portrait
  ? stack(BIO, [{ size: S.bio }])
  : stack(BIO, [{ size: S.prompt, gap: 0.30 }, { size: S.bio }]);
const BIO_PROMPT = !portrait;

/**
 * Portrait drops the job's blurb line. It is the one thing on this card the
 * Experience section states again at length, and dropping it is what lets the
 * bio above keep a size worth reading — a phone has one frame for all of this,
 * so the choice is which sentence to spend it on.
 */
const CUR_BODY = !portrait;
const CUR_ROWS = stack(CURRENT, portrait
  ? [
    { size: C.role, gap: 0.12 },
    { size: C.company, gap: 0.10 },
    { size: C.meta },
  ]
  : [
    { size: C.role, gap: 0.16 },
    { size: C.company, gap: 0.12 },
    { size: C.meta, gap: 0.20 },
    { size: C.body },
  ]);

/* ------------------------ marks: ONE instanced draw ----------------------- */

/**
 * Every mark in the section — four social assemblies, nine skill assemblies and
 * the card's two contact buttons — is carried by a SINGLE <MarkStack />, so the
 * whole lot costs one draw call and one atlas. Positions are therefore given in
 * the SECTION's space, not each tile's, which is why they are composed from the
 * tile centre here rather than nested in the tile groups below.
 *
 * Socials and skills are deliberately the SAME object with the same behaviour:
 * a stack of plates in the mark's own brand colour that peels apart under the
 * pointer. Only the grid they sit in differs.
 */
const PLATE = { layers: 4, spread: 0.38, fan: 0.20 } as const;

/**
 * Plate size falls out of the COLUMN, not the other way round: three plates and
 * two gaps span COL.side exactly, so the grid's outer edges line up with the
 * card above it and there is no margin left over. Same for the socials against
 * COL.portrait. Sizing the plates first and centring the result is what left a
 * band of dead space down both sides of each group.
 */
/**
 * The grid is a pure function of the skill COUNT.
 *
 * It used to be hardcoded 3x3, with the row picked as SKILL_Y[floor(i / 3)] —
 * an array of three. The tenth skill read past the end of it, got `undefined`,
 * and every mark from there on was positioned at NaN: the whole instanced mesh
 * and its hotspots disappeared, from a data change alone. Deriving the shape
 * means the tile takes nine skills or twenty without anyone editing this file.
 */
const SKILL_GAP = portrait ? 0.14 : 0.22;
/**
 * Square-ish in landscape, but a wide shallow band in portrait — the stack has
 * width to spare there and almost no height, so the grid runs the other way.
 */
const SKILL_COLS = portrait
  ? Math.max(1, Math.ceil(skills.length / 3))
  : Math.max(1, Math.ceil(Math.sqrt(skills.length)));
const SKILL_ROWS = Math.max(1, Math.ceil(skills.length / SKILL_COLS));
/** Whichever axis runs out first decides the plate size, so it always fits. */
/**
 * Portrait carries the heading INSIDE the tile, above the grid, exactly as the
 * socials block does — so the two are the same object twice and line up without
 * anyone having to keep two different placements in step. Landscape keeps its
 * label out in the gap above the tile, where the bento has room for it.
 */
const SKILL_LABEL = portrait ? 0.22 : 0;
const SKILL_ROW_H = TILE.skills.h - (SKILL_LABEL ? SKILL_LABEL + 0.10 : 0);
const SKILL_SIZE = Math.min(
  (COL.side - SKILL_GAP * (SKILL_COLS - 1)) / SKILL_COLS,
  (SKILL_ROW_H - SKILL_GAP * (SKILL_ROWS - 1)) / SKILL_ROWS,
);
/** How far the grid sits below the tile's centre, once the label has its band. */
const SKILL_GRID_DY = portrait ? -TILE.skills.h / 2 + SKILL_ROW_H / 2 : 0;
const SKILL_STEP = SKILL_SIZE + SKILL_GAP;
const skillCellX = (i: number) => ((i % SKILL_COLS) - (SKILL_COLS - 1) / 2) * SKILL_STEP;
const skillCellY = (i: number) =>
  ((SKILL_ROWS - 1) / 2 - Math.floor(i / SKILL_COLS)) * SKILL_STEP + SKILL_GRID_DY;

/**
 * The label lives in the gap above the grid — flush left with it, and nearer to
 * it than to the card overhead. Measured from the grid's real top edge, which
 * moves when the row count does.
 */
const SKILL_GRID_HALF_H = ((SKILL_ROWS - 1) / 2) * SKILL_STEP + SKILL_SIZE / 2;
const SKILL_LABEL_X = -(((SKILL_COLS - 1) / 2) * SKILL_STEP + SKILL_SIZE / 2);
const SKILL_LABEL_Y = portrait
  ? TILE.skills.h / 2 - SKILL_LABEL / 2
  : SKILL_GRID_HALF_H + 0.20;

/**
 * The socials and the skills have no panel of their own. Four buttons in a row
 * and a labelled grid are already legible objects; boxing each of them made the
 * bento five containers deep and the marks read as inventory in a crate rather
 * than as controls. They keep their footprint in the grid, so the columns still
 * line up — there is simply nothing drawn around them.
 */
/*
 * Portrait matches the skill grid exactly — same cell, same gap, same left
 * edge. They are the same kind of thing (a labelled row of brand marks you can
 * tap), one directly above the other, and two different plate sizes read as two
 * unrelated blocks rather than as one list continued.
 */
const SOCIAL_GAP = portrait ? SKILL_GAP : 0.20;
/**
 * Capped by the tile's HEIGHT as well as its width. In landscape the width has
 * always been the binding term (1.10 against a 1.8-tall tile); stacked in one
 * column the row is wide and shallow, and without the second term the plates
 * would stand taller than the space they are in.
 */
/**
 * Portrait gives the row a label of its own and puts it under it, flush LEFT —
 * the same shape the skills grid already has, so the two blocks read as a pair
 * rather than as one labelled group and one floating row. Landscape keeps the
 * centred, unlabelled row it always had: there the tile is a column in a bento
 * and the plates ARE the label.
 */
const SOCIAL_LABEL = portrait ? 0.16 : 0;
/**
 * The section headings are dim green in landscape, where they sit on a dark
 * bento tile and only have to whisper. In portrait they are on the open world
 * with the rain behind them, and at that size dim green does not survive it.
 */
const LABEL_COLOR = portrait ? PALETTE.text : PALETTE.textDim;
const SOCIAL_ROW_H = TILE.socials.h - (SOCIAL_LABEL ? SOCIAL_LABEL + 0.10 : 0);
const SOCIAL_SIZE = portrait
  ? SKILL_SIZE
  : Math.min(
    (COL.portrait - SOCIAL_GAP * (socials.length - 1)) / socials.length,
    SOCIAL_ROW_H,
  );
const SOCIAL_STEP = SOCIAL_SIZE + SOCIAL_GAP;
const SOCIAL_X = portrait
  // SKILL_LABEL_X is the skill grid's own left edge; starting here is what
  // makes the two rows share a margin instead of merely both being "on the left".
  ? socials.map((_, i) => SKILL_LABEL_X + SOCIAL_SIZE / 2 + i * SOCIAL_STEP)
  : socials.map((_, i) => (i - (socials.length - 1) / 2) * SOCIAL_STEP);
/** The row sits under the label rather than on the tile's centre line. */
const SOCIAL_ROW_DY = portrait ? -TILE.socials.h / 2 + SOCIAL_ROW_H / 2 : 0;
const SOCIAL_LABEL_X = SKILL_LABEL_X;
const SOCIAL_LABEL_Y = TILE.socials.h / 2 - SOCIAL_LABEL / 2;

const SOCIAL_MARKS: StackItem[] = socials.map((s, i) => ({
  id: `about-social:${s.id}`,
  markId: s.id,
  color: brandFor(SOCIAL_BRAND, s.id).color,
  position: [TILE.socials.x + SOCIAL_X[i], TILE.socials.y + SOCIAL_ROW_DY, 0.10],
  size: SOCIAL_SIZE,
  ...PLATE,
}));

const SKILL_MARKS: StackItem[] = skills.map((s, i) => ({
  id: `about-skill:${s.id}`,
  markId: s.id,
  color: brandFor(TECH_BRAND, s.id).color,
  position: [TILE.skills.x + skillCellX(i), TILE.skills.y + skillCellY(i), 0.10],
  size: SKILL_SIZE,
  ...PLATE,
}));

/** House green, not a brand colour: these two are the owner's own channels. */
const CONTACT_MARKS: StackItem[] = [
  {
    id: 'about-contact:email',
    markId: 'mail',
    color: PALETTE.accent,
    position: [TILE.identity.x + ID_ICON_X.email, TILE.identity.y + ID_ICON_Y, 0.10],
    size: ID_ICON_SIZE,
    ...PLATE,
  },
  {
    id: 'about-contact:phone',
    markId: 'phone',
    color: PALETTE.accent,
    position: [TILE.identity.x + ID_ICON_X.phone, TILE.identity.y + ID_ICON_Y, 0.10],
    size: ID_ICON_SIZE,
    ...PLATE,
  },
];

const ABOUT_MARKS: StackItem[] = [...SOCIAL_MARKS, ...SKILL_MARKS, ...CONTACT_MARKS];

  return {
    GAP, LEFT, TOP, COL, CX, TILE, RADIUS, FRAME_LINE, BRACKET, FRAME_INSET,
    IDENTITY, BIO, CURRENT, S, C, BIO_LINE, ID_ROWS, ID_ICON_SIZE, ID_ICON_X, ID_ICON_Y,
    ID_NAME_MAX, BIO_ROWS, CUR_ROWS, SOCIAL_GAP, SOCIAL_SIZE, SOCIAL_STEP, SOCIAL_X,
    ID_TEXT_X, BIO_PROMPT, CUR_BODY, CUR_SHOW,
    SOCIAL_LABEL, SOCIAL_ROW_DY, SOCIAL_LABEL_X, SOCIAL_LABEL_Y, LABEL_COLOR,
    SKILL_GAP, SKILL_COLS, SKILL_ROWS, SKILL_SIZE, SKILL_STEP, SKILL_GRID_HALF_H,
    SKILL_LABEL_X, SKILL_LABEL_Y, skillCellX, skillCellY, ABOUT_MARKS,
  };
}

const ABOUT = { landscape: buildAbout(false), portrait: buildAbout(true) };

/** Opens a mailto:/tel:, and does nothing at all while the value is unpublished. */
function openContact(scheme: 'mailto' | 'tel', value: string | null) {
  if (!value) return;
  window.location.href = `${scheme}:${scheme === 'tel' ? value.replace(/[^+0-9]/g, '') : value}`;
}

export function AboutSection() {
  const p = useSectionProgress('about');
  const group = useRef<THREE.Group>(null);
  const bio = useRef<TroikaText>(null);
  const hovered = useUi((s) => s.hovered);
  const portrait = usePortrait();

  /*
   * Destructured back into the same names the layout below has always used, so
   * picking an orientation costs one line and the JSX is untouched.
   */
  const {
    TILE, RADIUS, FRAME_LINE, BRACKET,
    BIO, CURRENT, S, C, BIO_LINE, BIO_PROMPT, CUR_BODY, CUR_SHOW, ID_ROWS, ID_ICON_X, ID_ICON_Y, ID_TEXT_X,
    ID_NAME_MAX, BIO_ROWS, CUR_ROWS, SOCIAL_SIZE, SOCIAL_STEP, SOCIAL_X,
    SKILL_STEP, SKILL_LABEL_X, SKILL_LABEL_Y, skillCellX, skillCellY, ABOUT_MARKS,
    SOCIAL_LABEL, SOCIAL_ROW_DY, SOCIAL_LABEL_X, SOCIAL_LABEL_Y, LABEL_COLOR,
  } = portrait ? ABOUT.portrait : ABOUT.landscape;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = p.current.band > 0.001;

    // Reveal the bio with troika's clipRect rather than re-sync()ing the text,
    // which would re-run layout every frame.
    const t = bio.current;
    if (t) {
      const bb = t.geometry?.boundingBox;
      if (bb) {
        const top = bb.max.y;
        const h = bb.max.y - bb.min.y;
        // Finished by local 0.40, which is before the camera settles square-on
        // at 0.50: the flat state is the one where everything has to be readable.
        const revealed = Math.min(1, Math.max(0, (p.current.local - 0.05) / 0.35));
        t.clipRect = [-20, top - h * revealed, 20, top + 0.5];
      }
    }
  });

  return (
    <group ref={group} position={[0.6, 1.2, Z - 1.2]}>
      {/* ---------------- portrait ---------------- */}
      {/* Only when it has a tile of its own; in portrait it rides in the card. */}
      {TILE.portrait.h > 0 && (
      <group position={[TILE.portrait.x, TILE.portrait.y, 0]}>
        <HoloPanel
          radius={RADIUS}
          width={TILE.portrait.w}
          height={TILE.portrait.h}
          header={0}
          footer={0}
          fill={0.18}
          grid={0.7}
          curve={0.4}
          lineWidth={FRAME_LINE}
          bracket={BRACKET}
        />
        <AsciiPortrait progress={p} height={4.0} position={[0, 0, 0.06]} />
      </group>
      )}

      {/* ---------------- identity card ---------------- */}
      <group position={[TILE.identity.x, TILE.identity.y, 0]}>
        <HoloPanel radius={RADIUS} width={TILE.identity.w} height={TILE.identity.h} header={0} footer={0} fill={0.2} grid={0.5} curve={0.4} lineWidth={FRAME_LINE}
          bracket={BRACKET} />
        <TerminalText
          position={[ID_TEXT_X, ID_ROWS[0], 0.06]}
          anchorX="left"
          fontSize={S.name}
          maxWidth={ID_NAME_MAX}
          color={PALETTE.textBright}
        >
          {CARD.name}
        </TerminalText>
        <TerminalText position={[ID_TEXT_X, ID_ROWS[1], 0.06]} anchorX="left" fontSize={S.desig} color={PALETTE.accent} letterSpacing={0.12} maxWidth={ID_NAME_MAX}>
          {CARD.designation}
        </TerminalText>
        <TerminalText position={[ID_TEXT_X, ID_ROWS[2], 0.06]} anchorX="left" fontSize={S.title} color={PALETTE.text} maxWidth={ID_NAME_MAX}>
          {CARD.title}
        </TerminalText>
      </group>

      {/* ---------------- bio ---------------- */}
      <group position={[TILE.bio.x, TILE.bio.y, 0]}>
        <HoloPanel radius={RADIUS} width={TILE.bio.w} height={TILE.bio.h} header={0} footer={0} fill={0.2} grid={0.5} curve={0.4} lineWidth={FRAME_LINE}
          bracket={BRACKET} />
        {BIO_PROMPT && (
          <TerminalText position={[BIO.left, BIO_ROWS[0], 0.06]} anchorX="left" fontSize={S.prompt} color={PALETTE.accent}>
            {'> cat about.md'}
          </TerminalText>
        )}
        <TerminalText
          ref={bio as never}
          position={[BIO.left, BIO_ROWS[BIO_PROMPT ? 1 : 0] + S.bio * 0.5, 0.06]}
          anchorX="left"
          anchorY="top"
          fontSize={S.bio}
          maxWidth={BIO.width}
          lineHeight={BIO_LINE}
          color={PALETTE.text}
        >
          {profile.bio}
        </TerminalText>
      </group>

      {/* ---------------- current role ---------------- */}
      {CUR_SHOW && (
      <group position={[TILE.current.x, TILE.current.y, 0]}>
        <HoloPanel radius={RADIUS} width={TILE.current.w} height={TILE.current.h} header={0} footer={0} fill={0.2} grid={0.5} curve={0.4} lineWidth={FRAME_LINE}
          bracket={BRACKET} />
        <TerminalText position={[CURRENT.left, CUR_ROWS[0], 0.06]} anchorX="left" fontSize={C.role} color={PALETTE.textBright} maxWidth={CURRENT.width}>
          {current.role}
        </TerminalText>
        <TerminalText position={[CURRENT.left, CUR_ROWS[1], 0.06]} anchorX="left" fontSize={C.company} color={PALETTE.text}>
          {current.company}
        </TerminalText>
        <TerminalText position={[CURRENT.left, CUR_ROWS[2], 0.06]} anchorX="left" fontSize={C.meta} color={PALETTE.textDim}>
          {jobRangeLabel(current)}
        </TerminalText>
        {/*
          The job's `blurb`: a short line written for this tile and rendered
          nowhere else. It briefly held the tech stack instead, which was
          accurate but read as inventory on a card that is otherwise all prose.
        */}
        {CUR_BODY && (
          <TerminalText
            position={[CURRENT.left, CUR_ROWS[3] + C.body * 0.5, 0.06]}
            anchorX="left"
            anchorY="top"
            fontSize={C.body}
            lineHeight={1.5}
            maxWidth={CURRENT.width}
            color={PALETTE.text}
          >
            {CURRENT_BLURB}
          </TerminalText>
        )}
      </group>
      )}

      {/* ---------------- socials label ---------------- */}
      {SOCIAL_LABEL > 0 && (
        <group position={[TILE.socials.x, TILE.socials.y, 0]}>
          <TerminalText
            position={[SOCIAL_LABEL_X, SOCIAL_LABEL_Y, 0.06]}
            anchorX="left"
            fontSize={SOCIAL_LABEL}
            color={LABEL_COLOR}
            letterSpacing={0.22}
          >
            SOCIALS
          </TerminalText>
        </group>
      )}

      {/* ---------------- skills ---------------- */}
      <group position={[TILE.skills.x, TILE.skills.y, 0]}>
        <TerminalText
          position={[SKILL_LABEL_X, SKILL_LABEL_Y, 0.06]}
          anchorX="left"
          fontSize={0.22}
          color={LABEL_COLOR}
          letterSpacing={0.22}
        >
          SKILLS
        </TerminalText>
      </group>

      {/*
        Positions are already in this group's space, so the marks are mounted
        here rather than inside the tiles they visually belong to. One draw call
        for the whole section.
      */}
      <MarkStack items={ABOUT_MARKS} hoveredId={hovered} />

      {/* An instanced mesh cannot be picked per instance, so each mark gets a box. */}
      {socials.map((s, i) => (
        <Hotspot
          key={s.id}
          id={`about-social:${s.id}`}
          position={[TILE.socials.x + SOCIAL_X[i], TILE.socials.y + SOCIAL_ROW_DY, 0.2]}
          size={[SOCIAL_STEP - 0.10, SOCIAL_SIZE + 0.10, 0.7]}
          onActivate={() => s.url && window.open(s.url, '_blank', 'noopener')}
        />
      ))}
      {skills.map((s, i) => (
        <Hotspot
          key={s.id}
          id={`about-skill:${s.id}`}
          position={[TILE.skills.x + skillCellX(i), TILE.skills.y + skillCellY(i), 0.2]}
          size={[SKILL_STEP - 0.10, SKILL_STEP - 0.10, 0.7]}
        />
      ))}
      <Hotspot
        id="about-contact:email"
        position={[TILE.identity.x + ID_ICON_X.email, TILE.identity.y + ID_ICON_Y, 0.2]}
        size={[0.7, 0.7, 0.7]}
        onActivate={() => openContact('mailto', content.email)}
      />
      <Hotspot
        id="about-contact:phone"
        position={[TILE.identity.x + ID_ICON_X.phone, TILE.identity.y + ID_ICON_Y, 0.2]}
        size={[0.7, 0.7, 0.7]}
        onActivate={() => openContact('tel', content.phone)}
      />
    </group>
  );
}
