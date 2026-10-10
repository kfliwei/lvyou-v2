const fs=require('fs');
const cur=JSON.parse(fs.readFileSync('tools/out/visual-baseline.json','utf8')).files;
const old=JSON.parse(fs.readFileSync('tools/out/b33f-manifest-HEAD.json','utf8')).files;
const ch=[],un=[];
for(const k of Object.keys(cur)){ if(!old[k]){un.push(k+' 新增');continue;} if(old[k].sha!==cur[k].sha)ch.push(k+' '+old[k].sha+'→'+cur[k].sha); }
for(const k of Object.keys(old)) if(!cur[k]) un.push(k+' 消失');
console.log('清单条数 旧 '+Object.keys(old).length+' / 现 '+Object.keys(cur).length);
console.log('指纹变化 '+ch.length+' 条：'); ch.forEach(x=>console.log('  '+x));
console.log('条数异常 '+un.length+' 条：'); un.forEach(x=>console.log('  '+x));
