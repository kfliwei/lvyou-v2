const fs=require('fs'),{PNG}=require('pngjs');
const name=process.argv[2];
const a=PNG.sync.read(fs.readFileSync('tools/out/visual-baseline/'+name));
const b=PNG.sync.read(fs.readFileSync('tools/out/visual-diff/'+name.replace('.png','.cur.png')));
const rows=[];
for(let y=0;y<a.height;y++){let n=0,x0=1e9,x1=-1;
  for(let x=0;x<a.width;x++){const i=(a.width*y+x)*4;
    const d=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
    if(d>20){n++;if(x<x0)x0=x;if(x>x1)x1=x;}}
  if(n>0)rows.push([y,n,x0,x1]);}
/* 连续行合并成区段 */
const segs=[];let cur=null;
for(const r of rows){if(cur&&r[0]===cur.y1+1){cur.y1=r[0];cur.n+=r[1];cur.x0=Math.min(cur.x0,r[2]);cur.x1=Math.max(cur.x1,r[3]);}
  else{if(cur)segs.push(cur);cur={y0:r[0],y1:r[0],n:r[1],x0:r[2],x1:r[3]};}}
if(cur)segs.push(cur);
console.log(name+'  截图 2x，CSS px 坐标');
for(const s of segs)console.log('  CSS y '+(s.y0/2).toFixed(0)+'–'+(s.y1/2).toFixed(0)+'  红像素 '+s.n+'  x 范围 CSS '+Math.round(s.x0/2)+'–'+Math.round(s.x1/2));
