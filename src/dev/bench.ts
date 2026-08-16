/**
 * Rain performance gate.
 *
 * Renders the REAL rain shader with the REAL instance buffers into an FBO and
 * times it with a readPixels sync. No React, no compositor, no rAF throttling —
 * so the number it prints is the GPU cost of the rain and nothing else.
 *
 * IMPORTANT: this measures the PRODUCTION distribution — the spline shell
 * around the camera journey, viewed from a real camera position on that
 * journey. The earlier version built a box around the origin, which stopped
 * matching what the site renders the moment the shell radius changed, and so
 * kept reporting healthy numbers for a configuration that no longer existed.
 * Whatever this file measures must stay in sync with World.tsx.
 *
 * Open /bench.html on any device (laptop, phone) to run the gate there.
 */
import * as THREE from 'three';
import vertSrc from '@/rain/rain.vert.glsl?raw';
import fragSrc from '@/rain/rain.frag.glsl?raw';
import { buildGlyphAtlas, ATLAS_COLS, ATLAS_SIZE, GLYPH_COUNT } from '@/rain/glyphAtlas';
import { buildRainAttributes } from '@/rain/buildRainAttributes';
import { CELL_H, COLUMN_H, SLOTS } from '@/rain/rainConfig';
import { QUAD_POSITIONS, QUAD_UVS } from '@/rain/quad';
import { J } from '@/camera/journey';
import { sampleTrack } from '@/camera/tracks';
import { journey } from '@/content/loadContent';

function compile(gl: WebGL2RenderingContext) {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, '#version 300 es\n' + src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'compile fail');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link fail');
  return p;
}

export interface BenchOptions {
  instances: number;
  width: number;
  height: number;
  frames?: number;
  glyphSize?: number;
  /** Journey position to view from. Defaults to the densest part of the ride. */
  t?: number;
  rMin?: number;
  rMax?: number;
  /** Shader near-fade band. The highest-leverage fill control. */
  nearFade?: [number, number];
  density?: number;
  capture?: boolean;
}

export interface BenchResult {
  instances: number;
  width: number;
  height: number;
  msPerFrame: number;
  fps: number;
  /** % of pixels with any rain on them. A fast EMPTY frame is not a pass. */
  coverage: number;
  /** % of pixels at head brightness — these are what bloom will pick up. */
  brightCoverage: number;
  /** Mean additive overdraw estimate: total emitted luminance / pixel count. */
  overdraw: number;
  capture?: string;
}

/** Camera basis at a point on the real journey. */
function cameraAt(t: number, aspect: number) {
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  J.pos.getPoint(J.remap(t), pos);
  J.look.getPoint(J.remap(Math.min(t + journey.lookAhead, 1)), look);

  const cam = new THREE.PerspectiveCamera(sampleTrack(J.fov, t), aspect, 0.1, 420);
  cam.position.copy(pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(look);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  return { cam, pos };
}

export function runBench(canvas: HTMLCanvasElement, opts: BenchOptions): BenchResult {
  const frames = opts.frames ?? 40;
  const t = opts.t ?? 0.5;
  const rMin = opts.rMin ?? 2.0;
  const rMax = opts.rMax ?? 20;
  const nearFade = opts.nearFade ?? [1.2, 4.5];

  canvas.width = opts.width;
  canvas.height = opts.height;

  const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' })!;
  const prog = compile(gl);
  gl.useProgram(prog);
  gl.viewport(0, 0, opts.width, opts.height);

  // Render into an explicit FBO, not the default framebuffer. A canvas that is
  // never presented lets the driver discard the draws entirely — which silently
  // produces 0ms "results". An FBO we then readPixels from cannot be skipped.
  const fbo = gl.createFramebuffer()!;
  const rbo = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, opts.width, opts.height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbo);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplete');

  // --- geometry: the production spline shell, not a box ---
  const attrs = buildRainAttributes({ maxInstances: opts.instances, curve: J.pos, rMin, rMax });

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buffers: WebGLBuffer[] = [];
  const bind = (name: string, data: Float32Array, size: number, divisor: number) => {
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) return;
    const b = gl.createBuffer()!;
    buffers.push(b);
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(loc, divisor);
  };
  bind('position', QUAD_POSITIONS, 3, 0);
  bind('uv', QUAD_UVS, 2, 0);
  bind('aOrigin', attrs.aOrigin.array as Float32Array, 3, 1);
  bind('aParams', attrs.aParams.array as Float32Array, 4, 1);
  bind('aRand', attrs.aRand.array as Float32Array, 4, 1);
  bind('aMeta', attrs.aMeta.array as Float32Array, 2, 1);

  // --- atlas ---
  const atlas = buildGlyphAtlas();
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, ATLAS_SIZE, ATLAS_SIZE, 0, gl.RED, gl.UNSIGNED_BYTE, atlas.image.data as Uint8Array);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // --- real camera on the journey ---
  const { cam, pos } = cameraAt(t, opts.width / opts.height);
  const view = cam.matrixWorldInverse;

  const U = (n: string) => gl.getUniformLocation(prog, n);
  gl.uniformMatrix4fv(U('projectionMatrix'), false, cam.projectionMatrix.elements);
  gl.uniformMatrix4fv(U('modelViewMatrix'), false, view.elements);
  gl.uniform1i(U('uAtlas'), 0);
  gl.uniform1f(U('uCellH'), CELL_H);
  gl.uniform1f(U('uColumnH'), COLUMN_H);
  gl.uniform1f(U('uSlots'), SLOTS);
  gl.uniform1f(U('uAtlasCols'), ATLAS_COLS);
  gl.uniform1f(U('uGlyphCount'), GLYPH_COUNT);
  gl.uniform1f(U('uGlyphSize'), opts.glyphSize ?? 0.55);
  gl.uniform1f(U('uSpeed'), 1);
  gl.uniform1f(U('uDensity'), opts.density ?? 1);
  gl.uniform1f(U('uIntensity'), 1);
  gl.uniform1f(U('uScrollVel'), 0);
  gl.uniform1f(U('uOpen'), 0);
  gl.uniform1f(U('uConverge'), 0);
  gl.uniform1f(U('uLock'), 0);
  gl.uniform1f(U('uTint'), 0);
  gl.uniform1f(U('uBillboardLock'), 0);
  gl.uniform3f(U('uCamPos'), pos.x, pos.y, pos.z);
  gl.uniform3f(U('uFlowDir'), 0, -1, 0);
  gl.uniform3f(U('uConvergePoint'), 0, 58, -366);
  gl.uniform4fv(U('uZones[0]'), new Float32Array(16));
  gl.uniform2f(U('uNearFade'), nearFade[0], nearFade[1]);
  gl.uniform2f(U('uFarFade'), 55, 95);
  gl.uniform3f(U('uTailColor'), 0, 0.85, 0.25);
  gl.uniform3f(U('uHeadColor'), 0.85, 1, 0.9);
  gl.uniform3fv(U('uSkillColors[0]'), new Float32Array(27).fill(1));

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive
  gl.depthMask(false);
  gl.disable(gl.DEPTH_TEST);

  const uTime = U('uTime');
  const px = new Uint8Array(4);
  const sync = () => gl.readPixels(opts.width >> 1, opts.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

  // Warm up: the first frames include driver-side program and pipeline setup.
  for (let i = 0; i < 8; i++) {
    gl.uniform1f(uTime, i * 0.016);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, opts.instances);
  }
  sync();

  // Measure real coverage. A point probe is the wrong instrument here — Matrix
  // rain is legitimately sparse, so scattered samples miss it and an empty
  // frame would masquerade as a fast one. Read the whole buffer once.
  const full = new Uint8Array(opts.width * opts.height * 4);
  gl.readPixels(0, 0, opts.width, opts.height, gl.RGBA, gl.UNSIGNED_BYTE, full);
  let lit = 0;
  let bright = 0;
  let sum = 0;
  for (let i = 0; i < full.length; i += 4) {
    const g = full[i + 1];
    sum += g;
    if (g > 6) lit++;
    if (g > 120) bright++;
  }
  const totalPx = opts.width * opts.height;
  const coverage = +((lit / totalPx) * 100).toFixed(2);
  const brightCoverage = +((bright / totalPx) * 100).toFixed(3);
  // Additive blending saturates, so this under-reports heavy overlap — but it
  // still tracks the direction of overdraw, which is what we tune against.
  const overdraw = +(sum / totalPx / 255).toFixed(3);

  let capture: string | undefined;
  if (opts.capture) {
    const cv = document.createElement('canvas');
    cv.width = opts.width;
    cv.height = opts.height;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(opts.width, opts.height);
    const rowBytes = opts.width * 4;
    for (let y = 0; y < opts.height; y++) {
      const src = (opts.height - 1 - y) * rowBytes; // readPixels is bottom-up
      img.data.set(full.subarray(src, src + rowBytes), y * rowBytes);
    }
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    ctx.putImageData(img, 0, 0);
    const out = document.createElement('canvas');
    const scale = Math.min(1, 640 / opts.width);
    out.width = Math.round(opts.width * scale);
    out.height = Math.round(opts.height * scale);
    const octx = out.getContext('2d')!;
    octx.fillStyle = '#000804';
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(cv, 0, 0, out.width, out.height);
    capture = out.toDataURL('image/jpeg', 0.72);
  }

  const t0 = performance.now();
  for (let i = 0; i < frames; i++) {
    gl.uniform1f(uTime, 10 + i * 0.016);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, opts.instances);
  }
  sync();
  const ms = (performance.now() - t0) / frames;

  gl.deleteFramebuffer(fbo);
  gl.deleteRenderbuffer(rbo);
  gl.deleteVertexArray(vao);
  buffers.forEach((b) => gl.deleteBuffer(b));
  gl.deleteTexture(tex);

  return {
    instances: opts.instances,
    width: opts.width,
    height: opts.height,
    msPerFrame: +ms.toFixed(3),
    fps: +(1000 / ms).toFixed(1),
    coverage,
    brightCoverage,
    overdraw,
    capture,
  };
}
