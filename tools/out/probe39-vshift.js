const fs=require('fs'),{PNG}=require('pngjs');
const name=process.argv[2], x0=Number(process.argv[3]), x1=Number(process.argv[4]), y0=Number(process.argv[5]), y1=Number(process.argv[6]);
const a=PNG.sync.read(fs.readFileSync('tools/out/visual-baseline/'+name));
const b=PNG.sync.read(fs.readFileSync('tools/out/visual-diff/'+name.replace('.png','.cur.png')));
const diff=(p,i,q,j)=>Math.max(Math.abs(p.data[i]-q.data[j]),Math.abs(p.data[i+1]-q.data[j+1]),Math.abs(p.data[i+2]-q.data[j+2]));
for(let dy=-24;dy<=24;dy++){let n=0;
  for(let y=Math.max(y0,y0+dy);y<Math.min(y1,y1+dy);y++)for(let x=x0;x<x1;x++){
    if(diff(a,(a.width*y+x)*4,b,(b.width*(y+dy)+x)*4)>20)n++;}
  console.log('当前帧相对基线上移 '+(-dy)+' 截图px → 不匹配', n);}
