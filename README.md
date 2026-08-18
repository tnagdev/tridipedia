# Tridipedia

A personal portfolio rendered as one continuous scroll-driven journey through a
three-dimensional Matrix digital-rain world. Sections are *places* in that
world, not pages.

Built with Vite + React 18 + React Three Fiber. No backend, no services — every
piece of content is read from a single local JSON file.

## Run

```bash
npm install
npm run dev
```

| script | what it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | typecheck → journey check → production build |
| `npm run check` | typecheck + journey check, no build |
| `npm run check:journey` | verify the camera spline against section content |
| `npm run preview` | serve the production build |

## Editing content

**Everything lives in [`src/content/site.json`](src/content/site.json).** Bio,
skills, jobs, career phases, projects, socials, the colour palette, the camera
keyframes and the per-section rain settings. Types are in
[`content.types.ts`](src/content/content.types.ts).

Things that are *derived* and must not be hardcoded: years of experience (from
`profile.codingSince`), job durations and date labels (from ISO `start`/`end`),
and the Experience canyon geometry — monolith lengths are computed from the real
dates, so changing a date physically changes the world.

Still to fill in: `email`, `socials[].url`, and the three `projects` entries.
They are `null` / `placeholder: true` today, and both sections are designed to
look deliberate while empty. Set `placeholder: false` and the frames take real
content with no code changes.

After editing camera keyframes, run `npm run check:journey` — it verifies that
the camera actually arrives where each section's content is.

## Visual vocabulary

Sections are composed from a handful of shared objects in `src/objects/`, not bespoke
geometry per section — this is what keeps the world coherent and the draw-call
budget countable:

| component | role |
| --- | --- |
| `HoloPanel` | framed console. All chrome (brackets, header LEDs, footer bars, bevel, boot-open) drawn analytically in one shader, costing zero text instances. Opaque back plate so it genuinely occludes the rain, chamfered in step with the front. Themes: `matrix`, `ark`; `chamfer` cuts the corners |
| `MarkTiles` | interactive hex tiles carrying real brand logos — hex frame, gauge arc and logo in ONE instanced draw, so N tiles cost one call. Used by both Skills and the social widgets |
| `HudBracket` | targeting brackets + leader line, so labels read as *scanned* rather than placed |
| `Conduit` | glowing run with travelling pulses, connecting things across a section |
| `StatBar` | segmented instrument readout, drawn analytically on one quad |
| `Nav3D` | the console: a camera-parented liquid column down the left edge, collapsed to badges and sliding open on hover. Its silhouette is a graph, `x = edge(y)`, so it drifts and bulges around the live section; the row's glow spills past that edge because the quad is padded and the housing draws its own alpha. Opaque body, so it cuts the rain instead of tinting it. Badges, brand mark and operator come from the shared mark atlas |
| `NineSlice` | any container, sliced with CSS `border-image` semantics — four independent borders, stretched middle, optional `fill`. Source is either an authored image (`src` + `slice` in its own pixels) or the sprite sheet `frameAtlas` generates at boot; a missing image falls back to the drawn one. Corner art holds its size at any box size, so an animating panel never smears |
| `AsciiPortrait` | the block self-portrait carried over from the old site, uploaded as a one-texel-per-character mask and drawn on one quad. Interior cells settle into blocks, silhouette cells keep flickering as rain glyphs |

Layout comes from `panelLayout.ts`: text positions are derived from the panel's
own dimensions rather than hand-tuned world coordinates, which is what stops
copy overflowing its panel when a size changes.

Navigation is `src/scene/Nav3D.tsx` — rendered in WebGL, parented to the camera,
and repositioned every frame from the camera's **current** fov (which is
keyframed 55→78 across the journey, so anything pinned at a fixed height
drifts). `src/dom/SrNav.tsx` is the real keyboard/screen-reader navigation.

## Interaction

Two things respond to clicks, and both are worth knowing about:

- **Skills** — chips are strung in a helix around the *camera spline itself*, so
  the layout is a pure function of `skills.length`; adding a skill to
  `site.json` re-spaces the lattice with no code change. Clicking a chip
  **deploys** it: the entire rain re-spells itself with that skill's name in its
  brand colour (`uSpell` in `rain.vert.glsl`). Escape releases it.
- **Experience** — job cards peel off the canyon wall, rotate flat and dock dead
  centre, hold while the story types out on scroll, then tip back out as the
  next arrives. The dock target is recomputed each frame from the live camera
  basis, which is what makes it land centred at any fov (this section's fov
  sweeps 58→78). Clicking opens a dossier; Escape or scrolling away closes it.
  Scroll is deliberately **never** locked — `F.raw` is read from
  `window.scrollY`, so locking would desync the camera from the scrollbar.

## Architecture

```
src/
├── content/   site.json — the single source of truth, plus types and derived helpers
├── state/     frameState.ts (mutable per-frame globals) · store.ts · sections.ts
├── scroll/    Lenis + native scroll, section progress hooks
├── camera/    dual CatmullRom splines, keyframe remapping, the camera rig
├── rain/      the centrepiece: glyph atlas, instanced geometry, GLSL, hero formation
├── scene/     Canvas, per-frame driver, postprocessing, world assembly, sections
├── objects/   CRT panel, ASCII image, skill towers, job monoliths, portal frames, grid
├── text/      troika wrappers, scramble effect, font preloading
├── perf/      device tiering and the degradation ladder
└── dom/       text mode, a11y mirror, nav, JSON-LD
```

Three rules the codebase depends on:

1. **Nothing that changes every frame is React state.** Per-frame values live in
   `state/frameState.ts` and are read inside `useFrame`. React re-renders only on
   section mount/unmount, tier change, and hover — single digits per journey.
2. **Every custom `ShaderMaterial` is a module-level singleton.** The renderer's
   program cache is keyed by material instance, so this is what keeps compiled
   shaders alive across section mount/unmount. A `new ShaderMaterial()` inside a
   render brings back a 200–600ms compile hitch at every section boundary.
3. **The rain is a pure function of `uTime`.** Instance buffers are uploaded once
   and never touched again; a frame costs ~15 float writes and one draw call.
4. **Nothing allocates GPU resources per mount.** Sections mount and unmount as
   you scroll, so anything built in a component's `useMemo` is rebuilt on every
   re-entry. Geometry goes through the cache in `src/objects/resources.ts`;
   anything genuinely per-instance uses `useDisposable`. Skipping this leaked
   ~30 geometries per journey — the site got measurably slower the longer you
   used it.

## Accessibility

The site is not canvas-only. `dom/SiteContentDom.tsx` renders the whole of
`site.json` as real semantic HTML — always in the DOM for screen readers and
crawlers, and visible as **Text Mode** via the toggle (persisted to
`localStorage`). Text Mode is also the no-WebGL fallback, the reduced-motion
escape hatch and the WebGL-context-loss recovery path. The 3D bundle is lazily
loaded, so Text Mode users never download three.js.

`prefers-reduced-motion` is a real mode rather than an on/off: the rain slows to
a shimmer, the camera stops flying, and scroll-velocity effects are disabled.

## Performance

Five tiers from ULTRA (90k rain instances) down to LOW, plus a REDUCED
accessibility mode. The tier is detected during the loader and can only be
demoted at runtime, never promoted past the detected ceiling — and perf
demotion floors at LOW, because REDUCED is an accessibility mode and a merely
slow GPU should not silently receive it.

`bench.html` runs the rain shader in isolation against the frame budget. Open it
on any device — including a phone — to see where that device actually lands:

```bash
npm run dev -- --host
```

Measured on Intel UHD 630 integrated graphics: 90k instances at DPR 1.5 costs
4.1ms/frame (25% of a 60fps budget). The rain is instance-bound rather than
fill-bound below ~90k at DPR 1.5, so instance count is the knob that matters.

## Dev-only affordances

`?forceraf=1` swaps rAF for a timer pump so the site runs in a hidden window,
and `?tier=ULTRA` pins the quality tier so captures are deterministic. Both are
stripped from production builds.
