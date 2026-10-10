/* 一次性：判「10-07 那批 *.cur.png」是否就是旧基线本体（sha 与 HEAD 清单登记一致） */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,16);
const oldM=JSON.parse(fs.readFileSync('tools/out/b33f-manifest-HEAD.json','utf8'));
const files=oldM.files||oldM;
const dir='tools/out/visual-diff';
let eq=0,ne=0,miss=0;const lines=[];
for(const k of Object.keys(files)){
  const cur=path.join(dir,k.replace(/\.png$/,'.cur.png'));
  if(!fs.existsSync(cur)){miss++;lines.push('缺 '+k);continue;}
  const h=sha(fs.readFileSync(cur));
  if(h===files[k].sha)eq++;else{ne++;lines.push('不等 '+k+' 旧登记 '+files[k].sha+' / cur '+h);}
}
console.log('旧清单条数 '+Object.keys(files).length+'  cur==旧登记 '+eq+'  不等 '+ne+'  cur 缺失 '+miss);
lines.slice(0,20).forEach(l=>console.log('  '+l));
