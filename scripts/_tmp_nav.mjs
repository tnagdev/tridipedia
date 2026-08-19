import { navBand } from './_tmp_cam.mjs';
for (const [name,a] of [['16:9',16/9],['4:3',4/3],['phone',390/844]]) {
  console.log('aspect',name);
  for (const fov of [55,58,60,62,66,70,74,78]) {
    const b=navBand(fov,a);
    console.log('  fov',fov,'navTop',b.top.toFixed(3),'navBot',b.bottom.toFixed(3),'halfX',b.halfX.toFixed(3),'fit',b.fit.toFixed(3));
  }
}
