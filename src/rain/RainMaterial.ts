import * as THREE from 'three';
import vertexShader from './rain.vert.glsl?raw';
import fragmentShader from './rain.frag.glsl?raw';
import { buildGlyphAtlas, ATLAS_COLS, GLYPH_COUNT } from './glyphAtlas';
import { CELL_H, COLUMN_H, SLOTS } from './rainConfig';

/**
 * MODULE-LEVEL SINGLETON. This is a structural rule, not an optimisation.
 *
 * The WebGLRenderer program cache is keyed by material instance, so reusing
 * one instance across section mount/unmount cycles is what keeps the compiled
 * program alive. Any `new RawShaderMaterial()` inside a render or a
 * non-hoisted useMemo brings back the 200-600ms compile hitch at every
 * section boundary.
 */

const SKILL_COLORS = [
  '#61DBFB', '#DD0031', '#FFFFFF', '#F7DF1E', '#E34F26',
  '#1572B6', '#F05032', '#4F8FF8', '#FFC107',
].map((h) => new THREE.Color(h));

let instance: THREE.RawShaderMaterial | null = null;

export function getRainMaterial(): THREE.RawShaderMaterial {
  if (instance) return instance;

  instance = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    // depthTest stays ON: being occluded by solid geometry is what sells the 3D.
    // Additive blending also means draw order never matters, so there is no
    // per-frame depth sort, ever.
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false, // heads stay above 1.0 so bloom's threshold catches them
    uniforms: {
      uAtlas: { value: buildGlyphAtlas() },
      uTime: { value: 0 },
      uSpeed: { value: 1.0 },
      uCellH: { value: CELL_H },
      uColumnH: { value: COLUMN_H },
      uSlots: { value: SLOTS },
      uGlyphSize: { value: 0.55 },
      uAtlasCols: { value: ATLAS_COLS },
      uGlyphCount: { value: GLYPH_COUNT },
      uDensity: { value: 1.0 },
      uScrollVel: { value: 0 },
      uIntensity: { value: 1.0 },
      uOpen: { value: 0 },
      uConverge: { value: 0 },
      uLock: { value: 0 },
      uSpell: { value: 0 },
      uSpellLen: { value: 0 },
      uSpellGlyphs: { value: new Array(24).fill(0) },
      uSpellColor: { value: new THREE.Color('#ffffff') },
      uTint: { value: 0 },
      uBillboardLock: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uFlowDir: { value: new THREE.Vector3(0, -1, 0) },
      uConvergePoint: { value: new THREE.Vector3(0, 30, 0) },
      uZones: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, 0)) },
      // Kills the few enormous near-lens quads that dominate fill cost once the
      // rain shell is concentrated around the camera path.
      uNearFade: { value: new THREE.Vector2(1.6, 5.5) },
      uFarFade: { value: new THREE.Vector2(55, 95) },
      uTailColor: { value: new THREE.Color('#00d93f') },
      uHeadColor: { value: new THREE.Color('#d8ffe4') },
      uSkillColors: { value: SKILL_COLORS },
    },
  });

  return instance;
}
