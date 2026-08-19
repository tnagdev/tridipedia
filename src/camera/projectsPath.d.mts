/**
 * Types for projectsPath.mjs, which is plain JS so that Node's check script and
 * the app can share one implementation. See the header there for why.
 */
import type { CameraKeyframe, SectionConfig, SiteContent } from '@/content/content.types';

export declare const WALL: {
  readonly z: number;
  readonly y: number;
  readonly gap: number;
  readonly frameW: number;
  readonly frameH: number;
};

export declare function projectX(i: number, n: number): number;

/** Scroll window in which the camera is parked square-on to one project. */
export interface ProjectHold {
  index: number;
  x: number;
  from: number;
  to: number;
}

export interface ProjectsJourney {
  keyframes: CameraKeyframe[];
  sections: SectionConfig[];
  scrollHeightVh: number;
  holds: ProjectHold[];
}

export declare function buildProjectsJourney(
  site: Pick<SiteContent, 'journey' | 'sections'>,
  count: number,
): ProjectsJourney;

export declare function projectTextZones(
  count: number,
): [number, number, number, number][];
