const fs=require('fs'),{PNG}=require('pngjs');
for(const name of process.argv.slice(2)){
  const a=PNG.sync.read(fs.readFileSync('tools/out/visual-baseline-prev/'+name));
  const b=PNG.sync.read(fs.readFileSync('tools/out/visual-baseline/'+name));
  let n=0,maxd=0;const rows={};
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){const i=(a.width*y+x)*4;
    const d=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]),Math.abs(a.data[i+3]-b.data[i+3]));
    if(d>0){n++;if(d>maxd)maxd=d;const k=Math.floor(y/40)*40;rows[k]=(rows[k]||0)+1;}}
  console.log(name,'逐字节不同的像素',n,'最大通道差',maxd,'| 分布',Object.entries(rows).sort((p,q)=>q[1]-p[1]).slice(0,5).map(e=>'y'+e[0]+':'+e[1]).join(' '));
}
