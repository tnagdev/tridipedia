import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText } from '@/text/TerminalText';
import { ProjectFrame } from '@/objects/ProjectFrame';
import { GridFloor } from '@/objects/GridFloor';
import { Hotspot } from '@/objects/Hotspot';
import { HudBracket } from '@/objects/HudBracket';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { projects } from '@/content/loadContent';
import { useUi } from '@/state/store';
import { PALETTE } from '@/text/palette';

const Z = -292;

export const PROJECT_LAYOUT = projects.map((p, i) => ({
  project: p,
  position: [(i - (projects.length - 1) / 2) * 9.2, 2, Z] as [number, number, number],
}));

/**
 * 05 — "The Empty Grid". Designed to look INTENTIONAL while empty, and to need
 * zero structural change once real projects arrive.
 */
export function ProjectsSection() {
  const p = useSectionProgress('projects');
  const group = useRef<THREE.Group>(null);
  const hovered = useUi((s) => s.hovered);
  const band = useRef(0);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    band.current = p.current.band;
    g.visible = band.current > 0.001;
  });

  return (
    <group ref={group}>
      <GridFloor size={340} y={-7} z={Z} opacity={0.42} />

      <TerminalText position={[0, 6.4, Z]} fontSize={0.6} color={PALETTE.accent}>
        {'> ls ./projects'}
      </TerminalText>

      {PROJECT_LAYOUT.map((item, i) => {
        const isHot = hovered === `project:${item.project.id}`;
        return (
          <group key={item.project.id}>
            <ProjectFrame
              position={item.position}
              hover={isHot ? 1 : 0}
              seed={i + 1}
              width={7.6}
              height={5}
              color={[PALETTE.rain, '#4FD1FF', '#FFC14F'][i % 3]}
            />
            <HudBracket
              width={8.6}
              height={5.9}
              position={[item.position[0], item.position[1], item.position[2] + 0.05]}
              lock={isHot ? 1 : 0.72}
              opacity={isHot ? 1 : 0.5}
              color={[PALETTE.rain, '#4FD1FF', '#FFC14F'][i % 3]}
            />
            <TerminalText
              position={[item.position[0], item.position[1] - 3.4, item.position[2]]}
              fontSize={0.34}
              color={item.project.placeholder ? PALETTE.textDim : PALETTE.text}
            >
              {`[ ${item.project.title} ]`}
            </TerminalText>
            {item.project.placeholder && (
              <TerminalText
                position={[item.position[0], item.position[1] - 4.1, item.position[2]]}
                fontSize={0.21}
                color={PALETTE.textDim}
                fillOpacity={0.6}
              >
                {`// site.json → projects[${i}]`}
              </TerminalText>
            )}
            {!item.project.placeholder && item.project.tech.length > 0 && (
              <TerminalText
                position={[item.position[0], item.position[1] - 4.1, item.position[2]]}
                fontSize={0.21}
                color={PALETTE.textDim}
              >
                {item.project.tech.join(' · ')}
              </TerminalText>
            )}
            <Hotspot
              id={`project:${item.project.id}`}
              position={item.position}
              size={[7.6, 5, 1.5]}
              onActivate={() => item.project.url && window.open(item.project.url, '_blank', 'noopener')}
            />
          </group>
        );
      })}
    </group>
  );
}
