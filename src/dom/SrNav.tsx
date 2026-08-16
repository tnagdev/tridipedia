import { SECTIONS } from '@/state/sections';
import { scrollToProgress } from '@/scroll/ScrollProvider';
import { useUi } from '@/state/store';

/**
 * The keyboard and screen-reader navigation.
 *
 * The visible navigation is rendered in WebGL (Nav3D), which is invisible to
 * assistive technology and unreachable by keyboard. This is the real one: a
 * proper <nav> with real buttons, visually hidden until focused, at which point
 * it becomes a terminal-styled chip so sighted keyboard users can see where
 * they are.
 */
export function SrNav() {
  const current = useUi((s) => s.section);
  return (
    <nav className="sr-nav" aria-label="Sections">
      <ol>
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              aria-current={i === current ? 'true' : undefined}
              onClick={() => {
                history.replaceState(null, '', `#${s.id}`);
                scrollToProgress(s.range[0] + 0.012, { duration: 2.2 });
              }}
            >
              {s.label}
              {i === current ? ' (current)' : ''}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
