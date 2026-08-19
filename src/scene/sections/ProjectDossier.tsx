import { useEffect, useMemo, useRef } from 'react';
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
import { projects, assetUrl } from '@/content/loadContent';
import { setScrollLock } from '@/scroll/ScrollProvider';
import { getUi, setUi, useUi } from '@/state/store';
import { damp } from '@/utils/damp';

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

/**
 * Absolute, like the skills overlay's — there is no panel left to derive them
 * from. x runs from about -10 to 10 and y from -5.6 to 5.6 at the reference fov.
 */
/** The largest box a thumbnail may occupy. The picture is fitted INSIDE it. */
const THUMB = { x: -5.9, y: 0.5, w: 6.4, h: 4.4 };
const COPY = { x: -2.1, width: 11.6, title: 3.3, meta: 2.35, tech: 1.8, desc: 1.05, link: -4.4 };
/**
 * How much room the description gets before it would run into the link button.
 *
 * Measured, not guessed: the longest `details` in the data ran ten lines at
 * 4.34 units, which is why the link sits as low as it does and why the type is
 * 0.25 rather than the 0.28 the skills overlay uses for its blurb.
 */
const DESC_HEIGHT = COPY.desc - (COPY.link + 0.75);

/**
 * The description's clip box, in the TEXT'S OWN space.
 *
 * troika measures clipRect from the text's local origin, NOT from the parent —
 * the same space JobCard and AboutSection read their boundingBox in. Passing
 * the parent's coordinates put the floor at -3.65 local while the copy ran to
 * -4.34, and it quietly guillotined the last two lines of every project. It is
 * a backstop against copy longer than the layout, so it is set to exactly the
 * room available: anything that reaches it is a cue to cut the writing, not to
 * move this number.
 */
const DESC_CLIP: [number, number, number, number] = [-0.3, -DESC_HEIGHT, COPY.width + 0.3, 0.5];

const S = { title: 0.62, meta: 0.22, tech: 0.24, desc: 0.25, link: 0.26, back: 0.3 };
const LINK_ICON = 0.78;

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

/** Strips the scheme so a URL reads as a destination rather than a string. */
function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/* -------------------------------- thumbnail ------------------------------- */

/**
 * The empty state, and the only state until artwork lands under
 * public/assets/projects/. The library's own "no image" glyph on a plate rather
 * than a blank rectangle, so it reads as a slot waiting for something.
 */
function ThumbPlaceholder({ tint }: { tint: string }) {
  const items = useMemo<StackItem[]>(
    () => [{
      id: 'project-thumb',
      markId: 'ui-noimage',
      color: tint,
      position: [THUMB.x, THUMB.y + 0.35, 0.06],
      size: 1.5,
      layers: 1,
    }],
    [tint],
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
        fillOpacity={0.7}
      >
        NO PREVIEW YET
      </TerminalText>
    </>
  );
}

/* --------------------------------- overlay -------------------------------- */

export function ProjectDossier() {
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const glass = useRef<THREE.Group>(null);
  const openId = useUi((s) => s.projectId);
  const hovered = useUi((s) => s.hovered);
  const anim = useRef(0);
  /** Read by <Scrim /> at draw time, so fading it costs no re-render. */
  const glassAlpha = useRef(0);

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

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

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
    const fit = Math.min(halfH / REF_HALF_H, halfW / 10.2);
    g.scale.setScalar(fit * e);

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

  const linkItems = useMemo<StackItem[]>(
    () => [{
      id: 'project-link',
      markId: 'ui-external',
      color: linkLive ? tint.color : PALETTE.textDim,
      position: [COPY.x + LINK_ICON / 2, COPY.link, 0.06],
      size: LINK_ICON,
      layers: 4,
      spread: 0.36,
      fan: 0.19,
    }],
    [linkLive, tint.color],
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
          strength={0.82}
          tint="#07180f"
        />
      </group>

      <group ref={group} renderOrder={900}>
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
            <ThumbPlaceholder tint={tint.color} />
          )}

          {/* --------------------------- the copy -------------------------- */}
          <TerminalText
            position={[COPY.x, COPY.title, 0.06]}
            material-depthTest={false}
            anchorX="left"
            anchorY="top"
            fontSize={S.title}
            maxWidth={COPY.width}
            color={tint.glow}
            letterSpacing={0.1}
          >
            {project.title.toUpperCase()}
          </TerminalText>

          <TerminalText
            position={[COPY.x, COPY.meta, 0.06]}
            material-depthTest={false}
            anchorX="left"
            fontSize={S.meta}
            color={tint.color}
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
            color={tint.color}
            fillOpacity={0.66}
          >
            {project.tech.join('  ·  ')}
          </TerminalText>

          <TerminalText
            position={[COPY.x, COPY.desc, 0.06]}
            material-depthTest={false}
            anchorX="left"
            anchorY="top"
            fontSize={S.desc}
            lineHeight={1.55}
            maxWidth={COPY.width}
            color={tint.glow}
            fillOpacity={0.86}
            clipRect={DESC_CLIP}
          >
            {project.details || project.summary}
          </TerminalText>

          {/* --------------------- the link, as a button -------------------- */}
          {/* Same plate stack the socials use, carrying the icon library's
              external-link glyph — see src/objects/iconMarks.ts. */}
          <MarkStack items={linkItems} hoveredId={linkHot ? 'project-link' : null} />
          <TerminalText
            position={[COPY.x + LINK_ICON + 0.4, COPY.link, 0.06]}
            material-depthTest={false}
            anchorX="left"
            fontSize={S.link}
            color={linkLive ? (linkHot ? tint.glow : tint.color) : PALETTE.textDim}
            fillOpacity={linkLive ? 1 : 0.7}
            letterSpacing={0.06}
          >
            {linkLive ? `${hostOf(project.url!)}  ↗` : 'LINK NOT PUBLISHED'}
          </TerminalText>
          {linkLive && (
            <Hotspot
              id="project-link"
              position={[COPY.x + 2.4, COPY.link, 0.2]}
              size={[5.4, 1.0, 0.4]}
              onActivate={() => window.open(project.url!, '_blank', 'noopener')}
            />
          )}

          {/* --------------------------- dismiss --------------------------- */}
          <TerminalText
            position={[-8.9, 4.7, 0.06]}
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
            position={[-8.0, 4.7, 0.2]}
            size={[2.8, 0.8, 0.4]}
            onActivate={() => setUi({ projectId: null })}
          />
          </>
        )}
      </group>
    </>
  );
}
