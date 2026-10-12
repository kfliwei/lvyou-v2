const fs=require('fs'),{PNG}=require('pngjs');
const name=process.argv[2], x=Number(process.argv[3]), y0=Number(process.argv[4]), y1=Number(process.argv[5]);
const p=f=>PNG.sync.read(fs.readFileSync(f));
const a=p('tools/out/visual-baseline/'+name), b=p('tools/out/visual-diff/'+name.replace('.png','.cur.png'));
const run=(img,label)=>{let s=null,out=[];
  for(let y=y0*2;y<y1*2;y++){const i=(img.width*y+x*2)*4;
    const brown=img.data[i]>120&&img.data[i]<200&&img.data[i+1]<110&&img.data[i+2]<90;
    if(brown&&s===null)s=y; if(!brown&&s!==null){out.push([s/2,(y-1)/2]);s=null;}}
  if(s!==null)out.push([s/2,(y1*2-1)/2]);
  console.log(label,'x='+x+' 上棕褐色连续段（CSS y）:', out.map(r=>r[0]+'–'+r[1]+' 高'+(r[1]-r[0]+1)).join(' | '));};
run(a,'基线');run(b,'当前');
