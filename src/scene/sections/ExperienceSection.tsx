import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerminalText } from '@/text/TerminalText';
import { JobMonolith } from '@/objects/JobMonolith';
import { Conduit } from '@/objects/Conduit';
import { useSectionProgress } from '@/scroll/useSectionProgress';
import { experience, jobStart, jobEnd, getSection } from '@/content/loadContent';
import { PALETTE } from '@/text/palette';
import { JobCard } from './JobCard';
import { JobDossier } from './JobDossier';
import { F } from '@/state/frameState';
import { getUi, setUi } from '@/state/store';

const CANYON_START = -150;
const CANYON_LEN = 110;
const WALL_X = 11;

const [SEC_START, SEC_END] = getSection('experience').range;
const SPAN = SEC_END - SEC_START;

/**
 * Monolith geometry is COMPUTED from the real ISO dates — change a date in
 * site.json and the world physically changes shape.
 */
export const JOB_LAYOUT = (() => {
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
      center: [side * WALL_X, 0.5, (z0 + z1) / 2] as [number, number, number],
      current: j.end === null,
      range: [SEC_START + i * slice, SEC_START + (i + 1) * slice] as [number, number],
    };
  });
})();

/**
 * 04 — "The Timeline Canyon".
 *
 * The rain rotates its flow axis to horizontal so code streams past like time.
 * The wall monoliths and the conduit stay WORLD-anchored and slide by; the job
 * cards dock to the camera. Those two rates moving against each other is the
 * parallax.
 */
export function ExperienceSection() {
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

  // Escape closes the dossier. Real keyboard affordance, not decoration.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && getUi().openCard) setUi({ openCard: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = p.current.band > 0.001;

    // Leaving the section closes the dossier, rather than locking scroll to
    // keep it open — a scroll lock would desynchronise the camera from the
    // scrollbar, since F.raw is read straight from window.scrollY.
    if (!g.visible && getUi().openCard) setUi({ openCard: null });
    else if (getUi().openCard) {
      const m = JOB_LAYOUT.find((x) => x.job.id === getUi().openCard);
      if (m && (F.smooth < m.range[0] - 0.01 || F.smooth > m.range[1] + 0.01)) setUi({ openCard: null });
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
      {JOB_LAYOUT.map((m) => (
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

      {/* Flight cards: park on the wall, dock dead-centre, depart. */}
      {JOB_LAYOUT.map((m) => (
        <JobCard
          key={`card-${m.job.id}`}
          job={m.job}
          side={m.side}
          parkX={m.side * (WALL_X - 0.6)}
          parkZ={m.center[2]}
          range={m.range}
          index={m.index}
        />
      ))}

      {/* Year mile-markers along the conduit. */}
      {years.map((y) => (
        <TerminalText key={y.label} position={[0, -3.4, y.z]} fontSize={0.7} color={PALETTE.textDim}>
          {y.label}
        </TerminalText>
      ))}

      <JobDossier />
    </group>
  );
}
