precision mediump float;
varying vec2 vGridUv;
uniform float uTime, uFade, uOpacity;
uniform vec3 uColor;

/** Anti-aliased line at every integer of `coord`, via screen-space derivatives. */
float gridLine(vec2 coord, float width) {
  vec2 g = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  float l = min(g.x, g.y);
  return 1.0 - min(l / width, 1.0);
}

void main() {
  vec2 p = vGridUv;
  float fine = gridLine(p, 1.0);
  float coarse = gridLine(p * 0.1, 1.4) * 1.6;

  // Fade with distance from the centre so there is no hard edge or far-plane pop.
  float d = length(p) / uFade;
  float falloff = 1.0 - smoothstep(0.25, 1.0, d);

  // A slow pulse travelling outward keeps the plane from reading as static.
  float pulse = 0.6 + 0.4 * sin(length(p) * 0.12 - uTime * 1.1);

  float a = (fine * 0.45 + coarse) * falloff * pulse * uOpacity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}
