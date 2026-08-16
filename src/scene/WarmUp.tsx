import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { World } from './World';
import type { TierSpec } from '@/perf/tier';

/**
 * Shader compilation is a 200-600ms freeze, and compileAsync only compiles
 * what is currently MOUNTED. Since sections mount lazily, that would mean a
 * fresh hitch at every section boundary.
 *
 * So: mount every section once, off-screen, compile the lot, then unmount.
 * Because every custom ShaderMaterial in this project is a module-level
 * singleton, the renderer's program cache (keyed by material instance) keeps
 * those compiled programs alive for the rest of the session.
 */
export function WarmUp({
  tier,
  avatarSrc,
  onReady,
}: {
  tier: TierSpec;
  avatarSrc: string | null;
  onReady: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const [mounted, setMounted] = useState(true);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    let cancelled = false;
    const run = async () => {
      try {
        // three r152+ uses KHR_parallel_shader_compile where available, so this
        // compiles off the main thread rather than freezing it.
        await gl.compileAsync(scene, camera);
      } catch {
        gl.compile(scene, camera);
      }
      if (cancelled) return;
      // One rendered frame before revealing, so nothing pops on first paint.
      requestAnimationFrame(() => {
        if (cancelled) return;
        setMounted(false);
        onReady();
      });
    };
    // Give the mounted-everything tree one frame to land in the scene graph.
    const id = requestAnimationFrame(() => void run());
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [gl, scene, camera, onReady]);

  if (!mounted) return null;
  return (
    <group visible={false} position={[0, -100000, 0]}>
      <World tier={tier} avatarSrc={avatarSrc} forceAll />
    </group>
  );
}
