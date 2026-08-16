precision highp float;

// --- geometry (unit quad) ---
in vec3 position;
in vec2 uv;

// --- per-instance, uploaded once, never touched again ---
in vec3 aOrigin;  // column base
in vec4 aParams;  // x speed, y phase, z trailCells, w slot
in vec4 aRand;    // x seed, y scaleJitter, z flipRate, w layer(0..2)
in vec2 aMeta;    // x skillId(-1 none), y lockedGlyph(-1 none)

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float uTime, uSpeed, uCellH, uColumnH, uSlots, uGlyphSize;
uniform float uAtlasCols, uGlyphCount, uDensity, uScrollVel;
uniform float uOpen, uConverge, uLock, uBillboardLock;
uniform float uSpell;            // 0..1 blend into the deployed skill's name
uniform float uSpellLen;         // number of glyphs in that name
uniform float uSpellGlyphs[24];  // atlas cell per character
uniform vec3 uCamPos, uFlowDir, uConvergePoint;
uniform vec4 uZones[4];   // xyz centre, w radius (0 = unused)
uniform vec2 uNearFade, uFarFade;

out vec2 vUv;
out vec2 vCell;
out float vBright, vHead, vSkill, vSpell;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  // Varyings are written before any early-out so no driver sees them undefined.
  vUv = uv; vCell = vec2(0.0); vBright = 0.0; vHead = 0.0; vSkill = -1.0; vSpell = 0.0;

  float slot  = aParams.w;
  float layer = aRand.w;
  // Parallax: near columns fall faster than far ones.
  float speed = aParams.x * uSpeed * (1.35 - 0.35 * layer);
  float fall  = uTime * speed + aParams.y * uColumnH;

  // 1. Position — a rigid ring scrolling along uFlowDir, wrapping at uColumnH.
  float d = mod(fall + slot * uCellH, uColumnH);
  vec3 pos = aOrigin - uFlowDir * (uColumnH * 0.5) + uFlowDir * d;

  // 2. Brightness from distance behind the head, measured in cells.
  //    The head index advances with time and hands off to the next slot
  //    every cell of travel, so the bright band moves with the flow.
  float ageCells = mod(fall / uCellH - slot, uSlots);
  float tail = clamp(1.0 - ageCells / aParams.z, 0.0, 1.0);
  tail *= tail;                                       // fast falloff, long dim tail
  float head = 1.0 - smoothstep(0.0, 1.7, ageCells);  // only the leading ~2 cells
  float b = max(tail, head);

  // 3. Stochastic thinning — the free continuous LOD knob.
  b *= step(hash11(aRand.x), uDensity);

  // 4. Section deformations.
  vec3 off = pos - uCamPos; off.y = 0.0;
  float rad = max(length(off), 1e-4);
  // About: push columns radially off the path so a corridor blooms into a room.
  pos += (off / rad) * uOpen * (1.0 - smoothstep(0.0, 22.0, rad)) * 11.0;
  // Contact: squeeze columns radially toward the vertical axis above the
  // convergence point, so the rainfall gathers into a rising funnel.
  // (Lerping straight to the point collapses every column into one tiny ball
  //  and the effect disappears entirely.)
  vec3 toAxis = pos - uConvergePoint;
  toAxis.y = 0.0;
  float axisR = length(toAxis);
  if (axisR > 1e-4) {
    float near = 1.0 - smoothstep(10.0, 70.0, axisR);
    pos -= (toAxis / axisR) * axisR * uConverge * near * 0.62;
  }

  // 5. Camera-relative fades.
  float dist = distance(pos, uCamPos);
  // Near fade is a perf defence as much as an aesthetic one: one glyph passing
  // the lens can otherwise cover the screen at full additive blend cost.
  b *= smoothstep(uNearFade.x, uNearFade.y, dist);
  b *= 1.0 - smoothstep(uFarFade.x, uFarFade.y, dist);

  // 6. Text holes — the rain physically parts around readable copy.
  for (int i = 0; i < 4; ++i) {
    float r = uZones[i].w;
    if (r > 0.0) b *= smoothstep(r * 0.55, r, distance(pos, uZones[i].xyz));
  }

  // 7. THE perf trick: eject dark quads from the clip volume entirely.
  //    Costs zero fragments and typically kills 60-75% of them, which is what
  //    buys 32 slots per column and therefore long, gappy, organic trails.
  if (b < 0.004) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

  // 8. Glyph selection — discrete flips, entirely on the GPU.
  float tick = floor(uTime * aRand.z + aParams.y * 37.0);
  float g = floor(hash21(vec2(aRand.x, tick)) * uGlyphCount);
  g = mix(g, aMeta.y, uLock * step(0.0, aMeta.y));

  // Global re-spell: when a skill is deployed, EVERY column in the world spells
  // that skill's name down its length. Slot index picks the character, so the
  // word reads vertically exactly like the per-tower glyph lock, but applied to
  // the whole corridor at once. Dynamic indexing of a uniform array is legal in
  // GLSL ES 3.0, which is why this needs no texture lookup.
  if (uSpell > 0.001 && uSpellLen > 0.5) {
    int si = int(mod(slot, uSpellLen));
    float sg = uSpellGlyphs[si];
    g = mix(g, sg, uSpell);
  }
  vSpell = uSpell;
  vCell = vec2(mod(g, uAtlasCols), floor(g / uAtlasCols)) / uAtlasCols;

  // 9. Billboard. Screen-aligned by default; blended toward Y-locked so
  //    sections that need strictly vertical columns can ask for it.
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec2 q = position.xy * uGlyphSize * aRand.y * (1.30 - 0.30 * layer);
  q.y *= 1.0 + abs(uScrollVel) * 2.5;   // geometry as motion blur
  vec4 clipScreen = projectionMatrix * (mv + vec4(q, 0.0, 0.0));

  vec3 look = normalize(vec3(uCamPos.x - pos.x, 0.0, uCamPos.z - pos.z) + vec3(1e-5));
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), look));
  vec3 world = pos + right * q.x + vec3(0.0, 1.0, 0.0) * q.y;
  vec4 clipWorld = projectionMatrix * modelViewMatrix * vec4(world, 1.0);

  gl_Position = mix(clipScreen, clipWorld, uBillboardLock);

  vBright = b; vHead = head; vSkill = aMeta.x;
}
