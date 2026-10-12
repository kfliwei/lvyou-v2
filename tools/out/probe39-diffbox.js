const fs=require('fs'),path=require('path'),{PNG}=require('pngjs');
const BASE='tools/out/visual-baseline',CUR='tools/out/visual-diff';
const names=process.argv.slice(2);
for (const name of names) {
  const a=PNG.sync.read(fs.readFileSync(path.join(BASE,name)));
  const b=PNG.sync.read(fs.readFileSync(path.join(CUR,name.replace(/\.png$/,'.cur.png'))));
  const W=Math.min(a.width,b.width),H=Math.min(a.height,b.height);
  /* 只认「这一处两个文件确实不同」的像素：逐通道最大差 > 20 */
  let n=0,x0=1e9,y0=1e9,x1=-1,y1=-1;const bands={};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(a.width*y+x)*4,j=(b.width*y+x)*4;
    const d=Math.max(Math.abs(a.data[i]-b.data[j]),Math.abs(a.data[i+1]-b.data[j+1]),Math.abs(a.data[i+2]-b.data[j+2]));
    if(d>20){n++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;const k=Math.floor(y/20)*20;bands[k]=(bands[k]||0)+1;}}
  const rows=Object.entries(bands).sort((p,q)=>Number(p[0])-Number(q[0])).filter(e=>e[1]>0);
  const runs=[];let s=null,pv=-1;
  for(const [k,v] of rows){const y=Number(k);if(s===null||y!==pv+20){if(s!==null)runs.push(s+'-'+(pv+20)+':'+sN);s=y;sN=0;}sN+=v;pv=y;}
  if(s!==null)runs.push(s+'-'+(pv+20)+':'+sN);
  console.log(name,'CSS 尺寸 '+W/2+'x'+H/2+'（截图是 2x）','差异像素',n,'＝', (100*n/(W*H)).toFixed(2)+'%');
  console.log('   竖直分布（截图 px）', runs.join('  '));
  console.log('   水平范围', x0+'-'+x1);
}
