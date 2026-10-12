const fs=require('fs'),{PNG}=require('pngjs');
const name=process.argv[2], y0=Number(process.argv[3]), y1=Number(process.argv[4]);
const a=PNG.sync.read(fs.readFileSync('tools/out/visual-baseline/'+name));
const b=PNG.sync.read(fs.readFileSync('tools/out/visual-diff/'+name.replace('.png','.cur.png')));
for (let dy=0; dy<=24; dy++) {
  let n=0;
  for(let y=y0;y<y1;y++)for(let x=0;x<a.width-dy;x++){const i=(a.width*y+x)*4,j=(a.width*y+x+dy)*4;
    const d=Math.max(Math.abs(a.data[i]-b.data[j]),Math.abs(a.data[i+1]-b.data[j+1]),Math.abs(a.data[i+2]-b.data[j+2]));
    if(d>20)n++;}
  console.log('右移 '+dy+' 截图px（'+(dy/2)+' CSS px）时不匹配像素', n);
}
