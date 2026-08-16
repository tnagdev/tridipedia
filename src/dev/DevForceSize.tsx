import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Dev-only. ResizeObserver does not deliver callbacks while a document is
 * hidden, so R3F never measures the canvas and it stays at the 300x150
 * default. That makes the site impossible to verify in a background window.
 * Forces the size from the container so `?forceraf=1` captures are real.
 */
export function DevForceSize() {
  const setSize = useThree((s) => s.setSize);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const apply = () => {
      const parent = gl.domElement.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
      if (w > 1 && h > 1) setSize(w, h);
    };
    apply();
    const id = setInterval(apply, 500);
    window.addEventListener('resize', apply);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', apply);
    };
  }, [setSize, gl]);

  return null;
}
