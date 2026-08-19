precision mediump float;

in highp vec2 vUv;
in highp vec2 vCell;
in float vBright;

uniform highp sampler2D uAtlas;
uniform highp float uAtlasCols;
uniform vec3 uColor;
uniform float uOpacity;

out vec4 fragColor;

void main() {
  float a = texture(uAtlas, vCell + vUv / uAtlasCols).r;
  float i = a * vBright * uOpacity;
  fragColor = vec4(uColor * i, i);
}
