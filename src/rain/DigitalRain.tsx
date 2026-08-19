import { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildRainAttributes, type SkillZone } from './buildRainAttributes';
import { getRainMaterial } from './RainMaterial';
import { QUAD_POSITIONS, QUAD_UVS } from './quad';
import { F } from '@/state/frameState';

interface Props {
  maxInstances: number;
  count?: number;
  curve?: THREE.Curve<THREE.Vector3> | null;
  rMin?: number;
  rMax?: number;
  spread?: number;
  skillZones?: SkillZone[];
  forceLayer?: 0 | 1 | 2;
}

/**
 * The rain. One draw call, ~15 float writes per frame, zero per-instance CPU work.
 */
export function DigitalRain({ maxInstances, count, curve = null, rMin, rMax, spread, skillZones, forceLayer }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = getRainMaterial();

  const geometry = useMemo(() => {
    const attrs = buildRainAttributes({ maxInstances, curve, rMin, rMax, spread, skillZones, forceLayer });
    const g = new THREE.InstancedBufferGeometry();

    g.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS, 2));

    g.setAttribute('aOrigin', attrs.aOrigin);
    g.setAttribute('aParams', attrs.aParams);
    g.setAttribute('aRand', attrs.aRand);
    g.setAttribute('aMeta', attrs.aMeta);
    g.instanceCount = count ?? attrs.count;

    // The bounding sphere is the whole world, so three's frustum culling can
    // only ever produce popping and never a win. Culling happens per-instance
    // in the vertex shader instead, which is where it belongs.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxInstances, curve, rMin, rMax, spread, skillZones, forceLayer]);

  useLayoutEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    m.frustumCulled = false;
    // 60k instances would destroy the raycaster. Non-negotiable.
    m.raycast = () => null;
  }, []);

  useLayoutEffect(() => {
    if (count != null) geometry.instanceCount = count;
  }, [geometry, count]);

  // The instance buffers are multi-megabyte; without this they leak on every
  // remount as the tier changes or the section graph rebuilds.
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ camera }) => {
    const u = material.uniforms;
    u.uTime.value = F.time;
    u.uScrollVel.value = F.velocity;
    (u.uCamPos.value as THREE.Vector3).copy(camera.position);
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}
