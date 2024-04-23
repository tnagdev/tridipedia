import * as THREE from 'three';
import { useRef, useState, useMemo, useEffect, Suspense, RefAttributes, Ref, ReactNode, MutableRefObject } from 'react'
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber'
import { Billboard, Text, TrackballControls, Image } from '@react-three/drei';
import Colors from 'tailwindcss/colors';

function Word({ data, ...props }: any) {
  const color = new THREE.Color()
  const fontProps = { fontSize: 2.5, letterSpacing: -0.05, lineHeight: 1, 'material-toneMapped': false }
  const textRef: Ref<any> = useRef()
  const imageRef: Ref<any> = useRef()
  const [hovered, setHovered] = useState(false)
  const over = (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), setHovered(true))
  const out = () => setHovered(false)
  // Change the mouse cursor on hover¨
  useEffect(() => {
    if (hovered && typeof window !== undefined) document.body.style.cursor = 'pointer'
    return () => {
      if (typeof window !== undefined)
        document.body.style.cursor = 'auto'
    }
  }, [hovered])
  // useFrame(() => {
  //   textRef.current?.material.color.lerp(color.set(hovered ? '#fa2720' : 'white'), 0.1)
  // })
  return (
    <Billboard {...props}>
      <Image ref={imageRef} url={data.url} position={[-2, 0, 0]} scale={3} transparent/>
      <Text ref={textRef} onPointerOver={over} anchorX={'left'} onPointerOut={out} onClick={() => console.log('clicked')} {...fontProps}>
        {data.text}
      </Text>
    </Billboard>
  )
}

function getPoints(count: number, _radius: number) {
  const points = []
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    points.push([x * _radius, y * _radius, z * _radius])
  }
  return points
}

function Cloud({ count = 10, radius = 20, words: _words = [] }: any) {
  // Create a count x count random words with spherical distribution
  const words = useMemo(() => {
    const temp = []
    const spherical = new THREE.Spherical()
    const points = getPoints(count, radius);
    for (let i = 0; i < points.length; i++)
      temp.push([new THREE.Vector3().setFromSpherical(spherical.setFromCartesianCoords(points[i][0], points[i][1], points[i][2])), _words[i]])
    return temp
  }, [count, radius])
  return words.map(([pos, word], index) => <Word key={index} position={pos} data={word} />)
}

function Globe({texts = []}: {texts: any[]}) {
  const ref: MutableRefObject<THREE.Group<THREE.Object3DEventMap> | undefined> = useRef();
  useFrame(() => {
    if (ref.current)
      ref.current.rotation.x -= 0.0009
  })
  return <group ref={ref as any} rotation={[100, 10.5, 100]}>
    <Cloud words={texts} count={texts.length} radius={20} />
  </group>
}

export function TextGlobe({texts = []}: {texts: any[]}) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 35], fov: 100 }}>
      <fog attach="fog" args={[Colors.sky[900], 0, 80]} />
      <Suspense fallback={null}>
        <Globe texts={texts}/>
      </Suspense>
      <TrackballControls />
    </Canvas>
  )
}
