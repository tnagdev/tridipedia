import { useRef } from 'react';
import { PerformanceMonitor } from '@react-three/drei';

/**
 * Runtime demotion only — the detected tier is a ceiling that is never exceeded.
 *
 * Debounced, because a transient dip (a section mounting, a GC pause, a
 * backgrounded tab) would otherwise cascade several tiers in a second and
 * permanently strand the user on a much poorer version of the site.
 */
export function QualityMonitor({ onDemote }: { onDemote: () => void }) {
  const last = useRef(0);
  const fire = () => {
    const now = performance.now();
    if (now - last.current < 1500) return;
    last.current = now;
    onDemote();
  };
  return <PerformanceMonitor bounds={() => [50, 60]} flipflops={3} onDecline={fire} onFallback={fire} />;
}
