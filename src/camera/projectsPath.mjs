/**
 * The Projects gallery walk, derived from the project count.
 *
 * ONE horizontal glide. The camera comes in to the left of the wall, tracks
 * right at a constant speed with the wall square-on, carries on past the last
 * project, and then banks up and away into Contact. Every project passes
 * through dead centre of frame on the way. Adding a project makes the glide
 * longer; nothing here is tuned per project.
 *
 * PLAIN .mjs ON PURPOSE, with zero imports. The same maths has to run in three
 * places — the app (through loadContent), the section that draws the wall, and
 * scripts/check-journey.mjs, which is Node and cannot load TypeScript. Every
 * other bit of journey maths in this repo is hand-mirrored into the check
 * script and can therefore drift from what actually ships; this one cannot.
 * Types live beside it in projectsPath.d.mts.
 *
 * WHAT WAS WRONG BEFORE, because it is the whole design:
 *
 * The first version pulled back and rose between projects and pumped the fov
 * 54 -> 64 -> 54 on every hop, meaning to make arriving read as settling. It
 * read as the camera jumping backwards out of one frame and lunging into the
 * next. The second version fixed the bobbing but still PARKED at each project,
 * so the motion was accelerate, stop, accelerate, stop — the judder had moved
 * out of the shape of the path and into its speed. Any repeated start/stop
 * along a straight wall reads as jank, however smooth each individual move is.
 *
 * So there are no stops. A project is "in focus" because the camera passes
 * directly in front of it, not because it waits there, and the glide is slow
 * enough that each project owns the centre of frame for CENTRED_VH of
 * scrolling on its way through.
 *
 * Four things hold the smoothness up.
 *
 * 1. SPEED IS THE SHAPE, AND KEYFRAMES ARE SAMPLED FROM IT.
 *    The route is walked densely, given a speed profile in world-units-per-vh,
 *    and integrated to get time; keyframes are then sampled off that. Because
 *    remap() maps scroll linearly across each keyframe interval, the spacing of
 *    the keyframes IS the speed graph, so there is no way to author a lurch by
 *    accident. Across the glide the sampling is at even time, which at constant
 *    speed is even spacing, and the measured speed is constant to within 0.00%.
 *
 *    The approach and the exit are sampled on a taper instead. A Catmull-Rom
 *    tangent comes from a point's neighbours, so a short segment next to a long
 *    one overshoots inside the short one, and the authored journey either side
 *    of this section keys about 40 world units apart while the glide keys about
 *    1.5. The taper walks between the two densities.
 *
 * 2. ONLY X MOVES ACROSS THE GLIDE.
 *    y, z, fov and roll are constant from the start of the glide to the end of
 *    it. The only acceleration in the whole section is the ramp in on the
 *    approach and the ramp out on the exit, and both are smoothstepped.
 *
 * 3. THE EXIT LEAVES ALONG THE GLIDE AND TURNS AS A CURVE, NOT A CORNER.
 *    It is a cubic Bezier whose first control point is straight ahead of the
 *    glide, so the camera carries on past the last project before it starts to
 *    turn, and it climbs on the way out. A straight line to the next authored
 *    keyframe instead — which is what this was — reverses x at the very moment
 *    the glide ends, and no amount of smoothing elsewhere hides a direction
 *    flip. The exit also runs PAST the section boundary to the second authored
 *    keyframe beyond it, because the boundary one sits low and to the left and
 *    forced exactly the turn we are trying to avoid.
 *
 * 4. THE LOOK TRACK IS SHIFTED BACK BY lookAhead, AND HANDS OVER ON THE EXIT.
 *    CameraRig aims at `look(s + lookAhead)`, not `look(s)`. Left uncorrected
 *    the camera leads the glide and every project crosses frame off-centre;
 *    writing `look = target(t - lookAhead)` cancels it exactly, which is what
 *    keeps the wall square-on. On the exit the target then blends off the wall
 *    and onto the authored Contact aim. Without that blend the camera flew past
 *    the wall while still aiming at it, ended up looking backwards, and snapped
 *    round at the anchor — far more of a jolt than anything the path was doing.
 *
 * And one consequence: the section takes the scroll this needs. Six projects
 * are a 46-unit wall and cannot be crossed inside the authored 12% of the
 * journey at a watchable speed, so it grows, every other section is squeezed by
 * the same factor in `t`, and `scrollHeightVh` grows to compensate. That leaves
 * every other section exactly as many real pixels of scrolling as it had.
 */

/** The wall the frames hang on. ProjectsSection draws from these same numbers. */
export const WALL = { z: -292, y: 2, gap: 9.2, frameW: 7.6, frameH: 5 };

/** World x of project `i` of `n`, centred on the origin. */
export function projectX(i, n) {
  return (i - (n - 1) / 2) * WALL.gap;
}

/* --------------------------------- the shot -------------------------------- */

/** Stand-off from the wall. Frames fill ~78% of viewport width at FOV. */
const DIST = 11.5;
/** Constant for the whole glide. */
const CAM_Y = 1.9;
const LOOK_Y = 1.35;
const FOV = 54;
/** Speed coming in, and going out. Both in world units per vh of scrolling. */
const APPROACH_SPEED = 0.3;
const EXIT_SPEED = 0.38;
/** How long each project owns the centre of frame, in vh. Sets the glide speed. */
const CENTRED_VH = 26;
/** "Centre of frame" means within this much of screen centre, at 16:9. */
const CENTRED_NDC = 0.15;
const REFERENCE_ASPECT = 16 / 9;
/** How far the exit carries straight on before it begins to turn, as a fraction
 *  of the distance still to run. This is what makes it a curve, not a corner. */
const EXIT_LEAD = 0.24;
/** Where the exit aims from, likewise — shapes how it arrives. */
const EXIT_ARRIVE = 0.3;
/** One keyframe per this much scrolling ALONG THE GLIDE. */
const VH_PER_KEYFRAME = 14;
/** Keyframes on the approach and the exit, where the spacing tapers. */
const APPROACH_STEPS = 6;
const EXIT_STEPS = 9;

const lerp = (a, b, u) => a + (b - a) * u;
const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const smooth = (u) => u * u * (3 - 2 * u);
/**
 * Gaps that grow geometrically from `firstGap` and sum to `span`.
 *
 * The taper has to LEAVE the glide at the glide's own spacing, not at some
 * fraction of the leg. A power curve started the exit with a gap 1/81 of the
 * leg — a 0.4-unit segment butted against the glide's 1.7-unit ones — and
 * Catmull-Rom stalled inside it, dropping the camera from 0.12 to 0.03 units/vh
 * at the exact moment it left the last project. That stall was the jerk.
 * Geometric growth pins the first gap and keeps every neighbouring pair within
 * the same small ratio all the way out to the authored keyframes.
 */
function geometricGaps(span, firstGap, steps) {
  if (steps <= 1) return [span];
  const total = (r) => (Math.abs(r - 1) < 1e-9 ? firstGap * steps : (firstGap * (r ** steps - 1)) / (r - 1));
  let lo = 0.2;
  let hi = 4;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (total(mid) < span) lo = mid;
    else hi = mid;
  }
  const r = (lo + hi) / 2;
  const gaps = [];
  let g = firstGap;
  for (let j = 0; j < steps; j++) {
    gaps.push(g);
    g *= r;
  }
  const sum = gaps.reduce((a, b) => a + b, 0);
  return gaps.map((x) => (x * span) / sum);
}

const bezier = (p0, p1, p2, p3, u) => {
  const m = 1 - u;
  return [0, 1, 2].map(
    (k) => m ** 3 * p0[k] + 3 * m * m * u * p1[k] + 3 * m * u * u * p2[k] + u ** 3 * p3[k],
  );
};

/** Half-width on the wall that still counts as centre of frame. */
function centredHalfWidth() {
  const halfH = DIST * Math.tan((FOV * Math.PI) / 360);
  return CENTRED_NDC * halfH * REFERENCE_ASPECT;
}

/**
 * Rebuilds the journey for `count` projects.
 *
 * Returns a whole replacement journey plus sections — the caller swaps them in
 * wholesale rather than patching, because the re-timing touches every section.
 */
export function buildProjectsJourney(site, count) {
  const authored = [...site.journey.keyframes].sort((a, b) => a.t - b.t);
  const sections = site.sections.map((s) => ({ ...s, range: [...s.range] }));
  const pi = sections.findIndex((s) => s.id === 'projects');
  if (pi < 0 || count < 1) {
    return { keyframes: authored, sections, scrollHeightVh: site.journey.scrollHeightVh, holds: [] };
  }

  const [S0, E0] = sections[pi].range;
  // The approach still starts exactly where Experience leaves the camera.
  let enterIdx = 0;
  for (let i = 0; i < authored.length; i++) if (authored[i].t <= S0 + 1e-9) enterIdx = i;
  // The exit runs to the SECOND authored keyframe past the boundary: see note 3.
  let exitIdx = authored.length - 1;
  for (let i = authored.length - 1; i >= 0; i--) if (authored[i].t >= E0 - 1e-9) exitIdx = i;
  exitIdx = Math.min(exitIdx + 1, authored.length - 1);
  const enter = authored[enterIdx];
  const exit = authored[exitIdx];

  const xs = Array.from({ length: count }, (_, i) => projectX(i, count));
  const z = WALL.z + DIST;
  const half = centredHalfWidth();
  const glideSpeed = (2 * half) / CENTRED_VH;

  // The glide starts well before the first project and ends well after the
  // last. Two reasons: the outer projects get their centred window at full
  // constant speed rather than inside the approach and exit ramps, and the
  // rounded corner where the approach turns onto the wall — the one place the
  // glide is not perfectly even, briefly running ~25% fast as it settles —
  // finishes before the first project reaches frame centre.
  const margin = half + 2.6;
  const glideFrom = [xs[0] - margin, CAM_Y, z];
  const glideTo = [xs[count - 1] + margin, CAM_Y, z];

  /* ---- 1. walk the route densely ---- */
  const route = [];
  const push = (leg, u, pos) => route.push({ leg, u, pos });
  const straight = (from, to, leg, steps) => {
    for (let j = route.length ? 1 : 0; j <= steps; j++) push(leg, j / steps, lerp3(from, to, j / steps));
  };
  straight(enter.pos, glideFrom, 0, 300);
  const glideStart = route.length - 1;
  straight(glideFrom, glideTo, 1, 600);
  const glideEnd = route.length - 1;

  // The exit: carry straight on, then bank up and away. See note 3.
  const chord = dist(glideTo, exit.pos);
  const c1 = [glideTo[0] + EXIT_LEAD * chord, glideTo[1], glideTo[2]];
  const c2 = [exit.pos[0], lerp(glideTo[1], exit.pos[1], 0.35), exit.pos[2] + EXIT_ARRIVE * chord];
  for (let j = 1; j <= 500; j++) push(2, j / 500, bezier(glideTo, c1, c2, exit.pos, j / 500));

  /* ---- 2. give it a speed profile and integrate to time ---- */
  const speedAt = (p) =>
    p.leg === 1
      ? glideSpeed
      : p.leg === 0
        ? lerp(APPROACH_SPEED, glideSpeed, smooth(p.u))
        : lerp(glideSpeed, EXIT_SPEED, smooth(p.u));

  const clock = [0];
  for (let i = 1; i < route.length; i++) {
    const ds = dist(route[i].pos, route[i - 1].pos);
    const v = (speedAt(route[i]) + speedAt(route[i - 1])) / 2;
    clock.push(clock[i - 1] + ds / v);
  }
  const vh = clock[clock.length - 1];

  /* ---- 3. re-time the journey so the path can afford itself ---- */
  const spanT = exit.t - enter.t;
  const otherT = 1 - spanT;
  const totalVh = otherT * site.journey.scrollHeightVh + vh;
  const share = vh / totalVh;
  const squeeze = (1 - share) / otherT;
  const S = enter.t * squeeze;
  const retime = (t) => (t <= enter.t ? t * squeeze : S + share + (t - exit.t) * squeeze);
  const tAt = (v) => S + (v / vh) * share;

  /* ---- 4. sample the route ---- */
  const at = (v) => {
    let i = 0;
    while (i < clock.length - 2 && clock[i + 1] < v) i++;
    const span = clock[i + 1] - clock[i];
    const u = span > 1e-9 ? (v - clock[i]) / span : 0;
    const a = route[i];
    const b = route[i + 1];
    return { pos: lerp3(a.pos, b.pos, u), leg: b.leg, legU: a.leg === b.leg ? lerp(a.u, b.u, u) : b.u };
  };

  const gA = clock[glideStart];
  const gB = clock[glideEnd];
  const glideSteps = Math.max(4, Math.round((gB - gA) / VH_PER_KEYFRAME));
  const glideGap = (gB - gA) / glideSteps;

  // Both tapers are pinned to the glide's own spacing at the glide end and grow
  // outward from there toward the authored journey's much coarser keying.
  const marks = [0];
  const inGaps = geometricGaps(gA, glideGap, APPROACH_STEPS).reverse();
  for (const g of inGaps) marks.push(marks[marks.length - 1] + g);
  for (let j = 1; j < glideSteps; j++) marks.push(gA + j * glideGap);
  marks.push(gB);
  for (const g of geometricGaps(vh - gB, glideGap, EXIT_STEPS)) {
    marks.push(marks[marks.length - 1] + g);
  }

  /* ---- 5. aim: see note 4 ---- */
  const enterFov = enter.fov ?? 60;
  const exitFov = exit.fov ?? 60;
  const enterRoll = enter.roll ?? 0;
  const exitRoll = exit.roll ?? 0;
  const la = site.journey.lookAhead;

  const targetAt = (v) => {
    const p = at(Math.max(0, Math.min(vh, v)));
    const wall = [p.pos[0], LOOK_Y, WALL.z];
    return p.leg === 2 ? lerp3(wall, exit.look, smooth(p.legU)) : wall;
  };

  const samples = marks.map((v) => {
    const p = at(v);
    const t = tAt(v);
    return {
      t,
      pos: p.pos,
      look: targetAt(v - (la / share) * vh),
      fov: p.leg === 1 ? FOV : p.leg === 0 ? lerp(enterFov, FOV, smooth(p.legU)) : lerp(FOV, exitFov, smooth(p.legU)),
      roll: p.leg === 1 ? 0 : p.leg === 0 ? lerp(enterRoll, 0, smooth(p.legU)) : lerp(0, exitRoll, smooth(p.legU)),
    };
  });

  // The first and last marks ARE the anchors, which stay authored.
  const generated = samples.slice(1, -1).sort((a, b) => a.t - b.t);
  const kept = authored
    .filter((k) => k.t <= enter.t + 1e-9 || k.t >= exit.t - 1e-9)
    .map((k) => ({ ...k, t: retime(k.t) }));

  /* ---- 6. sections: the gallery ends when the camera crosses the wall ---- */
  let crossing = vh;
  for (let i = glideEnd; i < route.length; i++) {
    if (route[i].pos[2] <= WALL.z) { crossing = clock[i]; break; }
  }
  const projectsEnd = tAt(crossing);
  for (const s of sections) {
    s.range = [
      s.range[0] > S0 && s.range[0] < exit.t ? projectsEnd : retime(s.range[0]),
      s.range[1] > S0 && s.range[1] < exit.t ? projectsEnd : retime(s.range[1]),
    ];
  }

  /**
   * The scroll window in which each project holds the centre of frame. The
   * glide is constant speed, so time is linear in x across it.
   */
  const atX = (x) => tAt(lerp(gA, gB, (x - glideFrom[0]) / (glideTo[0] - glideFrom[0])));
  const holds = xs.map((x, i) => ({ index: i, x, from: atX(x - half), to: atX(x + half) }));

  return {
    keyframes: [...kept, ...generated].sort((a, b) => a.t - b.t),
    sections,
    scrollHeightVh: totalVh,
    holds,
  };
}

/**
 * Rain parts around these so copy stays readable. The shader carries four
 * slots, so a wide wall gets four wide spheres spread along it rather than one
 * per project — at nine projects the wall is 74 units across and a single
 * authored sphere at the origin left the outer frames in full rain.
 */
export function projectTextZones(count) {
  if (count < 1) return [];
  if (count <= 4) return Array.from({ length: count }, (_, i) => [projectX(i, count), WALL.y, WALL.z, 9]);
  const half = projectX(count - 1, count);
  return Array.from({ length: 4 }, (_, j) => [lerp(-half, half, j / 3), WALL.y, WALL.z, half / 2.6 + 7]);
}
