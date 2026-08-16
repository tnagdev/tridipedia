precision highp float;

in vec3 position;
in vec2 uv;
in vec3 aOrigin;
in vec3 aTarget;
in vec4 aRand;   // x seed, y scaleJitter, z flipRate, w stagger

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime, uForm, uGlyphSize, uAtlasCols, uGlyphCount, uFallSpeed, uColumnH;

out vec2 vUv;
out vec2 vCell;
out float vBright;

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  vUv = uv;

  // Falling state: same ring wrap as the main rain, so the two read as one system.
  float d = mod(uTime * uFallSpeed + aRand.x * uColumnH, uColumnH);
  vec3 falling = aOrigin + vec3(0.0, -1.0, 0.0) * d;

  // Staggered arrival: each glyph starts converging at its own moment, so they
  // land in a scatter rather than snapping as one block.
  float s = aRand.w * 0.35;
  float f = smoothstep(s, s + 0.65, uForm);
  f = f * f * (3.0 - 2.0 * f);

  vec3 pos = mix(falling, aTarget, f);

  // Much dimmer while scattered. Thousands of additive quads overlapping in a
  // small volume otherwise sum to a solid white cloud that blows out the copy
  // underneath; the word should resolve OUT of near-darkness.
  vBright = mix(0.06, 1.0, f * f);

  float tick = floor(uTime * aRand.z);
  // Once formed, stop flipping so the word stays legible.
  float g = floor(hash21(vec2(aRand.x, mix(tick, 7.0, f))) * uGlyphCount);
  vCell = vec2(mod(g, uAtlasCols), floor(g / uAtlasCols)) / uAtlasCols;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  mv.xy += position.xy * uGlyphSize * aRand.y;
  gl_Position = projectionMatrix * mv;
}
