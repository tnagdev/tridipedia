import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { F } from '@/state/frameState';
import { getUi } from '@/state/store';

export const PERF_ENABLED =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');

/**
 * Lightweight perf HUD, enabled with `?perf=1`.
 *
 * Replaces r3f-perf, which was pulled out of the bundle. Everything here is
 * written straight to a DOM node from inside useFrame — no React state, so the
 * HUD cannot itself perturb what it is measuring.
 *
 * Also installs `window.__perfProbe()`, which GPU-times the scene render at
 * several MSAA levels. That matters because frame pacing tells you almost
 * nothing on its own: a vsync-capped or rAF-shimmed page reports a flat 60fps
 * whatever the GPU is doing. The probe uses finish() to get real work times.
 */
export function PerfHud() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const elRef = useRef<HTMLDivElement | null>(null);
  const acc = useRef({ n: 0, sum: 0, worst: 0, last: 0 });

  useEffect(() => {
    const el = document.createElement('div');
    el.className = 'perf-hud';
    document.body.appendChild(el);
    elRef.current = el;

    (window as unknown as Record<string, unknown>).__perfProbe = () => {
      const ctx = gl.getContext();
      const W = gl.domElement.width;
      const H = gl.domElement.height;
      const time = (fn: () => void, n: number) => {
        fn();
        ctx.finish();
        const t0 = performance.now();
        for (let i = 0; i < n; i++) fn();
        ctx.finish();
        return +((performance.now() - t0) / n).toFixed(3);
      };

      const results: Record<string, unknown> = { size: [W, H], dpr: +window.devicePixelRatio.toFixed(2) };
      results.sceneToScreen = time(() => {
        gl.setRenderTarget(null);
        gl.render(scene, camera);
      }, 15);

      for (const samples of [0, 2, 4]) {
        const rt = new THREE.WebGLRenderTarget(W, H, { samples });
        results[`sceneToRT_msaa${samples}`] = time(() => {
          gl.setRenderTarget(rt);
          gl.render(scene, camera);
          gl.setRenderTarget(null);
        }, 15);
        rt.dispose();
      }

      let meshes = 0;
      let texts = 0;
      let rainInstances = 0;
      scene.traverse((o) => {
        const m = o as THREE.Mesh & { text?: string };
        if (o.type !== 'Mesh') return;
        meshes++;
        if (m.text) texts++;
        const ic = (m.geometry as THREE.InstancedBufferGeometry)?.instanceCount ?? 0;
        if (ic > 500) rainInstances += ic;
      });
      Object.assign(results, {
        meshes,
        texts,
        rainInstances,
        calls: gl.info.render.calls,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
      });
      return results;
    };

    return () => {
      el.remove();
      delete (window as unknown as Record<string, unknown>).__perfProbe;
    };
  }, [gl, scene, camera]);

  useFrame((_, delta) => {
    const a = acc.current;
    const ms = delta * 1000;
    a.n++;
    a.sum += ms;
    if (ms > a.worst) a.worst = ms;

    const now = performance.now();
    if (now - a.last < 400) return; // repaint the HUD ~2.5x/sec, not every frame
    a.last = now;

    const avg = a.sum / Math.max(1, a.n);
    const el = elRef.current;
    if (el) {
      const r = gl.info.render;
      el.textContent =
        `${(1000 / avg).toFixed(0)} fps   ${avg.toFixed(2)} ms   peak ${a.worst.toFixed(1)} ms\n` +
        `calls ${r.calls}   tris ${(r.triangles / 1000).toFixed(0)}k   progs ${gl.info.programs?.length ?? 0}\n` +
        `tier ${getUi().tier}   dpr ${gl.getPixelRatio().toFixed(2)}   ${gl.domElement.width}x${gl.domElement.height}\n` +
        `t ${F.smooth.toFixed(3)}   vel ${F.velocity.toFixed(3)}   sec ${F.section}`;
    }
    a.n = 0;
    a.sum = 0;
    a.worst = 0;
  });

  return null;
}
