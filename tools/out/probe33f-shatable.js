/* 把上一读的「fresh == 旧登记」从眼看变成对账：三本名单一起查 */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0,16);
const cur=JSON.parse(fs.readFileSync('tools/out/visual-baseline.json','utf8')).files;
const head=JSON.parse(fs.readFileSync('tools/out/b33f-manifest-HEAD.json','utf8')).files;
const F='tools/out/b33f-shots-floor';
const rows=[];
for(const t of fs.readdirSync(F).filter(x=>x.endsWith('.png')&&!x.startsWith('diff-'))){
  const h=sha(path.join(F,t));
  rows.push({tag:t,fresh:h,nowReg:cur[t]&&cur[t].sha,headReg:head[t]&&head[t].sha,
    freshEqNow:cur[t]&&cur[t].sha===h?'是':'否',freshEqHead:head[t]&&head[t].sha===h?'是':'否',
    nowEqHead:(cur[t]&&head[t])?(cur[t].sha===head[t].sha?'同':'**变**'):''});
}
rows.forEach(r=>console.log([r.tag,r.fresh,'本次清单',r.nowReg,'旧清单',r.headReg,'本次登记='+r.freshEqNow,'本次登记='+r.freshEqHead,r.nowEqHead].join(' | ')));
