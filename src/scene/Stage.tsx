import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Preload } from '@react-three/drei';
import * as THREE from 'three';
import { FrameDriver } from './FrameDriver';
import { CameraRig } from '@/camera/CameraRig';
import { World } from './World';
import { Effects } from './Effects';
import { QualityMonitor } from '@/perf/QualityProvider';
import { demote, promote, resolveTier, tierOverride, type TierName } from '@/perf/tier';
import { PALETTE } from '@/text/palette';
import { getUi, setUi } from '@/state/store';
import { WarmUp } from './WarmUp';
import { PerfHud, PERF_ENABLED } from '@/dev/PerfHud';
import { Nav3D } from './Nav3D';

const DEV_FORCE_SIZE = import.meta.env.DEV && typeof location !== 'undefined'
  && (new URLSearchParams(location.search).has('forceraf')
    || new URLSearchParams(location.search).has('forcesize')
    || new URLSearchParams(location.search).has('portrait'));
const DevForceSize = DEV_FORCE_SIZE
  ? (await import('@/dev/DevForceSize')).DevForceSize
  : () => null;

export function Stage({
  ceiling,
  reducedMotion,
  onReady,
}: {
  ceiling: TierName;
  reducedMotion: boolean;
  onReady: () => void;
}) {
  const [tierName, setTierName] = useState<TierName>(reducedMotion ? 'REDUCED' : ceiling);
  useEffect(() => setTierName(reducedMotion ? 'REDUCED' : ceiling), [ceiling, reducedMotion]);

  // resolveTier, not TIER_SPECS: the named tier is a quality LEVEL, and what a
  // device actually runs depends on how many pixels its screen asks for.
  const tier = useMemo(() => resolveTier(tierName), [tierName]);
  const pinned = tierOverride();
  const handleDemote = useCallback(() => {
    if (pinned) return; // a pinned tier must not drift, or captures are meaningless
    setTierName((t) => demote(t));
  }, [pinned]);
  const handlePromote = useCallback(() => {
    // Never past the tier boot measured, and never out of reduced motion, which
    // is a stated preference rather than a performance verdict.
    if (pinned || reducedMotion) return;
    setTierName((t) => promote(t, ceiling));
  }, [pinned, reducedMotion, ceiling]);

  // Stage owns the authoritative tier, so it must publish it. Without this the
  // store reports whatever it was initialised with, which is worse than useless.
  useEffect(() => { setUi({ tier: tierName }); }, [tierName]);

  return (
    <Canvas
      aria-hidden="true"
      role="presentation"
      tabIndex={-1}
      // Resolved per device from the tier's pixel budget, and hard-capped at 2:
      // a DPR-3 phone rendering tens of thousands of additive quads plus a bloom
      // mip chain at native resolution thermal-throttles within about 20 seconds.
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
            /**
             * OUR OWN TEARDOWN FIRES THIS TOO.
             *
             * Switching to Text Mode unmounts the Canvas, and R3F disposes a
             * renderer by calling forceContextLoss() — which dispatches a real
             * webglcontextlost on a perfectly healthy context. Treating that as
             * a hardware failure latched webglFailed on, and since the toggle
             * hides itself when 3D cannot run, the "3D MODE" button vanished
             * and the reader was stranded in Text Mode with no way back.
             *
             * Text Mode being on already is what tells the two apart: it is the
             * cause of a deliberate teardown, and cannot be the case for a
             * driver loss while the journey is on screen.
             */
            if (getUi().textMode) return;
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
        <World tier={tier} />
        <Nav3D />
        <WarmUp tier={tier} onReady={onReady} />
        <Preload all />
      </Suspense>

      {/**
        * NOT `pixelated`. That prop sets `image-rendering: pixelated` on the
        * canvas whenever performance regresses, which turns the browser's
        * smooth upscale into nearest-neighbour blocks — the single most
        * visible way this scene can look cheap, and on a phone the upscale
        * factor is large enough that it reads as a resolution failure.
        * Bilinear softness is the better half of that trade.
        */}
      <AdaptiveDpr />
      <QualityMonitor onDemote={handleDemote} onPromote={handlePromote} />
      <Effects tier={tier} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
