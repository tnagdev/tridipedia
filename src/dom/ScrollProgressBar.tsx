import { useEffect, useRef } from 'react';
import { F } from '@/state/frameState';

/** Reads frameState directly in a rAF loop — never a React render. */
export function ScrollProgressBar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = requestAnimationFrame(function tick() {
      const el = ref.current;
      if (el) el.style.transform = `scaleX(${F.smooth}) translateZ(0)`;
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return <div ref={ref} className="scroll-progress" style={{ width: '100%' }} aria-hidden="true" />;
}
