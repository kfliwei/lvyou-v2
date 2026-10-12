const fs=require('fs'),{PNG}=require('pngjs');
const name=process.argv[2], y0=Number(process.argv[3]), y1=Number(process.argv[4]);
const d=PNG.sync.read(fs.readFileSync('tools/out/visual-diff/'+name));
const o=new PNG({width:d.width,height:y1-y0});
for(let y=y0;y<y1;y++)for(let x=0;x<d.width;x++){const i=(d.width*y+x)*4,j=((y-y0)*d.width+x)*4;
  for(let k=0;k<4;k++)o.data[j+k]=d.data[i+k];o.data[j+3]=255;}
const f='tools/out/b39-diffcrop-'+name.replace('.png','.')+y0+'-'+y1+'.png';
fs.writeFileSync(f,PNG.sync.write(o)); console.log(f, o.width+'x'+o.height);
