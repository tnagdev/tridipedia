import * as THREE from 'three';
import { camAt, ndc } from './_tmp_cam.mjs';
const NAV=0.60; // hard ceiling we must stay under

function gateChips(gates, Rx, Ry, Ay){
  const out=[];
  gates.forEach((g,gi)=>{
    for(let k=0;k<g.count;k++){
      const th=g.phase + k*2*Math.PI/g.count;
      out.push({gi,k,th,x:Rx*Math.cos(th), y:Ay+Ry*Math.sin(th), z:g.z});
    }
  });
  return out;
}
function evaluate(label,gates,Rx,Ry,Ay,aspect=16/9,fadeA=13,fadeB=22){
  const chips=gateChips(gates,Rx,Ry,Ay);
  let worstTop=-9, worstTopInfo=null, minClear=1e9, minClearInfo=null;
  let framedByT={};
  for(let t=0.34;t<=0.60;t+=0.002){
    const {cam,P}=camAt(t,aspect);
    let framed=0;
    for(const c of chips){
      const planeD=Math.abs(P.z-c.z);
      const fade=THREE.MathUtils.smoothstep(planeD,fadeA,fadeB);
      const d=Math.hypot(c.x-P.x,c.y-P.y,c.z-P.z);
      if(d<minClear){minClear=d;minClearInfo={t:t.toFixed(3),gi:c.gi,k:c.k,d:d.toFixed(2)};}
      if(fade<0.05) continue;
      const n=ndc(cam,c.x,c.y,c.z);
      if(!n.front) continue;
      if(Math.abs(n.x)<0.94&&Math.abs(n.y)<0.94) framed++;
      if(n.y>worstTop){worstTop=n.y;worstTopInfo={t:t.toFixed(3),gi:c.gi,k:c.k,ndc:n.y.toFixed(3),fade:fade.toFixed(2),d:n.dist.toFixed(1)};}
    }
    const key=t.toFixed(2); framedByT[key]=Math.max(framedByT[key]??0,framed);
  }
  console.log(`\n== ${label} aspect=${aspect.toFixed(2)} Rx=${Rx} Ry=${Ry} Ay=${Ay}`);
  console.log('  worst chip NDC top', worstTop.toFixed(3), JSON.stringify(worstTopInfo), worstTop>NAV?'  <-- NAV COLLISION':'  ok');
  console.log('  min camera-chip distance', minClear.toFixed(2), JSON.stringify(minClearInfo));
  const line=Object.entries(framedByT).filter(([k])=>(+k*1000)%20===0).map(([k,v])=>`${k}:${v}`).join(' ');
  console.log('  framed chips  ', line);
}
const G3=[{z:-80,count:3,phase:0},{z:-106,count:3,phase:2*Math.PI/9},{z:-132,count:3,phase:4*Math.PI/9}];
const G2a=[{z:-84,count:5,phase:0},{z:-116,count:4,phase:Math.PI/4}];
const G2b=[{z:-82,count:5,phase:0},{z:-112,count:4,phase:Math.PI/4}];
evaluate('D1 orig 3 gates',G3,12.5,7.0,3.2);
evaluate('crit2 flat 3 gates',G3,13.5,4.2,3.0);
evaluate('2 gates A',G2a,13.5,4.2,3.0);
evaluate('2 gates B',G2b,13.5,4.2,3.0);
evaluate('2 gates A 4:3',G2a,13.5,4.2,3.0,4/3);
evaluate('2 gates A phone',G2a,13.5*0.80,4.2,3.0,390/844);
