import { getUi, setUi, useUi } from './store';

/**
 * The one place the mobile signal is decided.
 *
 * "Mobile" here means PORTRAIT — viewport height greater than width — and
 * nothing else. That is the honest predicate for this site: the camera's fov is
 * VERTICAL, so a narrow frame leaves halfH untouched and collapses halfW alone.
 * Every layout problem on a phone is that one fact, and every layout problem on
 * a landscape phone is nobody's.
 *
 * matchMedia rather than window.innerWidth/innerHeight, because the CSS asks
 * the same question in `@media (orientation: portrait)` and the two must never
 * disagree — least of all mid-transition on iOS, where innerHeight moves ~80px
 * as the URL bar collapses while the CSS orientation does not flip at all.
 */

const MQ = '(orientation: portrait)';

/**
 * env() is only readable from CSS, so base.css parks it on <html> as --sat and
 * this reads it back. Needed because the canvas is full-bleed under
 * `viewport-fit=cover`, so the nav bar would otherwise sit under a notch.
 */
function readSafeTop(): number {
  if (typeof document === 'undefined') return 0;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--sat');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

let installed = false;

/**
 * Call once from main.tsx — NOT from Stage. Stage is lazy and Text Mode never
 * mounts it, but Text Mode needs this flag too.
 */
export function installViewportWatch(): void {
  if (installed || typeof matchMedia === 'undefined') return;
  installed = true;

  const mql = matchMedia(MQ);
  const sync = () => setUi({ portrait: mql.matches, safeTop: readSafeTop() });

  sync();

  // addEventListener('change') is the modern form; addListener is Safari < 14.
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', sync);
  else mql.addListener(sync);

  /**
   * Belt and braces: older iOS reports the media query late — sometimes a frame
   * or two after orientationchange — and the safe-area insets swap at the same
   * moment. setUi's identity guard makes the duplicate call free.
   */
  window.addEventListener('orientationchange', () => {
    sync();
    setTimeout(sync, 250);
  });
}

/** Subscribe a component to the orientation. One re-render per real rotation. */
export const usePortrait = (): boolean => useUi((s) => s.portrait);

/** For module-level code and useFrame closures: a plain read, no subscription. */
export const isPortrait = (): boolean => getUi().portrait;
