import { useState } from 'react';
import { useReducedMotion } from '@/perf/useReducedMotion';
import { setTextMode } from './TextMode';

/**
 * Reduced motion does NOT force text mode — it offers it. The 3D view still
 * runs, with the rain slowed to a shimmer and the camera snapping between
 * anchors instead of flying.
 */
export function ReducedMotionChip() {
  const reduced = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);
  if (!reduced || dismissed) return null;
  return (
    <div className="reduced-chip" role="status">
      <span>Reduced motion is on. Motion here is minimised — a plain text version is also available.</span>
      <button type="button" onClick={() => setTextMode(true)}>
        Text mode
      </button>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
