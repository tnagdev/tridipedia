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

const site = JSON.parse(readFileSync(new URL('../src/content/site.json', import.meta.url), 'utf8'));
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
const steps = [];
let lastP = pos.getPoint(remap(0), new THREE.Vector3());
for (let i = 1; i <= 400; i++) {
  const p = pos.getPoint(remap(i / 400), new THREE.Vector3());
  steps.push(p.distanceTo(lastP));
  lastP = p;
}
const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
const maxStep = Math.max(...steps);
const minStep = Math.min(...steps);
// Speed intentionally varies (the canyon is fast, the hero lingers), but a
// very large ratio means a keyframe is badly placed and will read as a lurch.
if (maxStep / mean > 3.0) problems.push(`speed spike: max step ${maxStep.toFixed(3)} vs mean ${mean.toFixed(3)}`);

// --- 5. content must be VISIBLE at mid-section ---
// A centroid distance check is meaningless for sections the camera flies
// THROUGH (the skills field, the canyon), so test frustum containment instead.
const PROF = [85, 85, 80, 90, 80, 80, 70, 70, 70];
const anchors = {
  hero: [[0, 3.4, -6], [0, 0.3, -6]],
  about: [[0, 1.4, -40], [4.6, 1.2, -40]],
  skills: Array.from({ length: 9 }, (_, i) => {
    const row = i % 2 === 0 ? -1 : 1;
    return [row * (7 + (i % 3) * 1.6), -4 + ((PROF[i] / 100) * 26) / 2, -74 - i * 6];
  }),
  experience: [[13, 0.5, -170], [-13, 0.5, -200], [13, 0.5, -235]],
  projects: [[-9.2, 2, -292], [0, 2, -292], [9.2, 2, -292]],
  contact: [[0, 22, -350], [0, 18.6, -350]],
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

console.log(`\ncurve length ${pos.getLength().toFixed(1)} units · step mean ${mean.toFixed(2)} min ${minStep.toFixed(2)} max ${maxStep.toFixed(2)}`);
console.log(`min camera->look distance ${minLookDist.toFixed(2)}`);

if (problems.length) {
  console.log(`\nPROBLEMS:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll journey checks passed.');
