import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HoloPanel } from '@/objects/HoloPanel';
import { TerminalText, type TroikaText } from '@/text/TerminalText';
import { PALETTE } from '@/text/palette';
import { panelBox } from '@/objects/panelLayout';
import { useUi } from '@/state/store';
import { usePortrait } from '@/state/viewport';
import { navReserve, NAV_Z, REF_FOV as NAV_REF_FOV } from '@/scene/navMetrics';
import { F } from '@/state/frameState';
import { clamp01 } from '@/scroll/easing';
import type { Job } from '@/content/content.types';
import { jobRangeLabel } from '@/content/loadContent';

/**
 * A job as a FLIGHT CARD.
 *
 * Choreography across the card's slice of the section:
 *   0.00 - 0.28  approach : lying flat on its canyon wall, edge-on
 *   0.28 - 0.42  dock     : swings in, rotation flattens, lands dead centre
 *   0.42 - 0.72  hold     : locked square-on while the story types out
 *   0.72 - 1.00  depart   : tips back onto the wall and rips out past you
 *
 * The dock target is recomputed EVERY FRAME from the live camera basis rather
 * than baked as a world coordinate. That is what makes the card land centred at
 * any point on the spline and at any fov — and the experience fov is keyframed
 * 58 -> 78, so a baked position would drift badly.
 *
 * Parallax falls out of this for free: the docked card tracks the camera 1:1
 * while the wall monoliths and the timeline conduit stay world-anchored and
 * slide past, so near and far move at visibly different rates.
 *
 * The parked pose is FLUSH WITH ITS MONOLITH — same plane, same height, same
 * centre. It used to sit a metre higher and yawed 35 degrees off the wall so it
 * stayed readable on approach, which meant the card and the slab it belongs to
 * were visibly two unrelated objects. Alignment is worth more than readability
 * in a pose you spend a fraction of a second in.
 */

/**
 * Wider and taller than the 15.5 x 9.2 it replaced, but not as tall as it first
 * grew: at 10.4 the re-flowed copy left a third of the card empty underneath.
 * The story types in from the top, so what slack remains sits at the bottom on
 * purpose — it is where the text is still arriving.
 */
const CARD_W = 17.4;
const CARD_H = 9.4;
/**
 * And upright, for a phone. A landscape card is 8.7 units of half-width against
 * a portrait frustum's 4.8 — it overflows by two thirds — while the same frame
 * has more than twice the height it needs. So the card turns over: narrow and
 * tall, with the date on its own line under the company because the column it
 * used to sit in no longer exists.
 */
const CARD_W_P = 8.8;
const CARD_H_P = 14.0;
/** Stand-off from the camera when docked. Chosen so the card fills ~62% of frame height at fov 68. */
const DOCK_DIST = 15.5;
/** Frustum half-height at the NAV's plane — navReserve answers in fractions. */
const navHalfH = Math.tan((NAV_REF_FOV * Math.PI) / 360) * Math.abs(NAV_Z);

const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const UP = new THREE.Vector3();
const DOCK = new THREE.Vector3();
const PARK = new THREE.Vector3();
const TMP_Q = new THREE.Quaternion();
const PARK_Q = new THREE.Quaternion();
const EULER = new THREE.Euler();

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * 0 parked -> 1 docked -> 0 departed, from the card's own local progress.
 *
 * Exported because the section needs the same number to fade the year markers
 * out from under a docked card, and two copies of this curve would drift.
 */
export function cardDockAt(local: number): number {
  const inCurve = clamp01((local - 0.28) / 0.14);
  const outCurve = 1 - clamp01((local - 0.72) / 0.28);
  return Math.min(easeInOutCubic(inCurve), easeInOutCubic(outCurve));
}

/* ------------------------------- the layout ------------------------------ */

/**
 * Content is measured from a card shrunk by the margin first.
 *
 * panelBox's own padding is proportional AND spends only 0.4 of it vertically,
 * so on its own the copy sat about 0.2 from the top edge — technically inside
 * the frame, visually crammed against it. Insetting the box gives an even
 * margin on all four sides that does not change when the card is resized.
 */
const CARD_INSET = 0.55;

function buildCard(portrait: boolean) {
  const W = portrait ? CARD_W_P : CARD_W;
  const H = portrait ? CARD_H_P : CARD_H;
  const BOX = panelBox({
    width: W - CARD_INSET * 2,
    height: H - CARD_INSET * 2,
    header: 0,
  });

  if (!portrait) {
    /**
     * Company at 0.62, not larger: "Aponiar Solutions Pvt. Ltd." is 27
     * characters, and anything bigger wraps to a second line. Every row here is
     * anchored from its TOP, so a wrap would grow the block UPWARD out of the
     * card and put the overflow through the panel's own top edge — which is
     * exactly what it did.
     */
    const S = { company: 0.62, date: 0.42, role: 0.44, story: 0.44 };
    return {
      W, H, BOX, S,
      /** Company and date share the top line; role under it; the story fills the rest. */
      ROW: {
        head: BOX.top,
        /** Dropped by half the size difference, so the date optically centres on the company. */
        date: BOX.top - (S.company - S.date) * 0.5,
        role: BOX.top - S.company - 0.30,
        story: BOX.top - S.company - 0.30 - S.role - 0.50,
      },
      /** Leaves the date its own column on the right so the two can never collide. */
      companyMax: BOX.width - 5.2,
      /** The date shares the head row, hard right. */
      dateOwnRow: false,
      /**
       * Unset in landscape, exactly as it was: "role · location" runs to 13.5
       * against a 15.4-wide column, so it has never needed to wrap and giving
       * troika a width it never reaches would change nothing but the risk.
       */
      roleMax: undefined as number | undefined,
      /** How low the docked card sits. See the dock pose below. */
      dropUnits: 1.1,
    };
  }

  // Company at 0.40: the longest is 25 characters and the column is 6.85
  // wide, so anything larger wraps and the block grows UP out of the card.
  const S = { company: 0.40, date: 0.32, role: 0.36, story: 0.33 };
  const date = BOX.top - S.company - 0.18;
  const role = date - S.date - 0.26;
  return {
    W, H, BOX, S,
    ROW: {
      head: BOX.top,
      date,
      role,
      // Two lines of slack: "role · location" runs to 48 characters, which is
      // wider than this column, and the row below has to start under the wrap.
      story: role - S.role * 2 - 0.40,
    },
    // No date column to dodge any more — it is on its own line.
    companyMax: BOX.width,
    dateOwnRow: true,
    /*
     * REQUIRED here. The same 48-character line is 11 units wide against a
     * 6.9-wide column, and without a width troika does not wrap — it just runs
     * out past the card's edge. The story row below is already positioned two
     * lines down to receive the wrap.
     */
    roleMax: BOX.width as number | undefined,
    dropUnits: null as number | null,
  };
}

const CARD = { landscape: buildCard(false), portrait: buildCard(true) };

export interface JobCardProps {
  job: Job;
  /** Which wall this card parks on: +1 right, -1 left. */
  side: 1 | -1;
  /** World position of the card's parked pose, flush with its monolith. */
  parkX: number;
  parkY: number;
  parkZ: number;
  /** This card's slice of the section, in absolute journey progress. */
  range: [number, number];
  index: number;
}

export function JobCard({ job, side, parkX, parkY, parkZ, range, index }: JobCardProps) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const portrait = usePortrait();
  const safeTop = useUi((s) => s.safeTop);
  const { W: CARD_W_A, H: CARD_H_A, BOX, S, ROW, companyMax, dateOwnRow, dropUnits } =
    portrait ? CARD.portrait : CARD.landscape;
  const roleMax = (portrait ? CARD.portrait : CARD.landscape).roleMax;
  const group = useRef<THREE.Group>(null);
  const storyRef = useRef<TroikaText>(null);

  const state = useRef({ dock: 0, opacity: 0 });
  // A blank line BETWEEN paragraphs. Each story entry is a paragraph that troika
  // wraps to the card's own width now, rather than a line pre-broken by hand for
  // one particular card size.
  const storyText = useMemo(() => job.story.join('\n\n'), [job.story]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    const [a, b] = range;
    const local = clamp01((F.smooth - a) / Math.max(b - a, 1e-6));
    const dockTarget = cardDockAt(local);

    // Visible slightly beyond its own slice so cards cross-fade rather than pop.
    const vis = clamp01((local - 0.02) / 0.12) * (1 - clamp01((local - 0.9) / 0.1));
    state.current.opacity += (vis - state.current.opacity) * Math.min(1, delta * 8);
    state.current.dock += (dockTarget - state.current.dock) * Math.min(1, delta * 10);
    const dock = state.current.dock;

    g.visible = state.current.opacity > 0.004;
    if (!g.visible) return;

    // --- parked pose: flush with the monolith, facing across the canyon ---
    PARK.set(parkX, parkY, parkZ);
    EULER.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    PARK_Q.setFromEuler(EULER);

    // --- docked pose: dead centre in front of the camera, square-on ---
    camera.getWorldDirection(FWD);
    RIGHT.crossVectors(FWD, camera.up).normalize();
    UP.crossVectors(RIGHT, FWD).normalize();
    /**
     * Sits low enough that it never reaches the navigation.
     *
     * The 1.1 was authored when the nav was a bar across the top and stayed
     * after it moved to the left edge, where it does nothing — so landscape
     * keeps it exactly, as the harmless constant it now is. In portrait the nav
     * IS a bar across the top again, and the drop is derived from its real
     * depth rather than guessed at.
     */
    const camP = camera as THREE.PerspectiveCamera;
    const hH = Math.tan(THREE.MathUtils.degToRad(camP.fov) * 0.5) * DOCK_DIST;
    const drop = dropUnits ?? navReserve({
      portrait: true,
      sizeW: size.width,
      halfW: navHalfH * camP.aspect,
      halfH: navHalfH,
      safeTopWorld: (safeTop * 2 * navHalfH) / Math.max(1, size.height),
    }).top * hH;
    DOCK.copy(camera.position)
      .addScaledVector(FWD, DOCK_DIST)
      .addScaledVector(UP, -drop);

    g.position.lerpVectors(PARK, DOCK, dock);
    TMP_Q.copy(camera.quaternion);
    g.quaternion.copy(PARK_Q).slerp(TMP_Q, dock);

    // Slight scale-up on dock so it reads as coming toward you.
    g.scale.setScalar(0.62 + 0.38 * dock);

    // --- story types out while docked, paced by scroll ---
    const story = storyRef.current;
    if (story) {
      story.fillOpacity = state.current.opacity * dock;
      const bb = story.geometry?.boundingBox;
      if (bb) {
        const h = bb.max.y - bb.min.y;
        const reveal = clamp01((local - 0.34) / 0.30);
        story.clipRect = [-40, bb.max.y - h * reveal, 40, bb.max.y + 1];
      }
    }
  });

  return (
    <group ref={group}>
      <HoloPanel
        width={CARD_W_A}
        height={CARD_H_A}
        radius={0.5}
        header={0}
        footer={0}
        fill={0.2}
        grid={0.5}
        curve={0.5}
        lineWidth={0.04}
        bracket={0.34}
        signal={0.4 + index * 0.2}
      />

      {/* company left, dates right, on one line */}
      <TerminalText
        position={[BOX.left, ROW.head, 0.06]}
        anchorX="left"
        anchorY="top"
        fontSize={S.company}
        color={PALETTE.textBright}
        maxWidth={companyMax}
      >
        {job.company}
      </TerminalText>
      <TerminalText
        position={[dateOwnRow ? BOX.left : BOX.right, ROW.date, 0.06]}
        anchorX={dateOwnRow ? 'left' : 'right'}
        anchorY="top"
        fontSize={S.date}
        color={PALETTE.textDim}
        letterSpacing={0.06}
      >
        {jobRangeLabel(job)}
      </TerminalText>

      <TerminalText
        position={[BOX.left, ROW.role, 0.06]}
        anchorX="left"
        anchorY="top"
        fontSize={S.role}
        maxWidth={roleMax}
        color={PALETTE.accent}
      >
        {`${job.role}  ·  ${job.location}`}
      </TerminalText>

      <TerminalText
        ref={storyRef as never}
        position={[BOX.left, ROW.story, 0.06]}
        anchorX="left"
        anchorY="top"
        fontSize={S.story}
        lineHeight={1.5}
        maxWidth={BOX.width}
        color={PALETTE.text}
      >
        {storyText}
      </TerminalText>
    </group>
  );
}

export { CARD_W, CARD_H, DOCK_DIST };
