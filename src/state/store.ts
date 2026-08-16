import { useSyncExternalStore } from 'react';

/**
 * ~40-line store instead of a dependency. R3F v8 bundles zustand 3 and drei 9
 * bundles zustand 5; adding a third copy for this much state is pointless.
 *
 * This holds ONLY state that changes rarely — never anything per-frame.
 * Per-frame values live in frameState.F.
 */
export interface UiState {
  tier: 'ULTRA' | 'HIGH' | 'MID' | 'LOW' | 'REDUCED';
  textMode: boolean;
  hovered: string | null;
  ready: boolean;
  webglFailed: boolean;
  section: number;
  /** id of the job whose dossier popup is open, or null. Changes only on click. */
  openCard: string | null;
  /** id of the deployed skill re-spelling the rain, or null. Changes only on click. */
  skillId: string | null;
}

let state: UiState = {
  tier: 'HIGH',
  textMode: false,
  hovered: null,
  ready: false,
  webglFailed: false,
  section: 0,
  openCard: null,
  skillId: null,
};

const listeners = new Set<() => void>();

export function setUi(patch: Partial<UiState>) {
  let changed = false;
  for (const k of Object.keys(patch) as (keyof UiState)[]) {
    if (state[k] !== patch[k]) { changed = true; break; }
  }
  if (!changed) return; // identity guard: never render for a no-op update
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getUi(): UiState {
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useUi<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

/*
 * Dev-only handle onto THIS module instance.
 *
 * Importing '/src/state/store.ts' from the devtools console can resolve to a
 * separate module instance from the one the app bundled, so poking that copy
 * updates nothing the components can see. Anything driving the real UI in a
 * test must go through this handle.
 */
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__store = { setUi, getUi };
}
