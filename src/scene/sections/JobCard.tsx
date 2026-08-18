import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HoloPanel } from '@/objects/HoloPanel';
import { TerminalText, type TroikaText } from '@/text/TerminalText';
import { PALETTE } from '@/text/palette';
import { panelBox } from '@/objects/panelLayout';
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
/** Stand-off from the camera when docked. Chosen so the card fills ~62% of frame height at fov 68. */
const DOCK_DIST = 15.5;

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
const BOX = panelBox({
  width: CARD_W - CARD_INSET * 2,
  height: CARD_H - CARD_INSET * 2,
  header: 0,
});

/**
 * Company at 0.62, not larger: "Aponiar Solutions Pvt. Ltd." is 27 characters,
 * and anything bigger wraps to a second line. Every row here is anchored from
 * its TOP, so a wrap would grow the block UPWARD out of the card and put the
 * overflow through the panel's own top edge — which is exactly what it did.
 */
const S = { company: 0.62, date: 0.42, role: 0.44, story: 0.44 };
/** Company and date share the top line; role under it; the story fills the rest. */
const ROW = {
  head: BOX.top,
  /** Dropped by half the size difference, so the smaller date optically centres on the company. */
  date: BOX.top - (S.company - S.date) * 0.5,
  role: BOX.top - S.company - 0.30,
  story: BOX.top - S.company - 0.30 - S.role - 0.50,
};
/** Leaves the date its own column on the right so the two can never collide. */
const COMPANY_MAX = BOX.width - 5.2;

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
    DOCK.copy(camera.position)
      .addScaledVector(FWD, DOCK_DIST)
      // sits a touch low so it never reaches the nav bar at the top of frame
      .addScaledVector(UP, -1.1);

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
        width={CARD_W}
        height={CARD_H}
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
        maxWidth={COMPANY_MAX}
      >
        {job.company}
      </TerminalText>
      <TerminalText
        position={[BOX.right, ROW.date, 0.06]}
        anchorX="right"
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
