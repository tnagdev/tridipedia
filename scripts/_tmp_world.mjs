import * as THREE from 'three';
import { camAt, ndc } from './_tmp_cam.mjs';
function sweep(label, pts, t0,t1, aspect=16/9, step=0.004){
  let wt=-9,wti=null, best={};
  for(let t=t0;t<=t1;t+=step){
    const {cam,P}=camAt(t,aspect);
    for(const p of pts){
      const n=ndc(cam,p[0],p[1],p[2]); if(!n.front) continue;
      if(n.y>wt){wt=n.y;wti={t:t.toFixed(3),p,ndc:[n.x.toFixed(2),n.y.toFixed(2)],d:n.dist.toFixed(1)};}
      const key=p.join(','); if(!best[key]||n.dist<best[key].d) best[key]={d:n.dist,x:n.x,y:n.y,t};
    }
  }
  console.log(`\n${label} (aspect ${aspect.toFixed(2)})  worst NDC.y ${wt.toFixed(3)} ${JSON.stringify(wti)}`);
  for(const [k,v] of Object.entries(best)) console.log(`   ${k}  closest d=${v.d.toFixed(1)} at t=${v.t.toFixed(3)} ndc=(${v.x.toFixed(2)},${v.y.toFixed(2)})`);
}
// --- Experience: year ticks on walls ---
const years=[2018,2019,2020,2021,2022,2023,2024,2025,2026];
const t0=new Date('2018-02-07').getTime(), span=Date.now()-t0;
const zs=years.map(y=>({y,z:-150-((new Date(`${y}-01-01`).getTime()-t0)/span)*110})).filter(o=>o.z<=-148.5);
console.log('year z:', zs.map(o=>`${o.y}:${o.z.toFixed(1)}`).join(' '));
for (const wx of [8.5, 9.5, 10.5]) {
  sweep(`TICKS wallX=${wx} y=-2.4`, zs.flatMap(o=>[[wx,-2.4,o.z],[-wx,-2.4,o.z]]), 0.58,0.78);
}
// --- Experience: phase reliefs candidates ---
sweep('PHASE y=6.4 x=+-9 (current)', [[-9,6.4,-150],[9,6.4,-186.7],[-9,6.4,-223.3],[9,6.4,-260]],0.58,0.80);
sweep('PHASE y=1.4 x=+-11', [[-11,1.4,-150],[11,1.4,-186.7],[-11,1.4,-223.3],[11,1.4,-260]],0.58,0.80);
// --- Contact: uplink anchors ---
console.log('\n--- CONTACT ---');
for (const [y,z] of [[27.6,-347.2],[16.0,-350.0],[14.0,-352.0],[12.0,-354.0]]) {
  // downward fan: local extents top +3.0 bottom -6.5 halfW 7.7  => sample world approximations (group faces camera)
  const pts=[[0,y,z]];
  sweep(`hub y=${y} z=${z}`,pts,0.90,1.0,16/9,0.005);
}
// --- About: decoration slot candidates ---
console.log('\n--- ABOUT ---');
sweep('wireframe current [15,9.5,-70] r2.7',[[15,9.5,-70],[15,12.2,-70],[15,6.8,-70]],0.16,0.36);
sweep('globe [15,7,-67] r=4.16 top',[[15,7,-67],[15,11.16,-67],[15,2.84,-67],[10.84,7,-67],[19.16,7,-67]],0.16,0.36);
sweep('globe [14,6,-66] r=4.16',[[14,6,-66],[14,10.16,-66],[14,1.84,-66]],0.16,0.36);
