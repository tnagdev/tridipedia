import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ScrollProvider } from '@/scroll/ScrollProvider';
/**
 * Lazy: the whole three.js + drei + postprocessing graph is ~314KB gzipped.
 * Text Mode users, no-WebGL users and crawlers should never pay for it.
 */
const Stage = lazy(() => import('@/scene/Stage').then((m) => ({ default: m.Stage })));
import { SrNav } from '@/dom/SrNav';
import { A11yLayer } from '@/dom/A11yLayer';
import { SiteContentDom } from '@/dom/SiteContentDom';
import { SeoJsonLd } from '@/dom/SeoJsonLd';
import { TextMode, TextModeToggle, readStoredTextMode, setTextMode } from '@/dom/TextMode';
import { ScrollProgressBar } from '@/dom/ScrollProgressBar';
import { ReducedMotionChip } from '@/dom/ReducedMotionChip';
import { useReducedMotion } from '@/perf/useReducedMotion';
import { hasWebGL2, type TierName } from '@/perf/tier';
import { boot, finishLoader } from '@/scene/boot';
import { getUi, setUi, useUi } from '@/state/store';

export function App() {
  const reducedMotion = useReducedMotion();
  const textMode = useUi((s) => s.textMode);
  const webglFailed = useUi((s) => s.webglFailed);
  const [ceiling, setCeiling] = useState<TierName | null>(null);

  // Restore the stored preference, and force text mode when WebGL2 is missing.
  useEffect(() => {
    const noWebgl = !hasWebGL2();
    if (noWebgl) setUi({ webglFailed: true, textMode: true });
    else if (readStoredTextMode()) setTextMode(true);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!hasWebGL2()) {
      finishLoader();
      return;
    }
    boot().then((r) => {
      if (!alive) return;
      setCeiling(r.tier);
    });
    return () => { alive = false; };
  }, []);

  /**
   * Text Mode never mounts <Stage />, so onReady never fires and the loader —
   * a fixed, opaque, z-index 9999 overlay — sat over the page until the 8s
   * watchdog, hiding the "3D MODE" button along with everything else. Anyone
   * whose stored preference is Text Mode hit this on every reload.
   */
  useEffect(() => {
    if (textMode || webglFailed) finishLoader();
  }, [textMode, webglFailed]);

  const onReady = useCallback(() => {
    setUi({ ready: true });
    finishLoader();
  }, []);

  /**
   * Watchdog. The reveal depends on compileAsync plus a rendered frame; if
   * either stalls — a backgrounded tab, a driver hang, a device that never
   * fires rAF — the user would sit on the loader forever with a fully working
   * site behind it. Reveal anyway after 8s.
   */
  useEffect(() => {
    const t = setTimeout(() => {
      if (!getUi().ready) {
        setUi({ ready: true });
        finishLoader();
      }
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  const show3d = !textMode && !webglFailed;

  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <SeoJsonLd />
      <TextModeToggle />

      {textMode || webglFailed ? (
        <TextMode />
      ) : (
        <>
          {/* Always in the DOM: this is the screen-reader experience and the
              crawler-visible content, present while JS is running. */}
          <SiteContentDom />
          <A11yLayer />
          <SrNav />
          <ScrollProgressBar />
          <ReducedMotionChip />
          <ScrollProvider enabled={show3d}>
            {ceiling && (
              <Suspense fallback={null}>
                <Stage
                  ceiling={ceiling}
                  reducedMotion={reducedMotion}
                  onReady={onReady}
                />
              </Suspense>
            )}
          </ScrollProvider>
        </>
      )}
    </>
  );
}
