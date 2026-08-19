import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HoloPanel } from '@/objects/HoloPanel';
import { TerminalText } from '@/text/TerminalText';
import { PALETTE } from '@/text/palette';
import { panelBox, columns } from '@/objects/panelLayout';
import { setUi, useUi } from '@/state/store';
import { experience, jobRangeLabel, jobDurationLabel, jobStart, jobEnd } from '@/content/loadContent';
import { StatBar } from '@/objects/StatBar';

/**
 * The dossier popup, opened by clicking a docked job card.
 *
 * Camera-relative, computed in useFrame rather than parented to the camera:
 * Nav3D already parents a group to the camera object via <primitive>, and
 * attaching a second parent to the same Object3D fights over the same
 * children array in R3F v8.
 *
 * SCROLLING IS NOT LOCKED while this is open. Locking would fight the
 * Lenis + native-scroll setup, where F.raw is read from window.scrollY — a
 * scroll lock there desynchronises the camera from the scrollbar. Instead the
 * popup closes as soon as the card it belongs to leaves its docked window,
 * so scrolling away dismisses it naturally.
 */

const W = 17.5;
const H = 10.5;
const DIST = 13.5;

const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const UP = new THREE.Vector3();

export function JobDossier() {
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const openId = useUi((s) => s.openCard);
  const anim = useRef(0);

  const job = useMemo(() => experience.find((j) => j.id === openId) ?? null, [openId]);
  const box = useMemo(() => panelBox({ width: W, height: H, header: 0.15 }), []);
  const chipXs = useMemo(() => columns(box, 5, 0.42), [box]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    const target = job ? 1 : 0;
    anim.current += (target - anim.current) * Math.min(1, delta * 9);
    g.visible = anim.current > 0.005;
    if (!g.visible) return;

    camera.getWorldDirection(FWD);
    RIGHT.crossVectors(FWD, camera.up).normalize();
    UP.crossVectors(RIGHT, FWD).normalize();

    g.position
      .copy(camera.position)
      .addScaledVector(FWD, DIST)
      .addScaledVector(UP, -0.9);
    g.quaternion.copy(camera.quaternion);
    // Slight rise as it opens.
    g.scale.setScalar(0.86 + 0.14 * anim.current);
  });

  const months = job
    ? Math.max(1, Math.round((jobEnd(job).getTime() - jobStart(job).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
    : 1;
  // Longest tenure in the CV, so the bar is comparative rather than arbitrary.
  const longest = Math.max(
    ...experience.map((j) =>
      Math.round((jobEnd(j).getTime() - jobStart(j).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
    ),
  );

  /*
   * ALWAYS render the same single <group>, with the contents conditional.
   *
   * Returning a *different* element when closed (`<group visible={false} />`)
   * looked equivalent but was not: R3F reconciles both to the SAME Object3D,
   * and a prop that disappears between renders is not reset — so `visible`
   * stayed false forever once the closed branch had rendered, and the popup
   * could never appear. Visibility is owned by useFrame alone.
   */
  return (
    <group ref={group} renderOrder={900}>
      {job && (
        <>
      <HoloPanel
        width={W}
        height={H}
        header={0.15}
        footer={0.085}
        fill={0.2}
        curve={0.35}
        chrome
        theme="ark"
        signal={0.85}
        boot={1}
      />

      <TerminalText
        position={[box.left + 1.15, box.headerY, 0.06]}
        anchorX="left"
        fontSize={box.captionSize}
        color="#FFB23F"
        letterSpacing={0.2}
      >
        {`DOSSIER :: ${job.company.toUpperCase()}`}
      </TerminalText>

      <TerminalText
        position={[box.left, box.top - box.titleSize * 0.5, 0.06]}
        anchorX="left"
        fontSize={box.titleSize}
        color="#BFF0FF"
        maxWidth={box.width}
      >
        {job.role}
      </TerminalText>

      <TerminalText
        position={[box.left, box.top - box.titleSize * 1.75, 0.06]}
        anchorX="left"
        fontSize={box.captionSize}
        color={PALETTE.textDim}
      >
        {`${jobRangeLabel(job)}   ·   ${jobDurationLabel(job)}   ·   ${job.location}`}
      </TerminalText>

      {/*
        The job's story, whole.

        This block used to render a separate `summary` field, which meant a job
        was described one way on the card and another way in its own popup. It
        is not redundant to repeat the card's copy here: the card reveals the
        story line by line as you scroll past it (clipRect in JobCard), so
        until now there was no view that showed all of it at once.

        0.70 of bodySize rather than 0.92: at 0.92 the longest of the three
        stories runs 6.8 units into a 4.2 unit gap and prints straight through
        the tenure bar. The scale is still derived from the panel, so a
        resize still carries the copy with it.
      */}
      <TerminalText
        position={[box.left, box.top - box.titleSize * 2.9, 0.06]}
        anchorX="left"
        anchorY="top"
        fontSize={box.bodySize * 0.70}
        lineHeight={1.5}
        maxWidth={box.width}
        color="#DFF6FF"
      >
        {job.story.join('\n\n')}
      </TerminalText>

      {/* tenure, drawn as a bar so it can be compared at a glance */}
      <TerminalText
        position={[box.left, box.bottom + box.bodySize * 2.5, 0.06]}
        anchorX="left"
        fontSize={box.captionSize}
        color={PALETTE.textDim}
      >
        TENURE
      </TerminalText>
      <StatBar
        width={box.width * 0.62}
        height={0.16}
        value={months / longest}
        position={[box.left + box.width * 0.31 + 2.4, box.bottom + box.bodySize * 2.5, 0.06]}
        color="#FFB23F"
      />

      {/* stack chips */}
      <TerminalText
        position={[box.left, box.bottom + box.bodySize * 1.1, 0.06]}
        anchorX="left"
        fontSize={box.captionSize}
        color={PALETTE.textDim}
      >
        STACK
      </TerminalText>
      {job.tech.slice(0, 5).map((t, i) => (
        <TerminalText
          key={t}
          position={[chipXs[i], box.bottom - box.bodySize * 0.2, 0.06]}
          fontSize={box.captionSize * 0.95}
          color="#4FD1FF"
          outlineWidth={0.012}
        >
          {t}
        </TerminalText>
      ))}

      <TerminalText
        position={[box.right, box.footerY, 0.06]}
        anchorX="right"
        fontSize={box.captionSize}
        color={PALETTE.textDim}
      >
        ESC / CLICK TO CLOSE
      </TerminalText>

      {/* close target over the chrome X */}
      <mesh
        position={[W / 2 - 0.52, H / 2 - H * 0.075, 0.12]}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          setUi({ openCard: null });
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      >
        <planeGeometry args={[1.1, 1.1]} />
      </mesh>
        </>
      )}
    </group>
  );
}
