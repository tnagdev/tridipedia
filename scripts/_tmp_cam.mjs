import * as THREE from 'three';
import { readFileSync } from 'node:fs';
const site = JSON.parse(readFileSync(new URL('../src/content/site.json', import.meta.url),'utf8'));
const kfs = [...site.journey.keyframes].sort((a,b)=>a.t-b.t);
export const pos = new THREE.CatmullRomCurve3(kfs.map(k=>new THREE.Vector3(...k.pos)),false,'catmullrom',site.journey.curveTension);
export const look = new THREE.CatmullRomCurve3(kfs.map(k=>new THREE.Vector3(...k.look)),false,'catmullrom',site.journey.curveTension);
pos.arcLengthDivisions=2000; look.arcLengthDivisions=2000; pos.getLengths(); look.getLengths();
const times = kfs.map(k=>k.t); const last = times.length-1;
export const remap = (s)=>{const t=Math.min(Math.max(s,times[0]),times[last]);let i=0;while(i<last-1&&times[i+1]<t)i++;const span=times[i+1]-times[i];return (i+(span>1e-9?(t-times[i])/span:0))/last;};
const EASE={linear:t=>t,inOutCubic:t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
function sampleTrack(k,t){if(k.length===1)return k[0].value;let i=1;while(i<k.length-1&&k[i].t<t)i++;const a=k[i-1],b=k[i];const u=THREE.MathUtils.clamp((t-a.t)/Math.max(b.t-a.t,1e-6),0,1);return THREE.MathUtils.lerp(a.value,b.value,EASE.inOutCubic(u));}
const fovTrack = kfs.map(k=>({t:k.t,value:k.fov??60}));
const rollTrack = kfs.map(k=>({t:k.t,value:k.roll??0}));
export const LOOKAHEAD = site.journey.lookAhead;
export function camAt(s, aspect=16/9){
  const P=new THREE.Vector3(), L=new THREE.Vector3();
  pos.getPoint(remap(s),P); look.getPoint(remap(Math.min(s+LOOKAHEAD,1)),L);
  const fov = sampleTrack(fovTrack,s), roll = sampleTrack(rollTrack,s);
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 420);
  cam.position.copy(P); cam.up.set(0,1,0); cam.lookAt(L); cam.rotateZ(roll);
  cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  return {cam,P,L,fov,roll};
}
export function ndc(cam,x,y,z){const v=new THREE.Vector3(x,y,z).project(cam);
  const w = new THREE.Vector3(x,y,z).sub(cam.position);
  const f = new THREE.Vector3(0,0,-1).applyQuaternion(cam.quaternion);
  return {x:v.x,y:v.y,z:v.z,front:w.dot(f)>0,dist:w.length()};}
export function navBand(fov, aspect){
  // Nav3D: group at (0, halfH*0.80, -1.05) parented to camera, scale=fit
  const halfH = Math.tan(THREE.MathUtils.degToRad(fov)*0.5)*1.05;
  const halfW = halfH*aspect;
  const GAP=0.205, CHIP_W=0.064, n=6;
  const xs = Array.from({length:n},(_,i)=>(i-(n-1)/2)*GAP);
  const span = (xs[n-1]-xs[0])+CHIP_W;
  const fit = Math.min(1,(halfW*1.62)/span);
  const gy = halfH*0.80;
  // chips at RAIL_Y=-0.03 half height CHIP_H/2=0.032 ; labels at RAIL_Y-0.062 fontsize .0215
  const chipTop = gy + fit*(-0.03+0.032);
  const labelBot = gy + fit*(-0.062-0.0215*0.75);
  const chipMaxX = fit*(xs[n-1]+CHIP_W/2);
  // NDC: y = worldY/halfH_at_z  (z=-1.05 plane) ; halfH here = tan*1.05
  return {top: chipTop/halfH, bottom: labelBot/halfH, halfX: chipMaxX/halfW, fit};
}
