import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HoloPanel } from '@/objects/HoloPanel';
import { HudBracket } from '@/objects/HudBracket';
import { TerminalText, type TroikaText } from '@/text/TerminalText';
import { PALETTE } from '@/text/palette';
import { panelBox } from '@/objects/panelLayout';
import { F } from '@/state/frameState';
import { clamp01 } from '@/scroll/easing';
import { setUi, useUi } from '@/state/store';
import type { Job } from '@/content/content.types';
import { jobRangeLabel, jobDurationLabel } from '@/content/loadContent';

/**
 * A job as a FLIGHT CARD.
 *
 * Choreography across the card's slice of the section:
 *   0.00 - 0.28  approach : parked on its canyon wall, yawed and foreshortened
 *   0.28 - 0.42  dock     : swings in, rotation flattens, lands dead centre
 *   0.42 - 0.72  hold     : locked square-on while the story types out
 *   0.72 - 1.00  depart   : tips back to perspective and rips out past you
 *
 * The dock target is recomputed EVERY FRAME from the live camera basis rather
 * than baked as a world coordinate. That is what makes the card land centred at
 * any point on the spline and at any fov — and the experience fov is keyframed
 * 58 -> 78, so a baked position would drift badly. The same technique fixed the
 * skills console earlier.
 *
 * Parallax falls out of this for free: the docked card tracks the camera 1:1
 * while the wall monoliths and the timeline conduit stay world-anchored and
 * slide past, so near and far move at visibly different rates.
 */

const CARD_W = 15.5;
const CARD_H = 9.2;
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

export interface JobCardProps {
  job: Job;
  /** Which wall this card parks on: +1 right, -1 left. */
  side: 1 | -1;
  /** World Z of the card's parked position on the wall. */
  parkZ: number;
  parkX: number;
  /** This card's slice of the section, in absolute journey progress. */
  range: [number, number];
  index: number;
}

export function JobCard({ job, side, parkZ, parkX, range, index }: JobCardProps) {
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const storyRef = useRef<TroikaText>(null);
  const openId = useUi((s) => s.openCard);
  const hovered = useUi((s) => s.hovered) === `job:${job.id}`;
  const isOpen = openId === job.id;

  const state = useRef({ dock: 0, opacity: 0, boot: 0 });

  const storyText = useMemo(() => job.story.join('\n'), [job.story]);
  const box = useMemo(() => panelBox({ width: CARD_W, height: CARD_H, header: 0.16 }), []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    const [a, b] = range;
    const local = clamp01((F.smooth - a) / Math.max(b - a, 1e-6));

    // --- dock curve: 0 parked -> 1 docked -> 0 departed ---
    const inCurve = clamp01((local - 0.28) / 0.14);
    const outCurve = 1 - clamp01((local - 0.72) / 0.28);
    const dockTarget = Math.min(easeInOutCubic(inCurve), easeInOutCubic(outCurve));

    // Visible slightly beyond its own slice so cards cross-fade rather than pop.
    // The card also yields entirely while its OWN dossier is open — the popup
    // sits in front of it at the same camera-relative anchor, so leaving both
    // up superimposes two sets of text on each other.
    const vis = clamp01((local - 0.02) / 0.12)
      * (1 - clamp01((local - 0.9) / 0.1))
      * (isOpen ? 0 : 1);
    state.current.opacity += (vis - state.current.opacity) * Math.min(1, delta * 8);
    state.current.dock += (dockTarget - state.current.dock) * Math.min(1, delta * 10);
    const dock = state.current.dock;

    g.visible = state.current.opacity > 0.004;
    if (!g.visible) return;

    // --- parked pose: on the wall, yawed back up the corridor ---
    PARK.set(parkX, 1.6, parkZ);
    EULER.set(0, side > 0 ? -Math.PI / 2 + 0.62 : Math.PI / 2 - 0.62, side * 0.06);
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
    const s = 0.62 + 0.38 * dock;
    g.scale.setScalar(s);

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

    state.current.boot += ((dock > 0.15 ? 1 : 0) - state.current.boot) * Math.min(1, delta * 4);
  });

  const opacity = state.current.opacity;

  return (
    <group ref={group}>
      <HoloPanel
        width={CARD_W}
        height={CARD_H}
        header={0.16}
        footer={0.08}
        fill={0.19}
        curve={0.5}
        opacity={1}
        boot={1}
        lock={1}
        signal={0.4 + index * 0.2}
        theme={isOpen ? 'ark' : 'matrix'}
      />
      <HudBracket
        width={CARD_W + 1.1}
        height={CARD_H + 1.0}
        lock={hovered || isOpen ? 1 : 0.7}
        opacity={hovered || isOpen ? 1 : 0.6}
        color={isOpen ? '#FFB23F' : PALETTE.accent}
        position={[0, 0, 0.02]}
      />

      {/* header: phase tag left, date range right */}
      <TerminalText
        position={[box.left, box.headerY, 0.06]}
        anchorX="left"
        fontSize={box.captionSize}
        color={isOpen ? '#FFB23F' : PALETTE.accent}
        letterSpacing={0.18}
      >
        {job.phase}
      </TerminalText>
      <TerminalText
        position={[box.right, box.headerY, 0.06]}
        anchorX="right"
        fontSize={box.captionSize}
        color={PALETTE.textDim}
      >
        {jobRangeLabel(job)}
      </TerminalText>

      {/* company + role */}
      <TerminalText
        position={[box.left, box.top - box.titleSize * 0.5, 0.06]}
        anchorX="left"
        fontSize={box.titleSize}
        color={PALETTE.textBright}
        maxWidth={box.width}
      >
        {job.company}
      </TerminalText>
      <TerminalText
        position={[box.left, box.top - box.titleSize * 1.9, 0.06]}
        anchorX="left"
        fontSize={box.bodySize}
        color={PALETTE.text}
      >
        {`${job.role}  ·  ${job.location}`}
      </TerminalText>

      {/* the engineer's log */}
      <TerminalText
        ref={storyRef as never}
        position={[box.left, box.top - box.titleSize * 3.0, 0.06]}
        anchorX="left"
        anchorY="top"
        fontSize={box.bodySize * 0.94}
        lineHeight={box.lineHeight}
        maxWidth={box.width}
        color={PALETTE.text}
      >
        {storyText}
      </TerminalText>

      {/* footer: duration + the click affordance */}
      <TerminalText
        position={[box.left, box.footerY, 0.06]}
        anchorX="left"
        fontSize={box.captionSize}
        color={PALETTE.textDim}
      >
        {jobDurationLabel(job)}
      </TerminalText>
      <TerminalText
        position={[box.right, box.footerY, 0.06]}
        anchorX="right"
        fontSize={box.captionSize}
        color={hovered ? PALETTE.textBright : PALETTE.textDim}
      >
        {isOpen ? '[ CLOSE ]' : '[ OPEN DOSSIER ]'}
      </TerminalText>

      {/* click target — only meaningful once the card is actually docked */}
      <mesh
        position={[0, 0, 0.1]}
        visible={false}
        onPointerOver={(e) => {
          if (state.current.dock < 0.5) return;
          e.stopPropagation();
          setUi({ hovered: `job:${job.id}` });
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setUi({ hovered: null });
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          if (state.current.dock < 0.5) return;
          e.stopPropagation();
          setUi({ openCard: isOpen ? null : job.id });
        }}
      >
        <planeGeometry args={[CARD_W, CARD_H]} />
      </mesh>

      {/* keeps `opacity` referenced so the group fade is not optimised away */}
      <group visible={opacity > 0} />
    </group>
  );
}

export { CARD_W, CARD_H, DOCK_DIST };
