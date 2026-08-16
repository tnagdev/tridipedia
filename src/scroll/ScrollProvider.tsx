import { useEffect } from 'react';
import Lenis from 'lenis';
import { journey } from '@/content/loadContent';
import { F } from '@/state/frameState';

let lenisInstance: Lenis | null = null;

function scrollLimit(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/**
 * Reads native scroll into the frame state.
 *
 * This is the SOURCE OF TRUTH, deliberately independent of Lenis. Driving
 * F.raw only from Lenis's own event means that if Lenis fails to construct,
 * gets torn down by a StrictMode/HMR cleanup, or is destroyed on unmount, the
 * entire site silently freezes: scrolling does nothing and the camera stays
 * pinned to the hero forever. Lenis smooths the *input*; it must never be the
 * only thing that reports where we are.
 */
function readScroll() {
  const limit = scrollLimit();
  F.raw = limit > 0 ? Math.min(1, Math.max(0, window.scrollY / limit)) : 0;
}

/** All programmatic scrolling MUST go through this, or it fights Lenis. */
export function scrollToProgress(t: number, opts?: { immediate?: boolean; duration?: number }) {
  const target = Math.max(0, Math.min(1, t)) * scrollLimit();
  if (lenisInstance) {
    lenisInstance.scrollTo(target, { duration: opts?.duration ?? 2.2, immediate: opts?.immediate });
  } else {
    window.scrollTo({ top: target, behavior: opts?.immediate ? 'auto' : 'smooth' });
  }
  // Update immediately as well: a smooth scroll emits events as it goes, but an
  // immediate one may not, and we must never be left reporting a stale position.
  if (opts?.immediate) requestAnimationFrame(readScroll);
}

export function getLenis() {
  return lenisInstance;
}

/**
 * Native scroll with a tall spacer, wrapped in Lenis.
 *
 * Native (not virtual) scroll keeps the real scrollbar, trackpad inertia,
 * PgDn/Home/End, touch fling, deep links and screen-reader scroll position for
 * free. Lenis only fixes the one thing native scroll is bad at: stepped
 * mouse-wheel on Windows.
 */
export function ScrollProvider({ children, enabled = true }: { children?: React.ReactNode; enabled?: boolean }) {
  // The scroll reader runs regardless of Lenis, and regardless of `enabled`.
  useEffect(() => {
    readScroll();
    window.addEventListener('scroll', readScroll, { passive: true });
    window.addEventListener('resize', readScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', readScroll);
      window.removeEventListener('resize', readScroll);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let lenis: Lenis;
    try {
      lenis = new Lenis({ duration: 1.1, smoothWheel: true, syncTouch: false });
    } catch {
      return; // native scroll already drives everything; smoothing is a bonus
    }
    lenisInstance = lenis;

    let id = requestAnimationFrame(function raf(time: number) {
      lenis.raf(time);
      readScroll();
      id = requestAnimationFrame(raf);
    });

    // Resolve a deep link (#skills) once the spacer height is real.
    const hash = window.location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() => {
        void import('@/state/sections').then(({ SECTIONS }) => {
          const s = SECTIONS.find((x) => x.id === hash);
          if (s) scrollToProgress(s.range[0] + 0.01, { immediate: true });
        });
      });
    }

    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
      // Only clear the singleton if it is still OURS. A StrictMode or HMR
      // cleanup running after a newer instance mounted would otherwise null out
      // the live one and silently disable programmatic scrolling.
      if (lenisInstance === lenis) lenisInstance = null;
    };
  }, [enabled]);

  return (
    <>
      <div aria-hidden="true" style={{ height: `${journey.scrollHeightVh}vh`, pointerEvents: 'none' }} />
      {children}
    </>
  );
}
