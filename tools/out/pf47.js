const fs=require('fs');
const V='tools/verify.js';
const Q=[
 [V,'  const view47 = f => /\.md$/.test(f) ? ws47(rd47(f)) : flat47(rd47(f));'],
 [V,"  const view47 = f => flat47(rd47(f));"],
 [V,'  const flat47 = s => ws47(s);'],
 [V,"    const RE47P = /closePanel\s*\(/g;"],
 [V,"    ['sync-webdav.js', 'var settled = false;', 1],"],
 [V,"    ['sync-webdavX.js', 'function putEnv(c, env, cb) {', 1,"],
 [V,"    ['settings.html', '清除全部数据ZZZ',"],
 [V,"    ['travel-notes.js', 'function panelDirty() {', 1,"],
 ['settings.html',"          $('wdPushBtn').textContent = '正在上传…';"],
 ['settings.html',"        WebDAV.push(function (err, r) {"],
 ['settings.html',"        /* 改前没有这一句 */"],
 ['travel-notes.js',"      flash('已清除全部数据');"],
 ['travel-notes.js',"    if (force) {"],
 ['travel-notes.js',"  function closePanel() {"],
 ['sync-webdav.js',"        if (true) { stage('upload'); putEnv(c, env, cb); return; }"],
 ['sync-webdav.js',"      if (r.status === 404) { cb(null, { exists: false }); return; }"],
 ['sync-webdav.js',"    p.risky = p.lose > 0;"],
 ['sync-webdav.js',"      title: '确定要上传吗', danger: false, okText: '确定',"],
 ['sync-webdav.js',"          if (!ok) { return; }"],
 ['sync-webdav.js',"        try { UI.tileWarn && UI.tileWarn('自动上传已跳过：' + why); } catch (e) {}"],
];
for(const [f,s] of Q){const t=fs.readFileSync(f,'utf8');console.log('hits='+ (t.split(s).length-1) + '  '+f+' :: '+s.slice(0,60));}
