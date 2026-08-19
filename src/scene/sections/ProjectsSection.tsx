import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText } from '@/text/TerminalText';
import { ProjectFrame } from '@/objects/ProjectFrame';
import { ProjectThumb, useThumbnail } from '@/objects/ProjectThumb';
import { GridFloor } from '@/objects/GridFloor';
import { Hotspot } from '@/objects/Hotspot';
import { HudBracket } from '@/objects/HudBracket';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { projects, assetUrl } from '@/content/loadContent';
import { WALL, projectX } from '@/camera/projectsPath.mjs';
import { getUi, setUi, useUi } from '@/state/store';
import { usePortrait } from '@/state/viewport';
import { PALETTE } from '@/text/palette';
import { ProjectDossier, projectTint } from './ProjectDossier';

const Z = WALL.z;

/**
 * The drawn frame, at both orientations.
 *
 * The camera path is NOT touched: it is generated at runtime from
 * projectsPath.mjs and every section's range, the scroll height and the build's
 * journey checks are downstream of it. So the wall stays exactly where it is and
 * the frames get smaller instead — which costs nothing, because this leg is
 * authored as one project at a time in the middle of frame anyway. At DIST 11.5
 * and fov 54 a phone has 2.7 units of half-width against the 3.8 a landscape
 * frame wants.
 */
function buildFrame(portrait: boolean) {
  if (!portrait) {
    return {
      w: 7.6, h: 5, inset: 0.26,
      bracket: [8.6, 5.9] as [number, number],
      header: 6.4, headerSize: 0.6,
      titleY: -3.4, techY: -4.1,
      titleSize: 0.34, techSize: 0.21,
      hit: [7.6, 5, 1.5] as [number, number, number],
    };
  }
  return {
    w: 4.6, h: 3.0, inset: 0.18,
    bracket: [5.2, 3.6] as [number, number],
    header: 5.0, headerSize: 0.44,
    titleY: -2.2, techY: -2.7,
    titleSize: 0.26, techSize: 0.17,
    hit: [4.6, 3.0, 1.5] as [number, number, number],
  };
}

const FRAME = { landscape: buildFrame(false), portrait: buildFrame(true) };

/**
 * The wall, spaced from the SAME constants the camera path is built from
 * (src/camera/projectsPath.mjs). These used to be two copies of `-292` and
 * `9.2`, one here and one implied by the keyframes, and the camera stopped
 * agreeing with the frames the moment either moved.
 */
export const PROJECT_LAYOUT = projects.map((p, i) => ({
  project: p,
  position: [projectX(i, projects.length), WALL.y, Z] as [number, number, number],
}));

/**
 * 05 — "The Gallery Walk".
 *
 * The camera does not fly past this wall any more; it stops square-on in front
 * of each frame in turn, left to right, then leaves the last one for Contact.
 * That path is generated from the project count, so the wall and the walk grow
 * together and neither is tuned by hand.
 */
export function ProjectsSection() {
  const portrait = usePortrait();
  const F = portrait ? FRAME.portrait : FRAME.landscape;
  const p = useSectionProgress('projects');
  const group = useRef<THREE.Group>(null);
  const hovered = useUi((s) => s.hovered);
  const openId = useUi((s) => s.projectId);
  const band = useRef(0);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    band.current = p.current.band;
    // The wall stays up behind an open dossier: the panel is docked in front of
    // it and cuts it with depth, and hiding the section would take the dossier
    // with it. Only the band drives visibility.
    g.visible = band.current > 0.001;
    // Scrolling out of the section with a dossier open would leave it docked to
    // a camera that is now somewhere else entirely.
    if (!g.visible && getUi().projectId) setUi({ projectId: null });
  });

  return (
    <group ref={group}>
      <GridFloor size={340} y={-7} z={Z} opacity={0.42} />

      <TerminalText position={[0, F.header, Z]} fontSize={F.headerSize} color={PALETTE.accent}>
        {'> ls ./projects'}
      </TerminalText>

      {PROJECT_LAYOUT.map((item, i) => (
        <ProjectWallFrame
          key={item.project.id}
          item={item}
          index={i}
          hot={hovered === `project:${item.project.id}`}
          interactive={!openId}
          F={F}
        />
      ))}

      {/* Docks to the camera when a frame is clicked. Always mounted, so it can
          play its exit after the project it was showing is deselected. */}
      <ProjectDossier />
    </group>
  );
}

/**
 * One frame on the wall.
 *
 * Split out of the map because it loads a texture, and a hook cannot live in a
 * loop body. The thumbnail arrives asynchronously and the frame is complete
 * without it, so until then this is exactly the empty state it always was.
 */
function ProjectWallFrame({
  item,
  index: i,
  hot,
  interactive,
  F,
}: {
  item: (typeof PROJECT_LAYOUT)[number];
  index: number;
  hot: boolean;
  interactive: boolean;
  F: ReturnType<typeof buildFrame>;
}) {
  const thumb = useThumbnail(assetUrl(item.project.thumbnail));
  const isHot = hot;
  return (
        <group>
            <ProjectFrame
              position={item.position}
              hover={isHot ? 1 : 0}
              seed={i + 1}
              width={F.w}
              height={F.h}
              interior={thumb ? 0 : 1}
              color={projectTint(i).color}
            />
            {/* Inset so the frame's own border still reads as the bezel. */}
            <ProjectThumb
              texture={thumb}
              width={F.w - F.inset}
              height={F.h - F.inset}
              hover={isHot ? 1 : 0}
              tint={projectTint(i).color}
              position={[item.position[0], item.position[1], item.position[2] + 0.02]}
            />
            <HudBracket
              width={F.bracket[0]}
              height={F.bracket[1]}
              position={[item.position[0], item.position[1], item.position[2] + 0.05]}
              lock={isHot ? 1 : 0.72}
              opacity={isHot ? 1 : 0.5}
              color={projectTint(i).color}
            />
            <TerminalText
              position={[item.position[0], item.position[1] + F.titleY, item.position[2]]}
              fontSize={F.titleSize}
              color={item.project.placeholder ? PALETTE.textDim : PALETTE.text}
            >
              {`[ ${item.project.title} ]`}
            </TerminalText>
            {item.project.placeholder && (
              <TerminalText
                position={[item.position[0], item.position[1] + F.techY, item.position[2]]}
                fontSize={F.techSize}
                color={PALETTE.textDim}
                fillOpacity={0.6}
              >
                {`// site.json → projects[${i}]`}
              </TerminalText>
            )}
            {!item.project.placeholder && item.project.tech.length > 0 && (
              <TerminalText
                position={[item.position[0], item.position[1] + F.techY, item.position[2]]}
                fontSize={F.techSize}
                color={PALETTE.textDim}
              >
                {item.project.tech.join(' · ')}
              </TerminalText>
            )}
            {/*
              Unmounted while a dossier is open: the panel docks between the
              camera and the wall, and a wall hotspot is a box in world space
              that would still swallow clicks meant for the panel behind it.
            */}
            {interactive && (
              <Hotspot
                id={`project:${item.project.id}`}
                position={item.position}
                size={F.hit}
                onActivate={() => setUi({ projectId: item.project.id })}
              />
            )}
        </group>
  );
}
