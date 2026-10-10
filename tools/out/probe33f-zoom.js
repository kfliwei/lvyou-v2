/* 找最密的差异窗并 4x 放大导出（左 fresh / 右 基线），给人眼看「差的是字边还是块位移」 */
const fs=require('fs'),path=require('path');const {PNG}=require('pngjs');
const OUT='tools/out/b33f-shots-floor';
const tag=process.argv[2]||'topic.328x723.png';
const A=PNG.sync.read(fs.readFileSync(path.join(OUT,tag)));
const B=PNG.sync.read(fs.readFileSync(path.join('tools/out/visual-baseline',tag)));
const W=A.width,H=A.height,pts=[];
for(let i=0;i<W*H;i++){const p=i*4;let d=0;for(let k=0;k<4;k++)d=Math.max(d,Math.abs(A.data[p+k]-B.data[p+k]));if(d>0)pts.push([i%W,(i/W)|0,d]);}
let best=null;
for(const [x,y] of pts){let n=0;for(const q of pts)if(Math.abs(q[0]-x)<=25&&Math.abs(q[1]-y)<=25)n++;if(!best||n>best.n)best={x,y,n};}
const cw=70,ch=70,x0=Math.max(0,Math.min(W-cw,best.x-35)),y0=Math.max(0,Math.min(H-ch,best.y-35));
function cropZoom(img){const o=new PNG({width:cw*4,height:ch*4});
 for(let y=0;y<ch*4;y++)for(let x=0;x<cw*4;x++){const s=(((y0+(y>>2))*img.width)+(x0+(x>>2)))*4,d=(y*cw*4+x)*4;
  o.data[d]=img.data[s];o.data[d+1]=img.data[s+1];o.data[d+2]=img.data[s+2];o.data[d+3]=img.data[s+3];}return o;}
function mark(img){const o=new PNG({width:img.width,height:img.height});o.data.set(img.data);
 for(const [x,y,d] of pts)if(x>=x0&&x<x0+cw&&y>=y0&&y<y0+ch){const ax=(x-x0)*4,ay=(y-y0)*4;
  for(let j=0;j<4;j++)for(let k=0;k<4;k++){const p=((ay+j)*o.width+(ax+k))*4;o.data[p]=255;o.data[p+1]=0;o.data[p+2]=0;o.data[p+3]=255;}}return o;}
const side=new PNG({width:cw*4*2+8,height:ch*4});
const a=cropZoom(A),b=cropZoom(B);
for(let y=0;y<side.height;y++)for(let x=0;x<side.width;x++){let s,d;
 if(x<cw*4){s=(y*cw*4+x)*4;d=(y*side.width+x)*4;}else{s=((y*cw*4)+(x-cw*4-8))*4;d=(y*side.width+x)*4;}
 side.data[d]=a.data[s]!==undefined&&x<cw*4?a.data[s]:b.data[s];}
/* 上面拼装太绕，直接两段拷贝 */
for(let y=0;y<ch*4;y++)for(let x=0;x<cw*4;x++){
 const sa=(y*cw*4+x)*4,da=(y*side.width+x)*4;side.data[da]=a.data[sa];side.data[da+1]=a.data[sa+1];side.data[da+2]=a.data[sa+2];side.data[da+3]=a.data[sa+3];
 const sb=(y*cw*4+x)*4,db=(y*side.width+x+cw*4+8)*4;side.data[db]=b.data[sb];side.data[db+1]=b.data[sb+1];side.data[db+2]=b.data[sb+2];side.data[db+3]=b.data[sb+3];}
fs.writeFileSync(path.join(OUT,'zoom-'+tag),PNG.sync.write(mark(side)));
console.log(tag+' 差异像素 '+pts.length+' 最密窗中心('+best.x+','+best.y+') 窗内 '+best.n+'  裁片 '+x0+','+y0+' '+cw+'x'+ch+' 设备px → 4x 左fresh|右基线, 红=差异');
