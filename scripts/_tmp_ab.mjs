import * as THREE from 'three';
import { camAt, ndc } from './_tmp_cam.mjs';
const band=(t,a,b)=>{const l=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return THREE.MathUtils.smoothstep(l,0,0.15)*(1-THREE.MathUtils.smoothstep(l,0.85,1.0));};
function sweep(label,pts,a,b,rng,aspect=16/9,useEnter=false){
  let wt=-9,wti=null;
  for(let t=rng[0];t<=rng[1];t+=0.002){
    const l=THREE.MathUtils.clamp((t-a)/(b-a),0,1);
    const w=useEnter?THREE.MathUtils.smoothstep(l,0,0.15):band(t,a,b);
    if(w<0.10) continue;
    const {cam}=camAt(t,aspect);
    for(const p of pts){const n=ndc(cam,p[0],p[1],p[2]);if(!n.front)continue;
      if(n.y>wt){wt=n.y;wti={t:t.toFixed(3),w:w.toFixed(2),p,ndc:[n.x.toFixed(2),n.y.toFixed(2)],d:n.dist.toFixed(1)};}}
  }
  console.log(`${label}  worstNDC.y=${wt.toFixed(3)} ${JSON.stringify(wti)} ${wt>0.55?'  <-- TOO HIGH':''}`);
}
console.log('--- ABOUT (band>0.10) ---');
const R=4.2;
for(const [x,y,z] of [[15,9.5,-70],[15,7,-67],[14,6,-66],[13.5,4.5,-64],[15,5,-68],[12.5,3.5,-62]]) {
  sweep(`globe c=(${x},${y},${z}) R=${R}`,[[x,y,z],[x,y+R,z],[x,y-R,z],[x-R,y,z],[x+R,y,z]],0.16,0.36,[0.14,0.40]);
}
console.log('\n--- ABOUT existing content top (for reference) ---');
sweep('panel top-left (-7.9,5.6,-41.2)',[[-7.9,5.6,-41.2],[3.5,5.6,-41.2]],0.16,0.36,[0.14,0.40]);
sweep('portrait top (7.4,4.7,-40)',[[4.1,4.7,-40],[10.7,4.7,-40]],0.16,0.36,[0.14,0.40]);

console.log('\n--- CONTACT (enter>0.10) ---');
sweep('panel 17x9.4 top corners y25.5',[[-8.5,25.5,-350.5],[8.5,25.5,-350.5],[0,25.5,-350.5]],0.90,1.0,[0.88,1.001],16/9,true);
for(const [w,h,cy,cz] of [[16,8.6,21.6,-350.5],[15,8.0,21.0,-350.5],[15,8.0,20.0,-350.0]]) {
  const pts=[[-w/2,cy+h/2,cz],[w/2,cy+h/2,cz],[0,cy+h/2,cz],[-w/2,cy-h/2,cz],[w/2,cy-h/2,cz]];
  sweep(`panel ${w}x${h} @ (0,${cy},${cz})`,pts,0.90,1.0,[0.88,1.001],16/9,true);
}
console.log('\n--- CONTACT panel NDC extents at key t (16:9) ---');
for(const t of [0.90,0.93,0.96,0.98,1.00]){
  const {cam,fov}=camAt(t);
  const w=15,h=8.0,cy=21.0,cz=-350.5;
  const c=[[-w/2,cy+h/2,cz],[w/2,cy+h/2,cz],[-w/2,cy-h/2,cz],[w/2,cy-h/2,cz]].map(p=>ndc(cam,...p));
  console.log(`  t=${t.toFixed(2)} fov=${fov.toFixed(1)} x[${Math.min(...c.map(v=>v.x)).toFixed(2)},${Math.max(...c.map(v=>v.x)).toFixed(2)}] y[${Math.min(...c.map(v=>v.y)).toFixed(2)},${Math.max(...c.map(v=>v.y)).toFixed(2)}] d=${c[0].dist.toFixed(1)}`);
}
console.log('\n--- CONTACT panel NDC extents 4:3 / phone at t=0.96,1.00 ---');
for(const [nm,a] of [['4:3',4/3],['phone',390/844]]) for(const t of [0.96,1.00]){
  const {cam}=camAt(t,a); const w=15,h=8.0,cy=21.0,cz=-350.5;
  const c=[[-w/2,cy+h/2,cz],[w/2,cy+h/2,cz],[-w/2,cy-h/2,cz],[w/2,cy-h/2,cz]].map(p=>ndc(cam,...p));
  console.log(`  ${nm} t=${t} x[${Math.min(...c.map(v=>v.x)).toFixed(2)},${Math.max(...c.map(v=>v.x)).toFixed(2)}] y[${Math.min(...c.map(v=>v.y)).toFixed(2)},${Math.max(...c.map(v=>v.y)).toFixed(2)}]`);
}
