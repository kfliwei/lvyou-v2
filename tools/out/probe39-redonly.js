const fs=require('fs'),{PNG}=require('pngjs');
const name=process.argv[2], y0=Number(process.argv[3]), y1=Number(process.argv[4]);
const a=PNG.sync.read(fs.readFileSync('tools/out/visual-baseline/'+name));
const b=PNG.sync.read(fs.readFileSync('tools/out/visual-diff/'+name.replace('.png','.cur.png')));
const o=new PNG({width:a.width,height:y1-y0});o.data.fill(255);
for(let y=y0;y<y1;y++)for(let x=0;x<a.width;x++){const i=(a.width*y+x)*4,j=((y-y0)*a.width+x)*4;
  const d=Math.max(Math.abs(a.data[i]-b.data[j]),Math.abs(a.data[i+1]-b.data[j+1]),Math.abs(a.data[i+2]-b.data[j+2]));
  if(d>20){o.data[j]=220;o.data[j+1]=30;o.data[j+2]=30;}}
const f='tools/out/b39-red-'+name.replace('.png','.')+y0+'-'+y1+'.png';
fs.writeFileSync(f,PNG.sync.write(o)); console.log(f,o.width+'x'+o.height);
