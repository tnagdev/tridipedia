// mediump is enough here and is meaningfully faster on mobile.
precision mediump float;

// Atlas coordinates stay highp on purpose: mediump has ~10 bits of mantissa,
// which on a 2048px atlas is ~2px of error — enough to bleed neighbouring
// glyph cells. Everything else is mediump, where the perf win is real and free.
in highp vec2 vUv;
in highp vec2 vCell;
in float vBright, vHead, vSkill, vSpell;

uniform highp sampler2D uAtlas;
// Shared with the vertex shader, so the precision qualifier MUST match highp
// or the program fails to link.
uniform highp float uAtlasCols;
uniform float uTint, uIntensity;
uniform vec3 uTailColor, uHeadColor, uSpellColor;
uniform vec3 uSkillColors[9];

out vec4 fragColor;

void main() {
  float a = texture(uAtlas, vCell + vUv / uAtlasCols).r;
  vec3 col = mix(uTailColor, uHeadColor, vHead);

  // Skills: the falling code itself becomes the chart.
  if (vSkill >= 0.0) {
    for (int i = 0; i < 9; ++i) {
      if (i == int(vSkill)) { col = mix(col, uSkillColors[i], uTint); break; }
    }
  }

  // A deployed skill floods the corridor in its own brand colour.
  col = mix(col, uSpellColor, vSpell * 0.85);

  float i = a * vBright * uIntensity * (1.0 + vSpell * 0.45);
  // No discard: with additive blending a=0 already contributes nothing, and
  // discard disables early-Z/HSR for the whole draw call on tile-based mobile
  // GPUs. The vertex-stage clip ejection is the correct culling mechanism.
  fragColor = vec4(col * i, i);
}
