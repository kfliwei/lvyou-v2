/* 把三口径读数里差异那一小块裁出来给人眼看：左=fresh、中=基线、右=差异放大 20 倍叠红框 */
const fs=require('fs'),path=require('path');
const {PNG}=require('pngjs');
const OUT='tools/out/b33f-shots-floor';
function crop(img,x0,y0,w,h){const o=new PNG({width:w,height:h});for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sx=x0+x,sy=y0+y;const s=(sy*img.width+sx)*4,d=(y*w+x)*4;
  if(sx<0||sy<0||sx>=img.width||sy>=img.height){[0,1,2,3].forEach(k=>o.data[d+k]=0);continue;}
  o.data[d]=img.data[s];o.data[d+1]=img.data[s+1];o.data[d+2]=img.data[s+2];o.data[d+3]=img.data[s+3];}return o;}
function hot(a,b,amp){const o=new PNG({width:a.width,height:a.height});o.data.set(a.data);
  for(let i=0;i<a.width*a.height;i++){const p=i*4;
    const d=Math.max(Math.abs(a.data[p]-b.data[p]),Math.abs(a.data[p+1]-b.data[p+1]),Math.abs(a.data[p+2]-b.data[p+2]),Math.abs(a.data[p+3]-b.data[p+3]));
    if(d>0){o.data[p]=255;o.data[p+1]=0;o.data[p+2]=0;o.data[p+3]=255;}
  }return o;}
const jobs=[['topic.328x723.png',196,776,297,907],['topic.452x995.png',183,1260,206,1282],['topic.390x844.png',106,924,202,1132]];
for(const [tag,x0,y0,x1,y1] of jobs){
  const A=PNG.sync.read(fs.readFileSync(path.join(OUT,tag)));
  const B=PNG.sync.read(fs.readFileSync(path.join('tools/out/visual-baseline',tag)));
  const pad=40,cx=Math.max(0,x0-pad),cy=Math.max(0,y0-pad),cw=Math.min(A.width,cx+ (x1-x0)+2*pad),ch=Math.min(A.height,cy+(y1-y0)+2*pad);
  const ca=crop(A,cx,cy,cw,ch),cb=crop(B,cx,cy,cw,ch),hd=hot(A,B);
  fs.writeFileSync(path.join(OUT,'crop-fresh-'+tag),PNG.sync.write(ca));
  fs.writeFileSync(path.join(OUT,'crop-base-'+tag),PNG.sync.write(cb));
  fs.writeFileSync(path.join(OUT,'crop-hot-'+tag),PNG.sync.write(crop(hd,cx,cy,cw,ch)));
  console.log(tag+' 差异框(设备px) '+x0+','+y0+'→'+x1+','+y1+'  =CSS '+Math.round(x0/2)+','+Math.round(y0/2)+'→'+Math.round(x1/2)+','+Math.round(y1/2)+'  裁片 '+cw+'x'+ch+' → '+OUT+'/crop-*-'+tag);
}
