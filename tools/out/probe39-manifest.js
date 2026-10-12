const A=require('./b39-manifest-head.json').files, B=require('./visual-baseline.json').files;
const ka=Object.keys(A), kb=Object.keys(B);
const added=kb.filter(k=>!A[k]), removed=ka.filter(k=>!B[k]);
const changed=kb.filter(k=>A[k]&&(A[k].sha!==B[k].sha||A[k].bytes!==B[k].bytes));
console.log('条目 HEAD',ka.length,'→ 现在',kb.length,'| 新增',added.length,'| 删除',removed.length,'| sha/bytes 变了',changed.length,'| 完全相同',kb.length-added.length-changed.length);
for(const k of changed)console.log('  变:',k,'sha',A[k].sha,'→',B[k].sha,'bytes',A[k].bytes,'→',B[k].bytes,'差',B[k].bytes-A[k].bytes);
if(added.length)console.log('  新增:',added.join(','));
if(removed.length)console.log('  删除:',removed.join(','));
