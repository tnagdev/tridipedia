precision mediump float;
varying vec2 vUv;

uniform highp sampler2D uPhoto;
uniform highp sampler2D uAtlas;
uniform highp float uAtlasCols;
uniform vec2 uGrid;
uniform float uTime, uOpacity, uRampCount, uGain;
uniform float uRamp[16];
uniform vec3 uColor;

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  vec2 cell = floor(vUv * uGrid);
  vec2 inCell = fract(vUv * uGrid);

  vec3 rgb = texture2D(uPhoto, (cell + 0.5) / uGrid).rgb;
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));

  // A little per-cell noise makes the portrait shimmer like a weak signal.
  lum += (hash21(cell + floor(uTime * 3.0)) - 0.5) * 0.09;
  lum = clamp(lum, 0.0, 1.0);

  int idx = int(floor(pow(lum, 0.85) * (uRampCount - 1.0) + 0.5));
  float g = uRamp[0];
  for (int i = 0; i < 16; ++i) {
    if (i == idx) { g = uRamp[i]; break; }
  }

  vec2 auv = (vec2(mod(g, uAtlasCols), floor(g / uAtlasCols)) + inCell) / uAtlasCols;
  float a = texture2D(uAtlas, auv).r;

  float i2 = a * (0.35 + 0.65 * lum) * uOpacity * uGain;
  if (i2 < 0.003) discard;
  gl_FragColor = vec4(uColor * i2, i2);
}
