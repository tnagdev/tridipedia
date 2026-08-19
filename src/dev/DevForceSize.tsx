import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { setUi } from '@/state/store';

/**
 * Dev-only sizing overrides.
 *
 * Two jobs, both about making the site verifiable without a device:
 *
 * 1. `?forceraf=1` — ResizeObserver does not deliver callbacks while a document
 *    is hidden, so R3F never measures the canvas and it stays at the 300x150
 *    default. Measure the container on an interval instead.
 *
 * 2. `?forcesize=390x844` — force an exact canvas size, so a portrait frustum
 *    can be driven inside an ordinary desktop window. Pair it with
 *    `?portrait=1`, because matchMedia still reports landscape in that window
 *    and state/viewport.ts would otherwise overrule the layout.
 */

function forcedSize(): [number, number] | null {
  const q = new URLSearchParams(location.search).get('forcesize');
  const m = q && /^(\d+)x(\d+)$/.exec(q);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 1 && h > 1 ? [w, h] : null;
}

export function DevForceSize() {
  const setSize = useThree((s) => s.setSize);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const forced = forcedSize();

    /**
     * A forced size is a claim about the frustum, not about the window, so the
     * orientation has to be forced with it or Nav3D would draw the desktop rail
     * into a portrait canvas. `?portrait=0` forces the other way, for checking
     * that the landscape path is untouched at a phone-shaped size.
     */
    const p = new URLSearchParams(location.search).get('portrait');
    if (p !== null) setUi({ portrait: p !== '0' });
    else if (forced) setUi({ portrait: forced[1] > forced[0] });

    const apply = () => {
      if (forced) {
        setSize(forced[0], forced[1]);
        return;
      }
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
