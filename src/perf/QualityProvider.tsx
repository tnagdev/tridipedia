import { useRef } from 'react';
import { PerformanceMonitor } from '@react-three/drei';

/**
 * Runtime quality, in BOTH directions — the detected tier is a ceiling that is
 * never exceeded, but a tier lost to a rough patch can be won back.
 *
 * Demotion used to be one-way, so a few seconds of jitter permanently stranded
 * the user on a poorer version of the site with no way back. It also fired far
 * too readily: the lower bound sat at 50fps, and on a 60Hz display an ordinary
 * 17.5ms frame reads as 57 — inside the band, "declining", and three flip-flops
 * later the tier dropped on a machine that was keeping up fine.
 *
 * Both directions are debounced, and recovery waits much longer than demotion,
 * so the tier settles instead of oscillating between two levels.
 */
export function QualityMonitor({
  onDemote,
  onPromote,
}: {
  onDemote: () => void;
  onPromote: () => void;
}) {
  const lastDown = useRef(0);
  const lastUp = useRef(0);

  const down = () => {
    const now = performance.now();
    if (now - lastDown.current < 1500) return;
    lastDown.current = now;
    // Block recovery for a while after a drop, or the two fight each other.
    lastUp.current = now;
    onDemote();
  };

  const up = () => {
    const now = performance.now();
    if (now - lastUp.current < 9000) return;
    lastUp.current = now;
    onPromote();
  };

  return (
    <PerformanceMonitor
      bounds={() => [40, 58]}
      flipflops={4}
      onDecline={down}
      onFallback={down}
      onIncline={up}
    />
  );
}
