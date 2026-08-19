import * as THREE from 'three';
import { camAt, ndc } from './_tmp_cam.mjs';
function corners(cx,cy,cz,rx,w,h){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,0,0));
  return [[-w/2,h/2],[w/2,h/2],[-w/2,-h/2],[w/2,-h/2]].map(([x,y])=>{
    const v=new THREE.Vector3(x,y,0).applyQuaternion(q); return [cx+v.x,cy+v.y,cz+v.z];});
}
function test(label,cx,cy,cz,rx,w,h,aspect=16/9){
  let out=[];
  for(const t of [0.90,0.92,0.94,0.96,0.98,1.00]){
    const {cam}=camAt(t,aspect);
    const cs=corners(cx,cy,cz,rx,w,h).map(p=>ndc(cam,...p));
    const xs=cs.map(v=>v.x),ys=cs.map(v=>v.y);
    out.push(`t${t.toFixed(2)} x[${Math.min(...xs).toFixed(2)},${Math.max(...xs).toFixed(2)}] y[${Math.min(...ys).toFixed(2)},${Math.max(...ys).toFixed(2)}] h=${(Math.max(...ys)-Math.min(...ys)).toFixed(2)} d=${cs[0].dist.toFixed(0)}`);
  }
  console.log(`${label}\n   ${out.join('\n   ')}`);
}
for (const rx of [0, 0.5, 0.85, 1.05]) test(`panel 15x8 (0,19,-348) rx=${rx}`,0,19,-348,rx,15,8);
console.log();
test('BEST? 15x8 (0,19.5,-347) rx=0.85',0,19.5,-347,0.85,15,8);
test('BEST? 15x8 (0,19.5,-347) rx=0.85 4:3',0,19.5,-347,0.85,15,8,4/3);
test('BEST? 15x8 (0,19.5,-347) rx=0.85 phone',0,19.5,-347,0.85,15,8,390/844);
console.log();
test('narrow 11x9 (0,19.5,-347) rx=0.85 phone',0,19.5,-347,0.85,11,9,390/844);
test('narrow 11x9 (0,19.5,-347) rx=0.85 16:9',0,19.5,-347,0.85,11,9);
