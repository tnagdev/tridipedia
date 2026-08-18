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

const GAP = 0.4;
const LEFT = -9.0;
const TOP = 3.9;

const COL = { portrait: 5.0, main: 7.6, side: 4.6 };
const CX = {
  portrait: LEFT + COL.portrait / 2,
  main: LEFT + COL.portrait + GAP + COL.main / 2,
  side: LEFT + COL.portrait + GAP + COL.main + GAP + COL.side / 2,
};

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
const TILE = {
  portrait: { w: COL.portrait, h: 5.6, x: CX.portrait, y: TOP - 2.8 },
  socials: { w: COL.portrait, h: 1.8, x: CX.portrait, y: TOP - 5.6 - GAP - 0.9 },
  identity: { w: COL.main, h: 2.4, x: CX.main, y: TOP - 1.2 },
  bio: { w: COL.main, h: 5.0, x: CX.main, y: TOP - 2.4 - GAP - 2.5 },
  current: { w: COL.side, h: 2.8, x: CX.side, y: TOP - 1.4 },
  skills: { w: COL.side, h: COL.side, x: CX.side, y: TOP - 2.8 - GAP - COL.side / 2 },
} as const;

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

/* ---------------------------- type scale ---------------------------- */

const S = { name: 0.60, desig: 0.25, title: 0.21, prompt: 0.24, bio: 0.235 };

/** Explicit, because panelBox's derived captionSize is fine print at this tile size. */
const C = { role: 0.30, company: 0.215, meta: 0.185, body: 0.19 };

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
const ID_ICON_SIZE = 0.56;
const ID_ICON_Y = IDENTITY.top - ID_ICON_SIZE * 0.55;
const ID_ICON_X = { email: IDENTITY.right - 1.06, phone: IDENTITY.right - 0.32 };
/** Keeps even a long name clear of the buttons. */
const ID_NAME_MAX = IDENTITY.width - 2.0;

const BIO_ROWS = stack(BIO, [{ size: S.prompt, gap: 0.30 }, { size: S.bio }]);

const CUR_ROWS = stack(CURRENT, [
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
 * The socials and the skills have no panel of their own. Four buttons in a row
 * and a labelled grid are already legible objects; boxing each of them made the
 * bento five containers deep and the marks read as inventory in a crate rather
 * than as controls. They keep their footprint in the grid, so the columns still
 * line up — there is simply nothing drawn around them.
 */
const SOCIAL_GAP = 0.20;
const SOCIAL_SIZE = (COL.portrait - SOCIAL_GAP * (socials.length - 1)) / socials.length;
const SOCIAL_STEP = SOCIAL_SIZE + SOCIAL_GAP;
const SOCIAL_X = socials.map((_, i) => (i - (socials.length - 1) / 2) * SOCIAL_STEP);

const SOCIAL_MARKS: StackItem[] = socials.map((s, i) => ({
  id: `about-social:${s.id}`,
  markId: s.id,
  color: brandFor(SOCIAL_BRAND, s.id).color,
  position: [TILE.socials.x + SOCIAL_X[i], TILE.socials.y, 0.10],
  size: SOCIAL_SIZE,
  ...PLATE,
}));

/**
 * Plate size falls out of the COLUMN, not the other way round: three plates and
 * two gaps span COL.side exactly, so the grid's outer edges line up with the
 * card above it and there is no margin left over. Same for the socials against
 * COL.portrait. Sizing the plates first and centring the result is what left a
 * band of dead space down both sides of each group.
 */
const SKILL_GAP = 0.22;
const SKILL_SIZE = (COL.side - SKILL_GAP * 2) / 3;
const SKILL_STEP = SKILL_SIZE + SKILL_GAP;
const SKILL_X = [-SKILL_STEP, 0, SKILL_STEP];
const SKILL_Y = [SKILL_STEP, 0, -SKILL_STEP];
/**
 * The grid fills its whole footprint, so the label lives in the gap above it —
 * flush left with the grid, and nearer to it than to the card overhead.
 */
const SKILL_LABEL_X = -COL.side / 2;
const SKILL_LABEL_Y = SKILL_STEP + SKILL_SIZE / 2 + 0.20;

const SKILL_MARKS: StackItem[] = skills.map((s, i) => ({
  id: `about-skill:${s.id}`,
  markId: s.id,
  color: brandFor(TECH_BRAND, s.id).color,
  position: [TILE.skills.x + SKILL_X[i % 3], TILE.skills.y + SKILL_Y[Math.floor(i / 3)], 0.10],
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

      {/* ---------------- identity card ---------------- */}
      <group position={[TILE.identity.x, TILE.identity.y, 0]}>
        <HoloPanel radius={RADIUS} width={TILE.identity.w} height={TILE.identity.h} header={0} footer={0} fill={0.2} grid={0.5} curve={0.4} lineWidth={FRAME_LINE}
          bracket={BRACKET} />
        <TerminalText
          position={[IDENTITY.left, ID_ROWS[0], 0.06]}
          anchorX="left"
          fontSize={S.name}
          maxWidth={ID_NAME_MAX}
          color={PALETTE.textBright}
        >
          {CARD.name}
        </TerminalText>
        <TerminalText position={[IDENTITY.left, ID_ROWS[1], 0.06]} anchorX="left" fontSize={S.desig} color={PALETTE.accent} letterSpacing={0.12}>
          {CARD.designation}
        </TerminalText>
        <TerminalText position={[IDENTITY.left, ID_ROWS[2], 0.06]} anchorX="left" fontSize={S.title} color={PALETTE.text}>
          {CARD.title}
        </TerminalText>
      </group>

      {/* ---------------- bio ---------------- */}
      <group position={[TILE.bio.x, TILE.bio.y, 0]}>
        <HoloPanel radius={RADIUS} width={TILE.bio.w} height={TILE.bio.h} header={0} footer={0} fill={0.2} grid={0.5} curve={0.4} lineWidth={FRAME_LINE}
          bracket={BRACKET} />
        <TerminalText position={[BIO.left, BIO_ROWS[0], 0.06]} anchorX="left" fontSize={S.prompt} color={PALETTE.accent}>
          {'> cat about.md'}
        </TerminalText>
        <TerminalText
          ref={bio as never}
          position={[BIO.left, BIO_ROWS[1] + S.bio * 0.5, 0.06]}
          anchorX="left"
          anchorY="top"
          fontSize={S.bio}
          maxWidth={BIO.width}
          lineHeight={1.5}
          color={PALETTE.text}
        >
          {profile.bio}
        </TerminalText>
      </group>

      {/* ---------------- current role ---------------- */}
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
        <TerminalText
          position={[CURRENT.left, CUR_ROWS[3] + C.body * 0.5, 0.06]}
          anchorX="left"
          anchorY="top"
          fontSize={C.body}
          lineHeight={1.5}
          maxWidth={CURRENT.width}
          color={PALETTE.text}
        >
          {current.summary}
        </TerminalText>
      </group>

      {/* ---------------- skills ---------------- */}
      <group position={[TILE.skills.x, TILE.skills.y, 0]}>
        <TerminalText
          position={[SKILL_LABEL_X, SKILL_LABEL_Y, 0.06]}
          anchorX="left"
          fontSize={0.22}
          color={PALETTE.textDim}
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
          position={[TILE.socials.x + SOCIAL_X[i], TILE.socials.y, 0.2]}
          size={[SOCIAL_STEP - 0.10, SOCIAL_SIZE + 0.10, 0.7]}
          onActivate={() => s.url && window.open(s.url, '_blank', 'noopener')}
        />
      ))}
      {skills.map((s, i) => (
        <Hotspot
          key={s.id}
          id={`about-skill:${s.id}`}
          position={[
            TILE.skills.x + SKILL_X[i % 3],
            TILE.skills.y + SKILL_Y[Math.floor(i / 3)],
            0.2,
          ]}
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
