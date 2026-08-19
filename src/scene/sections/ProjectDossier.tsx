import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ProjectThumb, useThumbnail } from '@/objects/ProjectThumb';
import { HudBracket } from '@/objects/HudBracket';
import { MarkStack, type StackItem } from '@/objects/MarkStack';
import { Scrim } from '@/objects/Scrim';
import { Hotspot } from '@/objects/Hotspot';
import { TerminalText } from '@/text/TerminalText';
import { PALETTE } from '@/text/palette';
import { WALL, projectX } from '@/camera/projectsPath.mjs';
import { projects, assetUrl, hostOf } from '@/content/loadContent';
import { setScrollLock } from '@/scroll/ScrollProvider';
import { getUi, setUi, useUi } from '@/state/store';
import { damp } from '@/utils/damp';
import { usePortrait } from '@/state/viewport';
import { navReserve, NAV_Z, REF_FOV as NAV_REF_FOV } from '@/scene/navMetrics';

/**
 * A project, opened.
 *
 * Built to the SKILLS OVERLAY's aesthetic, not the job dossier's: deliberately
 * UNFRAMED. No panel, no chrome, no box around the box — a thumbnail slot on
 * the left, a column of type on the right, and the world left visible behind
 * them. A frame here only competes with the artwork it is supposed to present,
 * which is the same reason the skill overlay dropped its own.
 *
 * Everything is tinted in the project's OWN colour, the one its frame carries
 * on the wall, so opening a frame reads as that frame growing rather than as a
 * generic dialog appearing.
 *
 * CAMERA-RELATIVE, COMPUTED IN useFrame rather than parented to the camera.
 * Nav3D already attaches a group to the camera object via <primitive>, and a
 * second parent on the same Object3D fights over one children array in R3F v8.
 *
 * IT DOCKS IN FRONT OF THE WALL, NOT BEYOND IT. The gallery camera tracks 11.5
 * units off the project wall, so anything docked further out would be behind
 * the frames it is describing. At 11 it is in clear air — and since the rain is
 * depthWrite:false and nothing else sits between, this needs none of the
 * depthTest juggling the skills overlay does from inside its lattice.
 */

/* ---------------------------------- tint ---------------------------------- */

/**
 * One entry per frame colour on the wall, exported so ProjectsSection can paint
 * the frames from the same list. Two copies of `['#00d93f', '#4FD1FF', ...]`
 * would drift the moment either moved, and a popup in a different colour from
 * the frame that opened it looks like a bug.
 */
export const PROJECT_TINT = [
  { color: PALETTE.rain, glow: PALETTE.rainHead },
  { color: '#4FD1FF', glow: '#A8E9FF' },
  { color: '#FFC14F', glow: '#FFE3A8' },
] as const;

export const projectTint = (i: number) => PROJECT_TINT[i % PROJECT_TINT.length];

/* --------------------------------- layout --------------------------------- */

/** How far in front of the camera the overlay sits, and how big it is there. */
const DIST = 11;
/** The fov these coordinates were laid out at. Anything else rescales to match. */
const REF_FOV = 54;
const REF_HALF_H = Math.tan((REF_FOV * Math.PI) / 360) * DIST;
/** Frustum half-height at the NAV's own plane — navReserve answers in fractions. */
const navHalfH = Math.tan((NAV_REF_FOV * Math.PI) / 360) * Math.abs(NAV_Z);

/**
 * Absolute, like the skills overlay's — there is no panel left to derive them
 * from. Landscape x runs from about -10 to 10 and y from -5.6 to 5.6 at the
 * reference fov.
 *
 * Portrait is a genuine reflow rather than the same thing shrunk: at DIST 11 a
 * phone frustum is 2.6 units of half-width against the 10.2 this composition
 * wants, and the old unclamped `fit` duly drew the whole dossier at a QUARTER
 * size — technically on screen, practically unreadable. Turned upright the
 * thumbnail goes over the copy, the link takes its own row, and the description
 * gets most of the height a phone has going spare.
 *
 * Both variants are built once at module load. The landscape branch is the set
 * of numbers that was always here, moved rather than re-derived.
 */
function buildLayout(portrait: boolean) {
  if (!portrait) {
    const THUMB = { x: -5.9, y: 0.5, w: 6.4, h: 4.4 };
    const COPY = { x: -2.1, width: 11.6, title: 3.3, meta: 2.35, tech: 1.8, desc: 1.05, bottom: -4.9 };
    /**
     * How much room the description gets before it runs out of overlay.
     *
     * Measured, not guessed: the longest `details` in the data ran ten lines at
     * 4.34 units, which is why the type is 0.25 rather than the 0.28 the skills
     * overlay uses for its blurb.
     */
    const descHeight = COPY.desc - COPY.bottom;
    return {
      THUMB,
      COPY,
      /**
       * The link rides BESIDE the title rather than in a row of its own at the
       * foot of the copy, so the destination is read as part of the project's
       * name. Its x is measured from the title at sync time — see `placeLink`.
       */
      linkGap: 0.55,
      linkMax: 4.8,
      /**
       * Unset in landscape, as it always was: the longest meta line is 7.3
       * against an 11.6-wide column and has never come close to wrapping.
       */
      metaMax: undefined as number | undefined,
      /**
       * The link's resting colour. Landscape keeps the dimmer tint, which is
       * what gives the pointer somewhere to go; portrait has no pointer, so it
       * spends that contrast on being readable instead.
       */
      linkIdle: 'color' as 'color' | 'glow',
      /** null = docked beside the title by placeLink. */
      linkRow: null as [number, number] | null,
      /** The title yields room to the link sitting next to it. */
      titleMax: 11.6 - 4.8,
      descHeight,
      descLine: 1.55,
      /**
       * The description's clip box, in the TEXT'S OWN space.
       *
       * troika measures clipRect from the text's local origin, NOT from the
       * parent. Passing the parent's coordinates put the floor at -3.65 local
       * while the copy ran to -4.34, and it quietly guillotined the last two
       * lines of every project. Derived here, alongside the layout it belongs
       * to, so the two can never be edited apart.
       */
      descClip: [-0.3, -descHeight, COPY.width + 0.3, 0.5] as [number, number, number, number],
      S: { title: 0.62, meta: 0.22, tech: 0.24, desc: 0.25, link: 0.26, back: 0.3 },
      linkIcon: 0.78,
      back: [-8.9, 4.7] as [number, number],
      backHit: [-8.0, 4.7] as [number, number],
      backHitSize: [2.8, 0.8, 0.4] as [number, number, number],
      /** Half-extent the fit is solved against. */
      fitHalfW: 10.2,
      /** Portrait only: total content height, and where its centre sits. */
      contentH: null as number | null,
      contentCentre: 0,
    };
  }

  const THUMB = { x: 0, y: 2.75, w: 4.8, h: 2.2 };

  /**
   * Every row DERIVED from the one above it, rather than typed as a column of
   * absolute y's that have to be kept consistent by hand.
   *
   * The link row is why. It is the only row whose height is set by a plate
   * rather than by a line of type — the icon is 0.62 where the text beside it is
   * 0.22 — so it reaches half an icon above and below its own centre, and
   * placing it by eye put its top edge 0.05 into the title's descenders. Written
   * this way the gaps are the things chosen and the collisions cannot come back.
   */
  const S_P = { title: 0.42, meta: 0.17, tech: 0.19, desc: 0.185, link: 0.22, back: 0.26 };
  const LINK_ICON_P = 0.62;
  const title = 1.30;
  const linkY = title - S_P.title - 0.16 - LINK_ICON_P / 2;
  // The longest meta wraps to two lines; the row below has to clear both.
  const metaTop = linkY - LINK_ICON_P / 2 - 0.18;
  const techY = metaTop - S_P.meta * 1.4 * 2 - 0.10 - S_P.tech / 2;
  const COPY = {
    x: -2.4,
    width: 4.8,
    title,
    meta: metaTop,
    tech: techY,
    desc: techY - S_P.tech / 2 - 0.22,
    bottom: -5.50,
  };
  const descHeight = COPY.desc - COPY.bottom;
  return {
    THUMB,
    COPY,
    linkGap: 0.4,
    linkMax: 4.0,
    /* REQUIRED here — see the band COPY.meta..COPY.tech opened up for it. */
    metaMax: COPY.width as number | undefined,
    linkIdle: 'glow' as 'color' | 'glow',
    // Its own row: the assembly alone is wider than the whole portrait column,
    // so there is nothing for placeLink to dock it beside.
    linkRow: [COPY.x, linkY] as [number, number] | null,
    titleMax: COPY.width,
    descHeight,
    /*
     * 582 characters — the longest `details` in the data — wrap to about 17
     * lines in a 4.8-wide column. At the landscape 1.55 that is 5.5 units
     * against a 4.5 budget and the last lines would be cut; 1.4 is the tighter
     * leading a narrow measure wants anyway.
     */
    descLine: 1.4,
    descClip: [-0.3, -descHeight, COPY.width + 0.3, 0.5] as [number, number, number, number],
    S: S_P,
    linkIcon: LINK_ICON_P,
    back: [-2.4, 4.30] as [number, number],
    backHit: [-1.35, 4.30] as [number, number],
    backHitSize: [3.0, 1.0, 0.4] as [number, number, number],
    // The copy column's own half-width plus a hair of margin.
    fitHalfW: 2.45,
    /*
     * Solved against the band BELOW the top bar rather than against a symmetric
     * half-height, and then centred in it — the content is not symmetric about
     * the camera axis and pretending it is threw away a whole 4% of scale while
     * still pushing BACK up under the bar.
     */
    contentH: (4.30 + 0.26 * 0.5) - COPY.bottom as number | null,
    contentCentre: ((4.30 + 0.26 * 0.5) + COPY.bottom) * 0.5,
  };
}

const LAYOUT = { landscape: buildLayout(false), portrait: buildLayout(true) };
type Layout = ReturnType<typeof buildLayout>;

/**
 * The glass behind it all, sized generously and then scaled to cover whatever
 * frustum it finds. Its own group takes NO part in the open animation's scale —
 * a backdrop that grows out of a point is a shape appearing, not a veil
 * lowering — so it only ever fades, and the content scales over it.
 */
const SCRIM = { w: 44, h: 30 };

const FWD = new THREE.Vector3();
const PARK = new THREE.Vector3();
const DOCK = new THREE.Vector3();

/* -------------------------------- thumbnail ------------------------------- */

/**
 * The empty state, and the only state until artwork lands under
 * public/assets/projects/. The library's own "no image" glyph on a plate rather
 * than a blank rectangle, so it reads as a slot waiting for something.
 */
function ThumbPlaceholder({ tint, lay, markFit }: { tint: string; lay: Layout; markFit: number }) {
  const { THUMB } = lay;
  const items = useMemo<StackItem[]>(
    () => [{
      id: 'project-thumb',
      markId: 'ui-noimage',
      color: tint,
      position: [THUMB.x, THUMB.y + 0.35, 0.06],
      // markFit: a MarkStack's quads are sized in VIEW space and ignore the
      // parent scale, so the factor has to be baked into the size instead.
      size: 1.5 * markFit,
      layers: 1,
    }],
    [tint, THUMB, markFit],
  );
  return (
    <>
      <MarkStack items={items} opacity={0.55} />
      <TerminalText
        position={[THUMB.x, THUMB.y - 1.15, 0.06]}
        material-depthTest={false}
        fontSize={0.22}
        color={PALETTE.textDim}
        letterSpacing={0.2}
        fillOpacity={0.88}
      >
        NO PREVIEW YET
      </TerminalText>
    </>
  );
}

/* --------------------------------- overlay -------------------------------- */

export function ProjectDossier() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const portrait = usePortrait();
  const safeTop = useUi((s) => s.safeTop);
  const lay = portrait ? LAYOUT.portrait : LAYOUT.landscape;
  const { THUMB, COPY, S } = lay;

  /**
   * The factor a MarkStack's plates need baked into their SIZE.
   *
   * MarkStack expands its quads in view space — `mv.xy += position.xy * size`
   * happens after modelViewMatrix — so the group scale below moves the plates
   * without shrinking them. In landscape the discrepancy is about 2%, invisible,
   * and it is left exactly as it was; in portrait `fit` gets down to a quarter
   * and the link icon would draw four times its own box.
   *
   * Computed from the AUTHORED fov rather than the live one so it does not need
   * a per-frame re-render: the projects leg of the journey holds fov 54, which
   * is that authored value, so the two agree wherever this is actually visible.
   */
  const markFit = useMemo(() => {
    if (!portrait) return 1;
    const halfW = REF_HALF_H * (size.width / Math.max(1, size.height));
    return Math.min(1, (halfW * 0.94) / lay.fitHalfW);
  }, [portrait, size.width, size.height, lay]);
  const group = useRef<THREE.Group>(null);
  const glass = useRef<THREE.Group>(null);
  const openId = useUi((s) => s.projectId);
  const hovered = useUi((s) => s.hovered);
  const anim = useRef(0);
  /** Read by <Scrim /> at draw time, so fading it costs no re-render. */
  const glassAlpha = useRef(0);
  /** The link's row, parked beside the title once the title has measured itself. */
  const linkRow = useRef<THREE.Group>(null);
  /** Everything the layout owns, shifted clear of the portrait top bar. */
  const contentRef = useRef<THREE.Group>(null);
  const linkPos = useRef<[number, number]>(lay.linkRow ?? [COPY.x, COPY.title]);

  /**
   * Held after closing so the overlay plays its exit with the right copy still
   * in it, instead of blanking mid-flight. Same trick as the skills overlay.
   */
  const live = useMemo(() => {
    const i = projects.findIndex((p) => p.id === openId);
    return i < 0 ? null : { project: projects[i], index: i };
  }, [openId]);
  const last = useRef(live);
  if (live) last.current = live;
  const shown = live ?? last.current ?? { project: projects[0], index: 0 };
  const project = shown.project;
  const tint = projectTint(shown.index);

  // Modal: the journey holds where it is until this closes.
  useEffect(() => {
    setScrollLock(openId !== null);
    return () => setScrollLock(false);
  }, [openId]);

  // Opening unmounts the wall's hotspots, and a hotspot that vanishes under the
  // pointer never fires its pointer-out — the hover would stay stuck on the
  // frame that opened the overlay for as long as it was up.
  useEffect(() => {
    if (openId && getUi().hovered?.startsWith('project:')) setUi({ hovered: null });
  }, [openId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && getUi().projectId) setUi({ projectId: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /**
   * Docks the link beside the title, from the title's OWN measured width.
   *
   * troika lays text out asynchronously, so the width is not knowable at render
   * time — this runs on its sync callback, which fires once per title change
   * rather than per frame. `visibleBounds` is used over `blockBounds` because it
   * is tight to the painted glyphs: blockBounds carries the trailing
   * letterSpacing, which at 0.1em on a 0.62 title is a visible extra gap.
   *
   * Both are in the text mesh's own space, and the title's anchors are
   * left/top, so x is simply its right edge and y the optical centre of the
   * caps — which is what the link's own `middle` anchor lines up against.
   */
  const placeLink = useCallback((t: { textRenderInfo?: { visibleBounds?: number[] } }) => {
    /*
     * Portrait gives the link a row of its own, so there is nothing to measure
     * against: the assembly needs 4 units and the whole column is 4.8. An
     * explicit early return rather than letting the clamp below pin it to the
     * column's right edge, which would read as a bug rather than a layout.
     */
    if (lay.linkRow) {
      linkPos.current[0] = lay.linkRow[0];
      linkPos.current[1] = lay.linkRow[1];
      return;
    }
    const vb = t?.textRenderInfo?.visibleBounds;
    if (!vb) return;
    const [, minY, maxX, maxY] = vb;
    linkPos.current[0] = Math.min(COPY.x + maxX + lay.linkGap, COPY.x + COPY.width - lay.linkMax);
    linkPos.current[1] = COPY.title + (minY + maxY) / 2;
  }, [lay, COPY]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    // Applied here rather than in placeLink: the group's ref is not guaranteed
    // to be attached when troika syncs, and this costs one vector write.
    linkRow.current?.position.set(linkPos.current[0], linkPos.current[1], 0);

    // Leaves a shade slower than it arrives, so the exit reads as deliberate.
    anim.current = damp(anim.current, openId ? 1 : 0, openId ? 8 : 6, delta);
    g.visible = anim.current > 0.002;
    if (!g.visible) return;

    const cam = camera as THREE.PerspectiveCamera;
    camera.getWorldDirection(FWD);
    DOCK.copy(camera.position).addScaledVector(FWD, DIST);
    // Flies in from the frame it belongs to, the way a skill flies in from its
    // mark, so the popup has an origin instead of appearing from nowhere.
    PARK.set(projectX(shown.index, projects.length), WALL.y, WALL.z);

    const e = anim.current * anim.current * (3 - 2 * anim.current); // smoothstep
    g.position.lerpVectors(PARK, DOCK, e);
    g.quaternion.copy(camera.quaternion);

    // One size on screen whatever the fov is doing. Scaled from ZERO, not from
    // a residual: damping only approaches its target, so a floor would leave
    // the overlay visibly popping out of existence at the end of its exit.
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5) * DIST;
    const halfW = halfH * cam.aspect;
    // The bar's band, measured at the NAV's plane and re-expressed here.
    const navTop = portrait
      ? navReserve({
        portrait,
        sizeW: size.width,
        halfW: navHalfH * cam.aspect,
        halfH: navHalfH,
        safeTopWorld: (safeTop * 2 * navHalfH) / Math.max(1, size.height),
      }).top * (halfH * 2)
      : 0;
    /**
     * Landscape: hold one apparent size, clamped so the composition never runs
     * off a narrow frame. Portrait: the layout is authored to FIT rather than
     * scaled down to fit, so this only ever shrinks it on a device narrower
     * than the one it was solved for — and it reserves the top bar's band.
     */
    const fit = lay.contentH
      ? Math.min(1, (halfW * 0.94) / lay.fitHalfW, (2 * halfH - navTop) / lay.contentH)
      : Math.min(halfH / REF_HALF_H, halfW / lay.fitHalfW);
    g.scale.setScalar(fit * e);

    /**
     * Centre the content in the band the top bar leaves, rather than on the
     * camera axis. Inside the scaled group, so the local offset is divided by
     * `fit` to come out as the screen-space shift asked for. Landscape has no
     * band and a centred composition, so both terms are zero and this is
     * exactly the identity it was before.
     */
    const inner = contentRef.current;
    if (inner) inner.position.y = fit > 1e-4 ? -navTop * 0.5 / fit - lay.contentCentre : 0;

    // The glass sits square to the camera at the same distance, but sized to
    // COVER the frustum rather than to match the layout — on a portrait phone
    // `fit` is a quarter, and a backdrop scaled by that leaves most of the
    // screen unveiled.
    const q = glass.current;
    if (q) {
      glassAlpha.current = e;
      q.visible = e > 0.002;
      q.position.copy(DOCK);
      q.quaternion.copy(camera.quaternion);
      q.scale.setScalar(Math.max((2 * halfW) / SCRIM.w, (2 * halfH) / SCRIM.h) * 1.05);
    }
  });

  const linkLive = !!project.url;
  const linkHot = hovered === 'project-link';
  const backHot = hovered === 'project-back';
  const thumb = useThumbnail(assetUrl(project.thumbnail));

  /**
   * The slot takes the PICTURE'S shape, rather than the picture being made to
   * take the slot's.
   *
   * A fixed slot has to either crop or letterbox, and these screenshots are
   * 2.2:1 going into a box nearer 1.4:1 — cropping loses a third of the width,
   * and fitting inside left 37% of the box as empty bars. Sizing the plane to
   * the image's own aspect inside a maximum box does neither. The wall frames
   * still crop, because there a row of identically sized frames matters more
   * than any one of them being uncut.
   */
  const thumbBox = useMemo(() => {
    const img = thumb?.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 16 / 9;
    const w = Math.min(THUMB.w, THUMB.h * aspect);
    return { w, h: w / aspect };
  }, [thumb]);

  /**
   * Local to <group ref={linkRow} />, not to the overlay — the row is what
   * moves, so the assembly inside it is authored from its own origin.
   */
  const linkItems = useMemo<StackItem[]>(
    () => [{
      id: 'project-link',
      markId: 'ui-external',
      color: linkLive ? tint[lay.linkIdle] : PALETTE.textDim,
      position: [lay.linkIcon / 2, 0, 0.06],
      size: lay.linkIcon * markFit,
      layers: 4,
      spread: 0.36,
      fan: 0.19,
    }],
    [linkLive, tint, lay, markFit],
  );

  /*
   * ALWAYS render the same single <group>, contents conditional. Returning a
   * different element when closed reconciles to the SAME Object3D, and a prop
   * that disappears between renders is never reset — `visible` would stay false
   * forever once the closed branch had rendered. Visibility is useFrame's alone.
   */
  return (
    <>
      <group ref={glass} visible={false}>
        <Scrim
          width={SCRIM.w}
          height={SCRIM.h}
          opacityRef={glassAlpha}
          strength={0.94}
          tint="#07180f"
        />
      </group>

      <group ref={group} renderOrder={900}>
        {/*
          renderOrder REPEATED, and it is load-bearing.

          three reads a Group's renderOrder as the render list's `groupOrder`,
          which is compared BEFORE any object's own renderOrder — and a Group
          inherits nothing, so a nested group at the default 0 drops everything
          under it back to group 0. That put this whole dossier in the same
          group as the scrim, where the scrim's own 880 beat the copy's 0 and
          painted the glass straight over the text. Measured: the description's
          peak brightness fell by two thirds.
        */}
        <group ref={contentRef} renderOrder={900}>
        {project && (
        <>
          {/* ------------------------- thumbnail ------------------------- */}
          {/* Brackets, not a frame: the site's own language for "this is a
              scanned thing", and it costs one quad instead of a panel. */}
          <HudBracket
            width={(thumb ? thumbBox.w : THUMB.w) + 0.7}
            height={(thumb ? thumbBox.h : THUMB.h) + 0.7}
            position={[THUMB.x, THUMB.y, 0]}
            lock={1}
            opacity={0.55}
            color={tint.color}
          />
          {thumb ? (
            <ProjectThumb
              texture={thumb}
              width={thumbBox.w}
              height={thumbBox.h}
              tint={tint.color}
              position={[THUMB.x, THUMB.y, 0.04]}
            />
          ) : (
            <ThumbPlaceholder tint={tint.color} lay={lay} markFit={markFit} />
          )}

          {/* --------------------------- the copy -------------------------- */}
          <TerminalText
            position={[COPY.x, COPY.title, 0.06]}
            material-depthTest={false}
            anchorX="left"
            anchorY="top"
            fontSize={S.title}
            maxWidth={lay.titleMax}
            color={tint.glow}
            letterSpacing={0.1}
            onSync={placeLink}
          >
            {project.title.toUpperCase()}
          </TerminalText>

          {/* ------------------- the link, beside the title ------------------ */}
          {/* Same plate stack the socials use, carrying the icon library's
              external-link glyph — see src/objects/iconMarks.ts. */}
          {/*
            renderOrder again, for the same reason as the group above: a nested
            Group inherits no groupOrder, so leaving this at the default 0 put
            the link — icon and host alike — back in the scrim's group and let
            the glass draw over it. Measured, it rendered at half the brightness
            of every other row in the panel.
          */}
          <group ref={linkRow} renderOrder={900}>
            <MarkStack items={linkItems} hoveredId={linkHot ? 'project-link' : null} />
            <TerminalText
              position={[lay.linkIcon + 0.4, 0, 0.06]}
              material-depthTest={false}
              anchorX="left"
              fontSize={S.link}
              color={linkLive ? (linkHot ? tint.glow : tint[lay.linkIdle]) : PALETTE.textDim}
              fillOpacity={linkLive ? 1 : 0.85}
              letterSpacing={0.06}
            >
              {linkLive ? `${hostOf(project.url!)}  ↗` : 'LINK NOT PUBLISHED'}
            </TerminalText>
            {linkLive && (
              <Hotspot
                id="project-link"
                position={[lay.linkMax / 2, 0, 0.2]}
                size={[lay.linkMax, 0.9, 0.4]}
                onActivate={() => window.open(project.url!, '_blank', 'noopener')}
              />
            )}
          </group>

          <TerminalText
            position={[COPY.x, COPY.meta, 0.06]}
            material-depthTest={false}
            anchorX="left"
            {...(lay.metaMax
              // Portrait only. A one-line meta is anchored at its middle, as it
              // always was; a wrapping one has to grow DOWNWARD from a fixed
              // top, or the second line would push the first up into the title.
              ? { anchorY: 'top' as const, maxWidth: lay.metaMax, lineHeight: 1.4 }
              : {})}
            fontSize={S.meta}
            color={tint.glow}
            letterSpacing={0.06}
          >
            {[project.year, project.role].filter(Boolean).join('   ·   ').toUpperCase()}
          </TerminalText>

          <TerminalText
            position={[COPY.x, COPY.tech, 0.06]}
            material-depthTest={false}
            anchorX="left"
            fontSize={S.tech}
            maxWidth={COPY.width}
            color={tint.glow}
            fillOpacity={0.92}
          >
            {project.tech.join('  ·  ')}
          </TerminalText>

          <TerminalText
            position={[COPY.x, COPY.desc, 0.06]}
            material-depthTest={false}
            anchorX="left"
            anchorY="top"
            fontSize={S.desc}
            lineHeight={lay.descLine}
            maxWidth={COPY.width}
            color={tint.glow}
            fillOpacity={1}
            clipRect={lay.descClip}
          >
            {project.details || project.summary}
          </TerminalText>

          {/* --------------------------- dismiss --------------------------- */}
          <TerminalText
            position={[lay.back[0], lay.back[1], 0.06]}
            material-depthTest={false}
            anchorX="left"
            fontSize={S.back}
            color={backHot ? tint.glow : PALETTE.textDim}
            letterSpacing={0.14}
          >
            ← BACK
          </TerminalText>
          <Hotspot
            id="project-back"
            position={[lay.backHit[0], lay.backHit[1], 0.2]}
            size={lay.backHitSize}
            onActivate={() => setUi({ projectId: null })}
          />
          </>
        )}
        </group>
      </group>
    </>
  );
}
