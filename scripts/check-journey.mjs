/**
 * Headless verification of the camera journey.
 *
 * Mirrors the maths in src/camera/journey.ts. Run with `npm run check:journey`
 * after editing keyframes or moving section content — it catches the class of
 * bug where the camera and the content it is meant to be looking at drift
 * apart, which is invisible until you scroll the whole site by hand.
 */
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildProjectsJourney, projectX, WALL } from '../src/camera/projectsPath.mjs';

// The content is split across src/data/ — this check needs the journey and the
// sections from site.json, and the skill and project counts from their files.
const read = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const authored = { ...read('site.json'), ...read('skills.json') };
const projectCount = read('projects.json').projects.length;

// The Projects camera path is GENERATED from the project count, so this has to
// check the journey the app actually flies, not the one in site.json. Same
// module the app calls — no hand-mirrored copy to drift out of sync.
const walk = buildProjectsJourney(authored, projectCount);
const site = {
  ...authored,
  sections: walk.sections,
  journey: { ...authored.journey, scrollHeightVh: walk.scrollHeightVh, keyframes: walk.keyframes },
};
const kfs = [...site.journey.keyframes].sort((a, b) => a.t - b.t);

const pos = new THREE.CatmullRomCurve3(kfs.map((k) => new THREE.Vector3(...k.pos)), false, 'catmullrom', site.journey.curveTension);
const look = new THREE.CatmullRomCurve3(kfs.map((k) => new THREE.Vector3(...k.look)), false, 'catmullrom', site.journey.curveTension);
pos.arcLengthDivisions = 2000;
look.arcLengthDivisions = 2000;

// Mirrors journey.ts remap(): authored keyframe times are authoritative,
// CatmullRom's own uniform parameter space is not.
const times = kfs.map((k) => k.t);
const last = times.length - 1;
const remap = (s) => {
  const t = Math.min(Math.max(s, times[0]), times[last]);
  let i = 0;
  while (i < last - 1 && times[i + 1] < t) i++;
  const span = times[i + 1] - times[i];
  return (i + (span > 1e-9 ? (t - times[i]) / span : 0)) / last;
};

const problems = [];
const P = new THREE.Vector3();
const L = new THREE.Vector3();

// --- 1. section ranges must tile [0,1] exactly ---
let prev = 0;
for (const s of site.sections) {
  if (Math.abs(s.range[0] - prev) > 1e-9) problems.push(`section ${s.id}: gap/overlap at ${s.range[0]} (expected ${prev})`);
  prev = s.range[1];
}
if (Math.abs(prev - 1) > 1e-9) problems.push(`sections end at ${prev}, not 1`);

// --- 2. keyframes must be honoured exactly ---
for (const k of kfs) {
  pos.getPoint(remap(k.t), P);
  const authored = new THREE.Vector3(...k.pos);
  const err = P.distanceTo(authored);
  if (err > 0.01) problems.push(`keyframe t=${k.t}: camera is ${err.toFixed(3)} off the authored position`);
}

// --- 3. lookAt must never degenerate ---
let minLookDist = Infinity;
let minAt = 0;
for (let i = 0; i <= 400; i++) {
  const t = i / 400;
  pos.getPoint(remap(t), P);
  look.getPoint(remap(Math.min(t + site.journey.lookAhead, 1)), L);
  const d = P.distanceTo(L);
  if (d < minLookDist) { minLookDist = d; minAt = t; }
}
if (minLookDist < 1) problems.push(`camera-to-look-target collapses to ${minLookDist.toFixed(3)} at t=${minAt.toFixed(3)}`);

// --- 4. speed profile ---
//
// Measured in world units per vh of REAL scrolling, not per unit of t.
//
// This used to compare the largest step against the mean and fail above 3x.
// That stopped being meaningful once the Projects walk started parking in front
// of each frame: a deliberate dwell is a run of near-zero steps, it drags the
// mean down, and the ratio blows past 3 without anything having got faster.
// Worse, the walk re-times the whole journey, so a fixed amount of world
// distance covers less t than it used to while covering exactly as many pixels
// of scrollbar. Per-vh is the thing a reader actually feels.
const SAMPLES = 3000;
const speeds = [];
let lastP = pos.getPoint(remap(0), new THREE.Vector3());
for (let i = 1; i <= SAMPLES; i++) {
  const t = i / SAMPLES;
  const p = pos.getPoint(remap(t), new THREE.Vector3());
  speeds.push({ t, v: (p.distanceTo(lastP) * SAMPLES) / site.journey.scrollHeightVh });
  lastP = p;
}
const fastest = speeds.reduce((a, b) => (b.v > a.v ? b : a));
// The authored journey peaks near 0.49 units/vh. Past ~0.8 the camera is
// covering ground faster than anything else on the site and reads as a lurch.
if (fastest.v > 0.8) problems.push(`camera lurch: ${fastest.v.toFixed(2)} units/vh at t=${fastest.t.toFixed(3)} (limit 0.80)`);

// --- 5. content must be VISIBLE at mid-section ---
// A centroid distance check is meaningless for sections the camera flies
// THROUGH (the skills field, the canyon), so test frustum containment instead.
const PROF = [85, 85, 80, 90, 80, 80, 70, 70, 70];
const anchors = {
  hero: [[0, 3.4, -6], [0, 0.3, -6]],
  // the bento: portrait tile, identity card, skills tile
  about: [[-5.9, 2.3, -41.2], [0.8, 3.9, -41.2], [7.3, -0.4, -41.2]],
  skills: Array.from({ length: 9 }, (_, i) => {
    const row = i % 2 === 0 ? -1 : 1;
    return [row * (7 + (i % 3) * 1.6), -4 + ((PROF[i] / 100) * 26) / 2, -74 - i * 6];
  }),
  experience: [[13, 0.5, -170], [-13, 0.5, -200], [13, 0.5, -235]],
  projects: Array.from({ length: projectCount }, (_, i) => [projectX(i, projectCount), WALL.y, WALL.z]),
  contact: [[0, 21.5, -350.5], [0, 26.5, -352]],
};

const fwd = new THREE.Vector3();
for (const s of site.sections) {
  const mid = (s.range[0] + s.range[1]) / 2;
  pos.getPoint(remap(mid), P);
  look.getPoint(remap(Math.min(mid + site.journey.lookAhead, 1)), L);
  fwd.copy(L).sub(P).normalize();

  const halfAngle = THREE.MathUtils.degToRad(70) * 0.5 * 1.35; // generous for aspect
  let visible = 0;
  let bestAngle = Infinity;
  for (const a of anchors[s.id]) {
    const v = new THREE.Vector3(...a).sub(P);
    const dist = v.length();
    if (dist < 1e-3) continue;
    const angle = v.normalize().angleTo(fwd);
    bestAngle = Math.min(bestAngle, angle);
    if (angle < halfAngle && dist < 220) visible++;
  }
  const n = anchors[s.id].length;
  const ok = visible > 0;
  console.log(
    `  ${s.id.padEnd(11)} t=${mid.toFixed(3)}  cam=(${P.x.toFixed(1)},${P.y.toFixed(1)},${P.z.toFixed(1)})  ` +
      `visible ${visible}/${n}  nearest=${THREE.MathUtils.radToDeg(bestAngle).toFixed(1)}deg  ${ok ? 'ok' : 'NOTHING VISIBLE'}`,
  );
  if (!ok) problems.push(`section ${s.id}: no content inside the frustum at mid-section (nearest ${THREE.MathUtils.radToDeg(bestAngle).toFixed(1)}deg off-axis)`);
}

// --- 6. every project must actually come to rest in the middle of frame ---
//
// The whole point of the Projects walk. A project that is merely inside the
// frustum has not been "in focus"; this asserts the camera parks square-on to
// each one, with it near screen centre, for a real amount of scrolling.
const fovKeys = kfs.map((k) => ({ t: k.t, v: k.fov ?? 60 }));
const sampleFov = (t) => {
  let i = 1;
  while (i < fovKeys.length - 1 && fovKeys[i].t < t) i++;
  const a = fovKeys[i - 1];
  const b = fovKeys[i];
  const u = THREE.MathUtils.clamp((t - a.t) / Math.max(b.t - a.t, 1e-6), 0, 1);
  const e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
  return THREE.MathUtils.lerp(a.v, b.v, e);
};

console.log('');
for (const hold of walk.holds) {
  const target = new THREE.Vector3(hold.x, WALL.y, WALL.z);
  const n = 41;
  let centred = 0;
  for (let q = 0; q < n; q++) {
    const t = hold.from + (hold.to - hold.from) * (q / (n - 1)) * 0.999;
    pos.getPoint(remap(t), P);
    look.getPoint(remap(Math.min(t + site.journey.lookAhead, 1)), L);
    const cam = new THREE.PerspectiveCamera(sampleFov(t), 16 / 9, 0.1, 420);
    cam.position.copy(P);
    cam.up.set(0, 1, 0);
    cam.lookAt(L);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    if (Math.abs(target.clone().project(cam).x) < 0.15) centred++;
  }
  const frac = centred / n;
  const vh = (hold.to - hold.from) * site.journey.scrollHeightVh;
  const ok = frac >= 0.55 && frac * vh >= 18;
  console.log(
    `  project ${hold.index}  x=${hold.x.toFixed(1).padStart(6)}  centred ${(frac * 100).toFixed(0)}% of a ` +
      `${vh.toFixed(0)}vh stop (${(frac * vh).toFixed(0)}vh)  ${ok ? 'ok' : 'NOT IN FOCUS'}`,
  );
  if (!ok) problems.push(`project ${hold.index}: only ${(frac * vh).toFixed(0)}vh of centred framing (want 18vh+)`);
}

const projRange = site.sections.find((x) => x.id === 'projects').range;
console.log(`\ncurve length ${pos.getLength().toFixed(1)} units · scroll ${Math.round(site.journey.scrollHeightVh)}vh · peak ${fastest.v.toFixed(2)} units/vh`);
console.log(`projects own ${((projRange[1] - projRange[0]) * 100).toFixed(1)}% of the journey for ${projectCount} project(s)`);
console.log(`min camera->look distance ${minLookDist.toFixed(2)}`);

if (problems.length) {
  console.log(`\nPROBLEMS:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll journey checks passed.');
