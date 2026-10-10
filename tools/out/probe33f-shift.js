/* 差异是「色偏」还是「整块挪了 N 个设备像素」：对 fresh 做 -3..3 平移扫描，看严格差异像素数的最小值 */
const fs=require('fs'),path=require('path');const {PNG}=require('pngjs');
const OUT='tools/out/b33f-shots-floor';
function strictShift(A,B,dx,dy){let n=0;
 for(let y=0;y<A.height;y++)for(let x=0;x<A.width;x++){
  const sx=x-dx,sy=y-dy;if(sx<0||sy<0||sx>=A.width||sy>=A.height)continue;
  const a=(y*A.width+x)*4,b=(sy*A.width+sx)*4;
  if(A.data[a]!==B.data[b]||A.data[a+1]!==B.data[b+1]||A.data[a+2]!==B.data[b+2]||A.data[a+3]!==B.data[b+3])n++;}
 return n;}
for(const tag of ['topic.328x723.png','topic.390x844.png','topic.452x995.png']){
 const A=PNG.sync.read(fs.readFileSync(path.join(OUT,tag)));
 const B=PNG.sync.read(fs.readFileSync(path.join('tools/out/visual-baseline',tag)));
 const t0=strictShift(A,B,0,0);let best={d:t0,x:0,y:0};const grid=[];
 for(let dy=-2;dy<=2;dy++){const row=[];for(let dx=-2;dx<=2;dx++){const n=strictShift(A,B,dx,dy);row.push(n);if(n<best.d)best={d:n,x:dx,y:dy};}grid.push((dy===0?'0 ':'')+(dy<0?'-':'')+Math.abs(dy)+' '+row.join(' '));}
 console.log(tag+'  零位移严格差异='+t0+'  最优位移=('+best.x+','+best.y+') 差异='+best.d+'  降幅='+(t0?((1-best.d/t0)*100).toFixed(1):'0')+'%');
 console.log('   网格(每格=差异像素数, 行=dy 列=dx -2..2)\n     '+grid.join('\n     '));
}
