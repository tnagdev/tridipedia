import { useEffect } from 'react';
import { SiteContentDom } from './SiteContentDom';
import { profile } from '@/content/loadContent';
import { useUi, setUi } from '@/state/store';

const KEY = 'tridipedia:textmode';

export function readStoredTextMode(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setTextMode(on: boolean) {
  setUi({ textMode: on });
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* private mode — the toggle still works for this session */
  }
}

/** A styled plain-terminal rendering of the whole site. Zero WebGL. */
export function TextMode() {
  useEffect(() => {
    document.body.classList.add('is-textmode');
    return () => document.body.classList.remove('is-textmode');
  }, []);

  return (
    <div className="textmode-root">
      <pre className="textmode-brand" aria-hidden="true">
        {`> ${profile.brand.toUpperCase()} :: TEXT MODE`}
      </pre>
      <SiteContentDom variant="visible" />
      <footer className="textmode-foot">
        <span aria-hidden="true">{'─'.repeat(40)}</span>
      </footer>
    </div>
  );
}

/** The toggle. A real button, always reachable, first in the tab order after skip. */
export function TextModeToggle() {
  const on = useUi((s) => s.textMode);
  const failed = useUi((s) => s.webglFailed);
  if (failed) return null; // no point offering a 3D mode that cannot run
  return (
    <button
      type="button"
      className="mode-toggle"
      aria-pressed={on}
      onClick={() => setTextMode(!on)}
      title={on ? 'Return to the 3D experience' : 'Read this site as plain text'}
    >
      {on ? '◈ 3D MODE' : '⌨ TEXT MODE'}
    </button>
  );
}
