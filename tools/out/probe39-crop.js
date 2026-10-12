const fs=require('fs'),path=require('path'),{PNG}=require('pngjs');
const [name,y0,y1]=process.argv.slice(2);
const a=PNG.sync.read(fs.readFileSync('tools/out/visual-baseline/'+name));
const b=PNG.sync.read(fs.readFileSync('tools/out/visual-diff/'+name.replace('.png','.cur.png')));
const W=a.width,H2=Number(y1)-Number(y0);
const out=new PNG({width:W,height:H2*2+8});
out.data.fill(255);
const put=(src,dy)=>{for(let y=Number(y0);y<Number(y1);y++)for(let x=0;x<W;x++){
  const i=(src.width*y+x)*4,o=((y-Number(y0)+dy)*W+x)*4;
  out.data[o]=src.data[i];out.data[o+1]=src.data[i+1];out.data[o+2]=src.data[i+2];out.data[o+3]=255;}};
/* 上：基线　下：当前帧；中间留 8px 白缝 */
put(a,0);put(b,H2+8);
fs.writeFileSync('tools/out/b39-crop-'+name.replace('.png','.')+y0+'-'+y1+'.cur.png',PNG.sync.write(out));
console.log('已出图 tools/out/b39-crop-'+name.replace('.png','.')+y0+'-'+y1+'.cur.png', out.width+'x'+out.height);
