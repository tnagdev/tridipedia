import * as THREE from 'three';
import { camAt, ndc, pos, look, remap } from './_tmp_cam.mjs';
const SEC=[0.58,0.78], SPAN=0.2, N=3, OUT_FADE=0.62, HOLD=0.20, OUT=0.50;
const PITCH=SPAN/(N-1+2*OUT_FADE);
const TC=Array.from({length:N},(_,i)=>SEC[0]+(OUT_FADE+i)*PITCH);
console.log('PITCH',PITCH.toFixed(6),'TC',TC.map(t=>t.toFixed(6)).join(' '));
const dockCurve=x=>{const a=THREE.MathUtils.clamp((Math.abs(x)-HOLD)/(OUT-HOLD),0,1);return 1-(x<0?a*a:Math.pow(a,1.25));};
// fov at TC
for(const t of TC){const {fov,P}=camAt(t);console.log('  TC',t.toFixed(4),'fov',fov.toFixed(1),'campos',P.toArray().map(v=>v.toFixed(2)).join(','));}
// dock frame test
function dockTest(label,W,H,fillW,fillH,D,cndcY,aspect){
  let worstTop=-9,worstTopT=0,minK=9,maxK=0;
  for(let i=0;i<N;i++){
    const {cam,P,fov}=camAt(TC[i],aspect);
    const halfH=Math.tan(THREE.MathUtils.degToRad(fov)/2)*D, halfW=halfH*aspect;
    const k=Math.min(2*halfW*fillW/W, 2*halfH*fillH/H);
    minK=Math.min(minK,k);maxK=Math.max(maxK,k);
    const hh=(H*k/2)/halfH, hw=(W*k/2)/halfW;
    const top=cndcY+hh, bot=cndcY-hh;
    if(top>worstTop){worstTop=top;worstTopT=TC[i];}
    console.log(`  ${label} card${i} fov=${fov.toFixed(1)} k=${k.toFixed(3)} ndcX=+-${hw.toFixed(3)} ndcY=[${bot.toFixed(3)},${top.toFixed(3)}]`);
  }
  console.log(`  ${label} worst top ${worstTop.toFixed(3)} @t${worstTopT.toFixed(3)}  k range ${minK.toFixed(3)}..${maxK.toFixed(3)}`);
}
console.log('\nLANDSCAPE 16:9 card 13x8 fill .86/.46 D15.5 cY -0.06');
dockTest('L',13,8,0.86,0.46,15.5,-0.06,16/9);
console.log('\nLANDSCAPE 4:3');
dockTest('L',13,8,0.86,0.46,15.5,-0.06,4/3);
console.log('\nPORTRAIT phone card 8x11 fill .92/.50 D15.5 cY -0.08');
dockTest('P',8,11,0.92,0.50,15.5,-0.08,390/844);
// text px at 1080p / 844p
function px(worldSize,k,D,fov,pixH){const halfH=Math.tan(THREE.MathUtils.degToRad(fov)/2)*D;return worldSize*k/(2*halfH)*pixH;}
console.log('\ntext px @1080p landscape (k from card fov):');
for(let i=0;i<N;i++){const {fov}=camAt(TC[i]);const halfH=Math.tan(THREE.MathUtils.degToRad(fov)/2)*15.5;const k=Math.min(2*halfH*(16/9)*0.86/13,2*halfH*0.46/8);
 console.log(`  card${i} fov${fov.toFixed(1)} k${k.toFixed(3)} company0.62=${px(0.62,k,15.5,fov,1080).toFixed(1)}px role0.46=${px(0.46,k,15.5,fov,1080).toFixed(1)}px story0.34=${px(0.34,k,15.5,fov,1080).toFixed(1)}px meta0.28=${px(0.28,k,15.5,fov,1080).toFixed(1)}px`);}
console.log('\ntext px @844p portrait:');
for(let i=0;i<N;i++){const {fov}=camAt(TC[i],390/844);const halfH=Math.tan(THREE.MathUtils.degToRad(fov)/2)*15.5;const k=Math.min(2*halfH*(390/844)*0.92/8,2*halfH*0.50/11);
 console.log(`  card${i} k${k.toFixed(3)} company0.52=${px(0.52,k,15.5,fov,844).toFixed(1)}px story0.30=${px(0.30,k,15.5,fov,844).toFixed(1)}px`);}
// approach / exit framing sanity: card centre travels anchor->dock
console.log('\napproach/exit NDC centre sweep (16:9, card0):');
const P=new THREE.Vector3(),L=new THREE.Vector3();
for(let t=SEC[0];t<=TC[0]+0.06;t+=0.005){
  const x=(t-TC[0])/PITCH; const dock=dockCurve(x);
  if(dock<=0 && Math.abs(x)>OUT) continue;
  const {cam,P:CP}=camAt(t);
  // anchor from spline at TC
  pos.getPoint(remap(TC[0]),P); look.getPoint(remap(Math.min(TC[0]+0.012,1)),L);
  const F=L.clone().sub(P).normalize(); const R=F.clone().cross(new THREE.Vector3(0,1,0)).normalize(); const U=R.clone().cross(F).normalize();
  const dockRef=P.clone().addScaledVector(F,15.5).addScaledVector(U,-0.9);
  const anchor=dockRef.clone().addScaledVector(F,10).addScaledVector(R,13).addScaledVector(U,2);
  // live dock
  const CF=new THREE.Vector3(0,0,-1).applyQuaternion(cam.quaternion);
  const CU=new THREE.Vector3(0,1,0).applyQuaternion(cam.quaternion);
  const live=CP.clone().addScaledVector(CF,15.5).addScaledVector(CU,-0.9);
  const p=anchor.clone().lerp(live,dock);
  const n=ndc(cam,p.x,p.y,p.z);
  console.log(`  t=${t.toFixed(3)} x=${x.toFixed(2)} dock=${dock.toFixed(2)} ndc=(${n.x.toFixed(2)},${n.y.toFixed(2)}) d=${n.dist.toFixed(1)} front=${n.front}`);
}
