import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * GPU resource discipline.
 *
 * Sections mount and unmount as you scroll, so anything allocated in a
 * component's useMemo is re-allocated on every re-entry. Without disposal that
 * leaks GPU buffers on every pass through the journey — measured at ~30
 * geometries per cycle, which is exactly the "fine at first, worse over time"
 * failure mode.
 *
 * Two rules:
 *   1. Shared, parameterless resources are module-level singletons (see
 *      RainMaterial) — created once, never disposed, so the renderer's
 *      program cache keeps their compiled shaders alive across mount cycles.
 *   2. Anything parameterised goes through the cache or useDisposable below.
 */

/** Geometry cache keyed by shape+dimensions, so repeat mounts reuse buffers. */
const geometryCache = new Map<string, THREE.BufferGeometry>();

export function cachedPlane(width: number, height: number, wSeg = 1, hSeg = 1): THREE.PlaneGeometry {
  const key = `plane:${width}:${height}:${wSeg}:${hSeg}`;
  let g = geometryCache.get(key) as THREE.PlaneGeometry | undefined;
  if (!g) {
    g = new THREE.PlaneGeometry(width, height, wSeg, hSeg);
    geometryCache.set(key, g);
  }
  return g;
}

export function cachedBoxEdges(w: number, h: number, d: number): THREE.EdgesGeometry {
  const key = `boxedges:${w}:${h}:${d}`;
  let g = geometryCache.get(key) as THREE.EdgesGeometry | undefined;
  if (!g) {
    g = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    geometryCache.set(key, g);
  }
  return g;
}

export function cachedGeometry<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geometryCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geometryCache.set(key, g);
  }
  return g;
}

export function geometryCacheSize() {
  return geometryCache.size;
}

/**
 * For genuinely per-instance resources that cannot be cached: creates on mount
 * and disposes on unmount.
 */
export function useDisposable<T extends { dispose(): void }>(factory: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}
