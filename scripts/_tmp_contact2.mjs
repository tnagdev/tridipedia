import * as THREE from 'three';
import { camAt, ndc } from './_tmp_cam.mjs';
const ss=THREE.MathUtils.smoothstep;
function corners(cx,cy,cz,rx,w,h){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,0,0));
  return [[-w/2,h/2],[w/2,h/2],[-w/2,-h/2],[w/2,-h/2]].map(([x,y])=>{const v=new THREE.Vector3(x,y,0).applyQuaternion(q);return [cx+v.x,cy+v.y,cz+v.z];});
}
function score(cy,cz,rx,w,h,fadeA,fadeB,aspect=16/9){
  let maxTop=-9,maxTopT=0,bestH=0,bestHT=0,maxAbsX=0;
  for(let t=0.90;t<=1.0;t+=0.002){
    const l=(t-0.90)/0.10;
    const op=ss(l,0,0.15)*(1-ss(t,fadeA,fadeB));
    if(op<0.15) continue;
    const {cam}=camAt(t,aspect);
    const cs=corners(cy?0:0,cy,cz,rx,w,h).map(p=>ndc(cam,...p));
    const ys=cs.map(v=>v.y), xs=cs.map(v=>v.x);
    const top=Math.max(...ys), hh=top-Math.min(...ys);
    if(top>maxTop){maxTop=top;maxTopT=t;}
    if(hh>bestH){bestH=hh;bestHT=t;}
    maxAbsX=Math.max(maxAbsX,...xs.map(Math.abs));
  }
  return {maxTop,maxTopT,bestH,bestHT,maxAbsX};
}
console.log('cy   cz     rx   fade      maxTop@t      maxH@t     maxAbsX');
for(const cy of [17,18,19,20]) for(const cz of [-346,-348,-350]) for(const rx of [0.7,0.85,1.0]) {
  const s=score(cy,cz,rx,15,8,0.955,0.995);
  const flag = s.maxTop<=0.55 && s.bestH>=0.50 ? '  <== OK' : '';
  console.log(`${cy}  ${cz}  ${rx}  .955-.995  ${s.maxTop.toFixed(3)}@${s.maxTopT.toFixed(2)}  ${s.bestH.toFixed(2)}@${s.bestHT.toFixed(2)}  ${s.maxAbsX.toFixed(2)}${flag}`);
}
console.log('\nchosen detail (16:9 / 4:3 / phone) cy=18 cz=-348 rx=0.85 15x8 fade .955-.995');
for(const [nm,a] of [['16:9',16/9],['4:3',4/3],['phone',390/844]]){
  for(const t of [0.91,0.93,0.95,0.96,0.97]){
    const {cam,fov}=camAt(t,a);
    const cs=corners(0,18,-348,0.85,15,8).map(p=>ndc(cam,...p));
    const xs=cs.map(v=>v.x),ys=cs.map(v=>v.y);
    console.log(`  ${nm} t=${t} fov${fov.toFixed(0)} x[${Math.min(...xs).toFixed(2)},${Math.max(...xs).toFixed(2)}] y[${Math.min(...ys).toFixed(2)},${Math.max(...ys).toFixed(2)}] d=${cs[0].dist.toFixed(0)}`);
  }
}
