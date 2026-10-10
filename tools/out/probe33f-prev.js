/* 自证 --update 留档这一改动：① prev 目录条数 ② prev 内容 == 覆盖前基线 ③ 单页 update 有没有动到别的态 */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0,16);
const B='tools/out/visual-baseline',P='tools/out/visual-baseline-prev';
const m=JSON.parse(fs.readFileSync('tools/out/visual-baseline.json','utf8')).files;
const pb=fs.readdirSync(P).filter(x=>x.endsWith('.png'));
console.log('prev 张数 '+pb.length+'  基线张数 '+fs.readdirSync(B).filter(x=>x.endsWith('.png')).length);
let same=0,diff=[];
for(const f of pb){const a=sha(path.join(P,f)),b=sha(path.join(B,f));if(a===b)same++;else diff.push(f+' prev '+a+' → 现 '+b+'（清单登记 '+(m[f]?m[f].sha:'未登记')+'）');}
console.log('prev 与现基线逐字节相同 '+same+' 张；不同 '+diff.length+' 张');
diff.forEach(d=>console.log('  '+d));
console.log('抽查 topic.320x640（今天换过帧的那档）prev='+sha(path.join(P,'topic.320x640.png'))+' 现='+sha(path.join(B,'topic.320x640.png'))+' 清单='+(m['topic.320x640.png']||{}).sha);
