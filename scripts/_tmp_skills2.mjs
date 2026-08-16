import * as THREE from 'three';
import { camAt, ndc } from './_tmp_cam.mjs';
const GATES=[{z:-80,count:3,phase:0},{z:-106,count:3,phase:2*Math.PI/9},{z:-132,count:3,phase:4*Math.PI/9}];
const Ay=3.0;
function run(label,Rx,Ry,aspect,fadeA=13,fadeB=22,band=true){
  const chips=[]; GATES.forEach((g,gi)=>{for(let k=0;k<g.count;k++){const th=g.phase+k*2*Math.PI/g.count;chips.push({gi,k,th,x:Rx*Math.cos(th),y:Ay+Ry*Math.sin(th),z:g.z});}});
  // ring rim samples
  const rim=[]; GATES.forEach((g,gi)=>{for(let a=0;a<64;a++){const th=a/64*Math.PI*2;rim.push({gi,x:Rx*1.035*Math.cos(th),y:Ay+Ry*1.035*Math.sin(th),z:g.z});}});
  let wc=-9,wci=null,wr=-9,wri=null,minC=1e9,minCi=null,framed={};
  for(let t=0.34;t<=0.60;t+=0.002){
    const {cam,P}=camAt(t,aspect);
    const local=(t-0.36)/0.22;
    const bandV=band? THREE.MathUtils.smoothstep(local,0,0.15)*(1-THREE.MathUtils.smoothstep(local,0.85,1.0)) : 1;
    if(bandV<0.02) continue;
    let f=0;
    for(const c of chips){
      const fade=THREE.MathUtils.smoothstep(Math.abs(P.z-c.z),fadeA,fadeB)*bandV;
      const d=Math.hypot(c.x-P.x,c.y-P.y,c.z-P.z);
      if(d<minC){minC=d;minCi={t:t.toFixed(3),gi:c.gi,k:c.k};}
      if(fade<0.05)continue;
      const n=ndc(cam,c.x,c.y,c.z); if(!n.front)continue;
      if(Math.abs(n.x)<0.94&&Math.abs(n.y)<0.90)f++;
      if(n.y>wc){wc=n.y;wci={t:t.toFixed(3),gi:c.gi,k:c.k,fade:fade.toFixed(2),d:n.dist.toFixed(1)};}
    }
    for(const c of rim){
      const fade=THREE.MathUtils.smoothstep(Math.abs(P.z-c.z),fadeA,fadeB)*bandV;
      if(fade<0.05)continue;
      const n=ndc(cam,c.x,c.y,c.z); if(!n.front)continue;
      if(n.y>wr){wr=n.y;wri={t:t.toFixed(3),gi:c.gi,fade:fade.toFixed(2)};}
    }
    const key=t.toFixed(2); framed[key]=Math.max(framed[key]??0,f);
  }
  console.log(`\n${label} Rx=${Rx.toFixed(2)} Ry=${Ry} aspect=${aspect.toFixed(2)}`);
  console.log('  worst chip NDC.y', wc.toFixed(3), JSON.stringify(wci));
  console.log('  worst rim  NDC.y', wr.toFixed(3), JSON.stringify(wri));
  console.log('  min cam-chip dist', minC.toFixed(2), JSON.stringify(minCi));
  console.log('  framed:', Object.entries(framed).filter(([k])=>Math.round(+k*100)%2===0).map(([k,v])=>`${k}:${v}`).join(' '));
}
run('16:9',13.5,4.2,16/9);
run('4:3 ',13.5*0.93,4.2*1.0,4/3);
run('phone',13.5*0.80,4.2*1.0,390/844);
// chip world table
const Rx=13.5,Ry=4.2;
console.log('\nCHIP TABLE (16:9 spread 1.0)');
GATES.forEach((g,gi)=>{for(let k=0;k<g.count;k++){const th=g.phase+k*2*Math.PI/g.count;
console.log(`  gate${gi} slot${k} theta=${(th*180/Math.PI).toFixed(0)}deg  pos=(${(Rx*Math.cos(th)).toFixed(2)}, ${(Ay+Ry*Math.sin(th)).toFixed(2)}, ${g.z})`);}});
