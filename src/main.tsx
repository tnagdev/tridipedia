/**
 * Dev-only: browsers pause requestAnimationFrame while a tab is hidden, which
 * makes the site impossible to drive or capture in a headless/background
 * window. `?forceraf=1` swaps rAF for a setTimeout pump so the real app can be
 * rendered and screenshotted for verification. Never active in a build.
 */
if (import.meta.env.DEV && new URLSearchParams(location.search).has('forceraf')) {
  let t = 0;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    window.setTimeout(() => cb((t += 16.67)), 16) as unknown as number) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/base.css';
import './styles/dom.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.DEV) {
  // Capture the live canvas to the dev capture sink. Used for visual checks.
  (window as unknown as { __shot: (name: string) => Promise<unknown> }).__shot = async (name: string) => {
    const c = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!c) return { ok: false, error: 'no canvas' };
    const out = document.createElement('canvas');
    const scale = Math.min(1, 900 / c.width);
    out.width = Math.round(c.width * scale);
    out.height = Math.round(c.height * scale);
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#000804';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(c, 0, 0, out.width, out.height);
    const dataUrl = out.toDataURL('image/jpeg', 0.75);
    const res = await fetch('/__capture', { method: 'POST', body: JSON.stringify({ name, dataUrl }) });
    return res.json();
  };
}
