import { runBench } from './bench';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const out = document.getElementById('out')!;
const env = document.getElementById('env')!;

const probe = document.createElement('canvas').getContext('webgl2');
const dbg = probe?.getExtension('WEBGL_debug_renderer_info');
env.textContent =
  `GPU: ${probe && dbg ? probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown'} · ` +
  `dpr ${devicePixelRatio} · cores ${navigator.hardwareConcurrency ?? '?'} · ` +
  `${matchMedia('(pointer: coarse)').matches ? 'touch' : 'pointer'}`;

/**
 * The Phase-1 gate. Budgets: 16.7ms (60fps) for desktop tiers,
 * 33.3ms (30fps) for the mobile tiers.
 */
const CASES = [
  { label: 'ULTRA  90k @dpr2.0', instances: 90_000, width: 3840, height: 2160, budget: 16.7 },
  { label: 'ULTRA  90k @dpr1.5', instances: 90_000, width: 2880, height: 1620, budget: 16.7 },
  { label: 'HIGH   60k @dpr1.5', instances: 60_000, width: 2880, height: 1620, budget: 16.7 },
  { label: 'HIGH   60k @dpr1.0', instances: 60_000, width: 1920, height: 1080, budget: 16.7 },
  { label: 'MID    24k @dpr1.0', instances: 24_000, width: 1920, height: 1080, budget: 33.3 },
  { label: 'MID    24k @720p', instances: 24_000, width: 1280, height: 720, budget: 33.3 },
  { label: 'LOW     8k @720p', instances: 8_000, width: 1280, height: 720, budget: 33.3 },
];

const rows: string[] = [];

function render(done = false) {
  out.innerHTML =
    `<table><tr><th>tier / case</th><th>frame</th><th>budget</th><th>coverage</th><th></th></tr>${rows.join('')}</table>` +
    (done
      ? `<p style="opacity:.65;max-width:60ch;line-height:1.5">Coverage is the share of pixels the rain actually lit. A fast frame with ~0% coverage is an empty frame, not a pass. Compare the two 60k rows: if frame time tracks pixel count the rain is fill-bound and the fix is glyphSize / nearFade / density — if it tracks instance count instead, the fix is instance count.</p>`
      : '');
}

function run() {
  // Yield between cases so the page can paint each row as it lands.
  let i = 0;
  const step = () => {
    if (i >= CASES.length) return render(true);
    const c = CASES[i++];
    try {
      const r = runBench(canvas, { instances: c.instances, width: c.width, height: c.height, frames: 30 });
      const ok = r.msPerFrame <= c.budget;
      rows.push(
        `<tr><td>${c.label}</td><td>${r.msPerFrame.toFixed(2)} ms</td>` +
          `<td>${Math.round((r.msPerFrame / c.budget) * 100)}%</td>` +
          `<td>${r.coverage.toFixed(2)}%</td>` +
          `<td class="${ok ? 'pass' : 'fail'}">${ok ? 'PASS' : 'FAIL'}</td></tr>`,
      );
    } catch (e) {
      rows.push(`<tr><td>${c.label}</td><td colspan="4" class="fail">${(e as Error).message}</td></tr>`);
    }
    render();
    setTimeout(step, 16);
  };
  step();
}

run();
