import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText, type TroikaText } from '@/text/TerminalText';
import { JobMonolith } from '@/objects/JobMonolith';
import { Conduit } from '@/objects/Conduit';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { experience, jobStart, jobEnd, getSection } from '@/content/loadContent';
import { PALETTE } from '@/text/palette';
import { JobCard, cardDockAt } from './JobCard';
import { F } from '@/state/frameState';
import { clamp01 } from '@/scroll/easing';
import { usePortrait } from '@/state/viewport';

const CANYON_START = -150;
const CANYON_LEN = 110;
const WALL_X = 11;
/**
 * And the portrait one.
 *
 * The monoliths are peripheral parallax — you fly BETWEEN them, you do not read
 * them — so on a phone they are not broken, just gone: at 11 units out they sit
 * well outside a frustum that is 5 units of half-width, and the canyon reads as
 * empty space with cards floating in it. Bringing them in restores the walls to
 * the corner of the eye, which is the whole of their job.
 */
const WALL_X_P = 7.5;
/** Height of the wall slabs, and therefore of the cards parked flush on them. */
const WALL_Y = 0.5;

const [SEC_START, SEC_END] = getSection('experience').range;
const SPAN = SEC_END - SEC_START;

/**
 * Monolith geometry is COMPUTED from the real ISO dates — change a date in
 * site.json and the world physically changes shape.
 */
function buildJobLayout(portrait: boolean) {
  const wallX = portrait ? WALL_X_P : WALL_X;
  const t0 = new Date(experience[0]?.start ?? '2018-01-01').getTime();
  const t1 = Date.now();
  const span = Math.max(1, t1 - t0);
  const u = (d: Date) => (d.getTime() - t0) / span;

  return experience.map((j, i) => {
    const z0 = CANYON_START - u(jobStart(j)) * CANYON_LEN;
    const z1 = CANYON_START - u(jobEnd(j)) * CANYON_LEN;
    const length = Math.max(8, Math.abs(z1 - z0));
    const side = (i % 2 === 0 ? 1 : -1) as 1 | -1;
    // Each job owns an equal slice of the section's scroll range.
    const slice = SPAN / experience.length;
    return {
      job: j,
      side,
      length,
      index: i,
      center: [side * wallX, WALL_Y, (z0 + z1) / 2] as [number, number, number],
      current: j.end === null,
      range: [SEC_START + i * slice, SEC_START + (i + 1) * slice] as [number, number],
      wallX,
    };
  });
}

const CANYON = { landscape: buildJobLayout(false), portrait: buildJobLayout(true) };
/** The landscape canyon, for anything that only needs the count or the ranges. */
export const JOB_LAYOUT = CANYON.landscape;
export const jobCanyon = (portrait: boolean) => (portrait ? CANYON.portrait : CANYON.landscape);

/**
 * 04 — "The Timeline Canyon".
 *
 * The rain rotates its flow axis to horizontal so code streams past like time.
 * The wall monoliths and the conduit stay WORLD-anchored and slide by; the job
 * cards dock to the camera. Those two rates moving against each other is the
 * parallax.
 */
export function ExperienceSection() {
  const portrait = usePortrait();
  const canyon = jobCanyon(portrait);
  const p = useSectionProgress('experience');
  const group = useRef<THREE.Group>(null);

  const years = useMemo(() => {
    const startYear = new Date(experience[0]?.start ?? '2018-01-01').getFullYear();
    const endYear = new Date().getFullYear();
    const out: { label: string; z: number }[] = [];
    const t0 = new Date(experience[0]?.start ?? '2018-01-01').getTime();
    const span = Math.max(1, Date.now() - t0);
    for (let y = startYear; y <= endYear; y++) {
      const frac = (new Date(`${y}-01-01`).getTime() - t0) / span;
      if (frac < -0.02) continue;
      out.push({ label: String(y), z: CANYON_START - frac * CANYON_LEN });
    }
    return out;
  }, []);

  const yearRefs = useRef<(TroikaText | null)[]>([]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = p.current.band > 0.001;
    if (!g.visible) return;

    // The mile markers stand on the canyon floor, well inside the distance the
    // card docks at — so the ones between the camera and a docked card printed
    // straight through it. They are background furniture; they yield while a
    // card is being read and come back as it departs.
    const slice = SPAN / JOB_LAYOUT.length;
    const i = Math.min(
      JOB_LAYOUT.length - 1,
      Math.max(0, Math.floor((F.smooth - SEC_START) / slice)),
    );
    const local = clamp01((F.smooth - (SEC_START + i * slice)) / slice);
    const hidden = cardDockAt(local);
    // All the way to nothing at full dock. At 4% left the year was still a
    // legible smudge sitting in the middle of the copy.
    const show = 1 - hidden;
    for (const t of yearRefs.current) {
      if (!t) continue;
      t.fillOpacity = show;
      // The OUTLINE has to go too. Fading only the fill leaves troika's black
      // outline at full strength, and a black outline over the card's dark body
      // reads as a grey ghost of the year sitting on top of the copy.
      t.outlineOpacity = show * 0.9;
    }
  });

  return (
    <group ref={group}>
      {/* One conduit down the canyon floor: the timeline path, unchanged. */}
      <Conduit
        id="canyon-spine"
        from={[0, -4.2, CANYON_START + 14]}
        to={[0, -4.2, CANYON_START - CANYON_LEN - 14]}
        width={0.4}
        pulses={9}
        speed={0.3}
      />

      {/* World-anchored wall slabs. These do NOT dock — they are the far
          parallax layer the docked cards move against. */}
      {canyon.map((m) => (
        <JobMonolith
          key={m.job.id}
          length={m.length}
          height={7}
          position={m.center}
          side={m.side}
          current={m.current}
          opacity={0.85}
        />
      ))}

      {/* Flight cards: lie flush on the wall, dock dead-centre, depart. */}
      {canyon.map((m) => (
        <JobCard
          key={`card-${m.job.id}`}
          job={m.job}
          side={m.side}
          parkX={m.side * (m.wallX - 0.6)}
          parkY={m.center[1]}
          parkZ={m.center[2]}
          range={m.range}
          index={m.index}
        />
      ))}

      {/* Year mile-markers along the conduit. */}
      {years.map((y, i) => (
        <TerminalText
          key={y.label}
          ref={((el: TroikaText | null) => { yearRefs.current[i] = el; }) as never}
          position={[0, -3.4, y.z]}
          fontSize={0.7}
          color={PALETTE.textDim}
        >
          {y.label}
        </TerminalText>
      ))}
    </group>
  );
}
