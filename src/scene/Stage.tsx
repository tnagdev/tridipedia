import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Preload } from '@react-three/drei';
import * as THREE from 'three';
import { FrameDriver } from './FrameDriver';
import { CameraRig } from '@/camera/CameraRig';
import { World } from './World';
import { Effects } from './Effects';
import { QualityMonitor } from '@/perf/QualityProvider';
import { TIER_SPECS, demote, tierOverride, type TierName } from '@/perf/tier';
import { PALETTE } from '@/text/palette';
import { setUi } from '@/state/store';
import { WarmUp } from './WarmUp';
import { PerfHud, PERF_ENABLED } from '@/dev/PerfHud';
import { Nav3D } from './Nav3D';

const DEV_FORCE_SIZE = import.meta.env.DEV && typeof location !== 'undefined'
  && new URLSearchParams(location.search).has('forceraf');
const DevForceSize = DEV_FORCE_SIZE
  ? (await import('@/dev/DevForceSize')).DevForceSize
  : () => null;

export function Stage({
  ceiling,
  reducedMotion,
  avatarSrc,
  onReady,
}: {
  ceiling: TierName;
  reducedMotion: boolean;
  avatarSrc: string | null;
  onReady: () => void;
}) {
  const [tierName, setTierName] = useState<TierName>(reducedMotion ? 'REDUCED' : ceiling);
  useEffect(() => setTierName(reducedMotion ? 'REDUCED' : ceiling), [ceiling, reducedMotion]);

  const tier = TIER_SPECS[tierName];
  const pinned = tierOverride();
  const handleDemote = useCallback(() => {
    if (pinned) return; // a pinned tier must not drift, or captures are meaningless
    setTierName((t) => demote(t));
  }, [pinned]);

  // Stage owns the authoritative tier, so it must publish it. Without this the
  // store reports whatever it was initialised with, which is worse than useless.
  useEffect(() => { setUi({ tier: tierName }); }, [tierName]);

  return (
    <Canvas
      aria-hidden="true"
      role="presentation"
      tabIndex={-1}
      // Hard-cap DPR at 2 regardless of device: a DPR-3 phone rendering tens of
      // thousands of additive quads plus a bloom mip chain thermal-throttles
      // within about 20 seconds.
      dpr={tier.dpr}
      frameloop="always"
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        // Tone mapping happens once at the end of the composer instead, so the
        // rain's heads can sit above 1.0 and trip the bloom threshold.
        toneMapping: THREE.NoToneMapping,
        alpha: false,
        stencil: false,
        depth: true,
        // Only in dev: without this the drawing buffer is cleared before
        // toDataURL can read it, so verification screenshots come out blank.
        preserveDrawingBuffer: import.meta.env.DEV,
      }}
      camera={{ fov: 68, near: 0.1, far: 420, position: [0, 2, 22] }}
      style={{ position: 'fixed', inset: 0, zIndex: 1 }}
      onCreated={(state) => {
        const { gl } = state;
        // Dev-only handle for inspecting the scene graph and renderer stats.
        if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__r3f = state;
        gl.domElement.addEventListener(
          'webglcontextlost',
          (e) => {
            e.preventDefault();
            // Fall back to Text Mode rather than showing a black screen.
            setUi({ webglFailed: true, textMode: true });
          },
          { passive: false },
        );
      }}
    >
      {DEV_FORCE_SIZE && <DevForceSize />}
      {PERF_ENABLED && <PerfHud />}
      <FrameDriver reducedMotion={reducedMotion} />
      <CameraRig reducedMotion={reducedMotion} />

      <color attach="background" args={[PALETTE.bg]} />
      <fog attach="fog" args={[PALETTE.bg, 34, 150]} />

      <Suspense fallback={null}>
        <World tier={tier} avatarSrc={avatarSrc} />
        <Nav3D />
        <WarmUp tier={tier} avatarSrc={avatarSrc} onReady={onReady} />
        <Preload all />
      </Suspense>

      <AdaptiveDpr pixelated />
      <QualityMonitor onDemote={handleDemote} />
      <Effects tier={tier} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
