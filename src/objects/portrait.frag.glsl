precision mediump float;
varying vec2 vUv;

uniform highp sampler2D uMask;   // 1 texel per character cell, 0 or 1
uniform highp sampler2D uAtlas;  // the rain's glyph atlas
uniform highp float uAtlasCols;
uniform float uGlyphCount;
uniform vec2 uGrid;              // cols, rows of the source art
uniform float uTime, uOpacity, uReveal;
uniform vec3 uColor, uHead;

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float maskAt(vec2 cell) {
  return texture2D(uMask, (cell + 0.5) / uGrid).r;
}

void main() {
  vec2 cell = floor(vUv * uGrid);
  vec2 inCell = fract(vUv * uGrid);

  // Empty cells of the source art cost nothing beyond this test.
  if (maskAt(cell) < 0.5) discard;

  // A cell missing any of its four neighbours is on the silhouette. Those
  // cells stay code; the interior settles into solid blocks, which is what
  // makes the picture read as ASCII rather than as a stencil.
  float inner = maskAt(cell + vec2(1.0, 0.0)) * maskAt(cell + vec2(-1.0, 0.0))
              * maskAt(cell + vec2(0.0, 1.0)) * maskAt(cell + vec2(0.0, -1.0));
  float edge = 1.0 - inner;

  // The reveal front sweeps top to bottom, jittered per cell, so the portrait
  // condenses out of the rain instead of wiping like a progress bar — the same
  // read as the falling-particle formation on the old site.
  float rowT = 1.0 - (cell.y + 0.5) / uGrid.y;
  float delay = rowT * 0.68 + hash21(cell) * 0.30;
  float appear = smoothstep(delay, delay + 0.14, uReveal);
  if (appear <= 0.002) discard;

  // A block glyph, with the gutter a monospace cell leaves around it.
  vec2 d = abs(inCell - 0.5);
  float block = (1.0 - smoothstep(0.40, 0.48, d.x)) * (1.0 - smoothstep(0.44, 0.50, d.y));

  // A glyph from the rain atlas, re-rolled a few times a second.
  float gi = floor(hash21(cell + floor(uTime * 5.0)) * uGlyphCount);
  vec2 auv = (vec2(mod(gi, uAtlasCols), floor(gi / uAtlasCols)) + inCell) / uAtlasCols;
  float glyph = texture2D(uAtlas, auv).r;

  // Edge cells never fully settle, so the outline keeps flickering as code.
  float settle = appear * (1.0 - edge * 0.5);
  float ink = mix(glyph, block, settle);

  // The forming front burns bright, then cools to the body colour.
  float front = smoothstep(0.0, 0.3, appear) * (1.0 - smoothstep(0.3, 1.0, appear));
  float flicker = 0.9 + 0.1 * sin(uTime * 3.1 + hash21(cell) * 6.283);
  float scan = smoothstep(0.955, 1.0, fract(vUv.y * 0.8 - uTime * 0.09));

  float a = ink * appear * flicker * uOpacity * (0.82 + front * 0.7 + scan * 0.4);
  if (a < 0.004) discard;

  vec3 col = mix(uColor, uHead, clamp(front * 0.9 + edge * 0.2 + scan * 0.5, 0.0, 1.0));
  gl_FragColor = vec4(col * a, a);
}
