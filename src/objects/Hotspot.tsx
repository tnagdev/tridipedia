import { useRef } from 'react';
import * as THREE from 'three';
import { setUi, useUi } from '@/state/store';

/**
 * Pointer input for a 3D object.
 *
 * Deliberately NOT the abeto DOM-proxy pattern: those proxy divs exist because
 * vanilla three has no reconciler, so hover and click require projecting to
 * screen space every frame and parking a real div there. R3F already gives us
 * a managed raycaster. Keyboard and screen-reader semantics — the one thing
 * raycasting genuinely cannot provide — live in A11yLayer, and need no
 * per-frame syncing at all.
 */
export function Hotspot({
  id,
  position,
  size = [3, 3, 3],
  onActivate,
}: {
  id: string;
  position: [number, number, number];
  size?: [number, number, number];
  onActivate?: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const hovered = useUi((s) => s.hovered) === id;

  return (
    <mesh
      ref={ref}
      position={position}
      visible={false}
      onPointerOver={(e) => {
        e.stopPropagation();
        setUi({ hovered: id });
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setUi({ hovered: null });
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onActivate?.();
      }}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={hovered ? 0.001 : 0} />
    </mesh>
  );
}
