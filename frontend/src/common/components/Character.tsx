import * as THREE from 'three';
import { OrbitControls, useAnimations, useFBX } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";


function CharLoader({camera} : {camera: THREE.PerspectiveCamera}) {
    // const modelName = 'kakashi';
    const modelName = 'avatar';
    const model = useFBX(`/${modelName}_waving.fbx`);
    const modelNormal = useFBX(`/${modelName}.fbx`);
    
    const ref = useRef();
    const { actions, mixer, names }= useAnimations(model.animations, model)
    if (actions[names[0]]) {
        actions[names[0]].setLoop(THREE.LoopOnce, 1);
        actions[names[0]].clampWhenFinished = true;
    }
    useEffect(() => {
        model.traverse((e: any) => {
            if (e.type === 'SkinnedMesh') {
                const child: any = modelNormal.children.find((f: any) => f.name === e.name);
                if (child)
                    e.material = child.material;
            }
        })
        // model.position.set(0, -65, 0); // kakashi
        model.position.set(0, -1, 0); // avatar
        actions[names[0]]?.reset().play();
    }, [model, modelNormal, actions, names])
   
    
    return <Suspense fallback={null}><primitive onClick={() => {
        model.lookAt(90, 0, 0)
        camera.position.set(90, 0, 0);
        actions[names[0]]?.reset().play();
    }} ref={ref} object={model} dispose={null} />
    </Suspense>
}

export function Character() {
    const camera = new THREE.PerspectiveCamera();
    const light = new THREE.AmbientLight(0xffffff, 4);
    // avatar
    camera.position.set(0, 0, 0);
    const cameraAngle = 80;
    const cameraDistance = 3;
    const plight = new THREE.PointLight(0xffffff, 3, 0, 0);
    plight.position.set(0, 0, 0);
    plight.lookAt(new THREE.Vector3(0, -1, 0));
    
    // kakashi
    // camera.position.set(0, -20, 125);
    // const cameraAngle = 80;
    // const cameraDistance = 135;
    // const plight = new THREE.PointLight(0xffffff, 3, 0, 0);
    // light.position.set(0, -20, 125);
    // light.lookAt(new THREE.Vector3(0, -65, 0));
    
    const scene = new THREE.Scene();
    scene.add(light);
    scene.add(plight)
    return <Canvas scene={scene} camera={camera} flat>
        <CharLoader camera={camera}/>
        <OrbitControls
            maxPolarAngle={THREE.MathUtils.degToRad(cameraAngle)} 
            minPolarAngle={THREE.MathUtils.degToRad(cameraAngle)}    
            minDistance={cameraDistance} 
            maxDistance={cameraDistance} 
            enableZoom={false}
        />
    </Canvas>
}