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

**Everything lives in [`src/data/`](src/data)**, one file per kind of thing, so
a typo in a project cannot take out the camera keyframes.
[`site.json`](src/data/site.json) is the site itself (profile, contact, camera
journey, per-section rain), and [`skills.json`](src/data/skills.json),
[`experience.json`](src/data/experience.json),
[`projects.json`](src/data/projects.json) and
[`social.json`](src/data/social.json) each carry one list. They are assembled in
[`loadContent.ts`](src/content/loadContent.ts); types are in
[`content.types.ts`](src/content/content.types.ts).

Things that are *derived* and must not be hardcoded: years of experience (from
`profile.codingSince`), job durations and date labels (from ISO `start`/`end`),
and the Experience canyon geometry — monolith lengths are computed from the real
dates, so changing a date physically changes the world.

A job's main prose is `story`, and both modes render it: the flight card types
it out on scroll, the dossier shows all of it at once, and `SiteContentDom`
prints it as paragraphs. Everything else about a job is structured (`role`,
`location`, dates, `tech`), so the two modes cannot describe the same job in
different words.

The one exception is `blurb`: a single short line that renders ONLY on the About
card's current-role tile, which is far too small for the story. Keep it to about
140 characters — the tile gives it four lines at 0.19 and nothing clips it.

Still to fill in: the GitHub, X and YouTube `socials[].url`, and the
`projects[].url` links. Anything unpublished is `null` / `placeholder: true`,
and every section is designed to look deliberate while empty.

Artwork goes under `public/assets/`. A `projects[].thumbnail` is drawn by
[`ProjectThumb`](src/objects/ProjectThumb.tsx) in both places a project appears,
so the wall and the open dossier cannot show it differently: the wall crops to
its fixed frame, and the dossier sizes its plane to the picture's own aspect so
nothing is cut or letterboxed. Screenshots are shown straight and graded toward
the world's palette rather than run through `AsciiImage` — glyph-quantising a
1900px UI screenshot destroys the thing it was added to show. `grade` on that
component is the dial if it wants to be more or less green.

No list here is count-limited any more. The About bento derives its skill grid
from `skills.length` (it was a hardcoded 3×3, and the tenth skill indexed off
the end of the row array and positioned every mark from there on at NaN), and
the Projects camera path is generated from the project count.

A new skill id does still want an entry in [`brand.ts`](src/text/brand.ts):
`TECH_BRAND`, not `skills[].color`, is what the marks actually render from, and
a missing id falls back to house green. Mind the additive floor noted in that
file — a black-on-white brand like Next.js, GitHub or Kafka has to be inverted
to its own dark-mode foreground or the mark comes out invisible.

`projects` has no such limit. Adding one lengthens the journey instead: the
camera path through the gallery is generated from the count, and the section
takes the scroll it needs, so three projects run the site at ~1790vh and six at
~2080vh. Every other section keeps exactly the scroll it had. See
[`projectsPath.mjs`](src/camera/projectsPath.mjs).

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
and both repositioned **and rescaled** every frame from the camera's current fov.
The fov is keyframed 54→78 across the journey, and the rail sits at a fixed
distance in front of the camera, so its apparent size is `worldSize / halfH`:
pinning the position alone left it swelling to 67% of viewport height at the
narrow end and shrinking to 42% at the wide end. Scaling with `halfH` against a
reference fov cancels that, and it now holds one size the whole way down.
`src/dom/SrNav.tsx` is the real keyboard/screen-reader navigation.

## Interaction

Three things respond to clicks, and all are worth knowing about:

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
- **Projects** — the camera does not fly past this wall, it tracks along it.
  One continuous horizontal glide at constant speed, wall square-on, every
  project passing through dead centre of frame on the way; the glide speed is
  derived from how long each project should own the centre (`CENTRED_VH`).
  Two earlier versions stopped at each frame and both read as judder — the
  motion was accelerate, stop, accelerate, stop — so there are no stops at all.
  Leaving, the camera carries ~10 units on past the last project before the
  path begins to turn, then banks up and away into Contact, and the aim hands
  over from the wall to Contact's own as it goes. Keyframes are sampled off a
  speed profile rather than authored, because `remap()` is linear across each
  interval and therefore keyframe spacing *is* the speed graph — and the
  spacing has to be continuous across the seams, so both tapers grow
  geometrically out of the glide's own spacing toward the authored journey's
  much coarser keying. Measured on the shipped curve: 0% speed variation across
  the glide, zero direction reversals, zero vertical wobble, and no aim flip on
  the way out. `check:journey` asserts every project holds screen centre for
  18vh+.
  Clicking a frame opens its dossier, built to the SKILLS overlay's aesthetic
  rather than the job card's: unframed, tinted in that frame's own colour,
  thumbnail slot left and type right, with the link out drawn as one of the
  same plate-stack buttons the socials use. Scroll is locked while it is open
  (`setScrollLock`) — safe here, unlike in Experience, because the overlay is
  modal and the journey is meant to hold. Behind it sits
  [`Scrim`](src/objects/Scrim.tsx): frosted glass, not a real blur. Blurring
  means a render target and a second pass, and `Effects.tsx` already rules that
  class of effect out on cost; muting the rain's contrast to a fifth gets the
  same read for one quad, because bloom has already smeared every point of it.

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
   Per-instance values are pushed in `onBeforeRender`, and that block **must**
   end with `commitUniforms(material)` — three skips the uniform upload when the
   material has not changed between draws, so without it the second and third
   object drawn render with the first one's values. See
   [`resources.ts`](src/objects/resources.ts) for the full account.
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
