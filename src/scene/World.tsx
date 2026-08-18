import { useMemo } from 'react';
import { DigitalRain } from '@/rain/DigitalRain';
import { RainDriver } from '@/rain/RainDriver';
import { J } from '@/camera/journey';
import { useSectionActive } from '@/scroll/useSectionActive';
import { SKILL_LAYOUT } from './sections/SkillsSection';
import { HeroSection } from './sections/HeroSection';
import { AboutSection } from './sections/AboutSection';
import { SkillsSection } from './sections/SkillsSection';
import { ExperienceSection } from './sections/ExperienceSection';
import { ProjectsSection } from './sections/ProjectsSection';
import { ContactSection } from './sections/ContactSection';
import type { SkillZone } from '@/rain/buildRainAttributes';
import type { TierSpec } from '@/perf/tier';

/**
 * Only the sections near the camera are mounted, which is what keeps the live
 * <Text> count trivially inside budget.
 */
export function World({ tier, forceAll = false }: { tier: TierSpec; forceAll?: boolean }) {
  // Tag rain columns near each skill chip so the per-skill glyph lock and
  // colour tint still land now the chips follow the camera spline instead of a
  // fixed tower grid. The radius is generous because the helix spaces chips
  // further apart than the old two-row layout did.
  const skillZones = useMemo<SkillZone[]>(
    () =>
      SKILL_LAYOUT.map((l, i) => ({
        index: i,
        position: l.position,
        radius: 7.5,
        name: l.skill.name,
      })),
    [],
  );

  const hero = useSectionActive('hero') || forceAll;
  const about = useSectionActive('about') || forceAll;
  const skillsOn = useSectionActive('skills') || forceAll;
  const exp = useSectionActive('experience') || forceAll;
  const proj = useSectionActive('projects') || forceAll;
  const contact = useSectionActive('contact') || forceAll;

  return (
    <>
      <RainDriver />
      {/*
        rMax is tuned to the PATH LENGTH, not picked for looks. The shell is a
        tube of volume pi*r^2*length around a ~394-unit journey; at r=46 the
        same instance budget is spread over ~5x the volume of a single room and
        the rain reads as empty drizzle. r=20 puts the density back where the
        Phase-1 bench measured it, and everything beyond it is outside the
        shader's far-fade anyway.
      */}
      <DigitalRain
        maxInstances={tier.instances}
        curve={J.pos}
        rMin={2.0}
        rMax={20}
        skillZones={skillZones}
      />
      {/* A sparser, wider shell so the far field is never empty. Kept inside
          the shader's far-fade range, or it would be culled to nothing. */}
      {tier.ambientRain && (
        <DigitalRain
          maxInstances={Math.floor(tier.instances * 0.25)}
          curve={J.pos}
          rMin={20}
          rMax={46}
          forceLayer={2}
        />
      )}

      {hero && <HeroSection formationCount={tier.heroFormation} />}
      {about && <AboutSection />}
      {skillsOn && <SkillsSection />}
      {exp && <ExperienceSection />}
      {proj && <ProjectsSection />}
      {contact && <ContactSection formationCount={tier.heroFormation} />}
    </>
  );
}
