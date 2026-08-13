/* tools/patch-nm-v2.js — 节点管理页增强：
 * 1. 实时模糊搜索（防抖 260ms，输入即出结果，清空即关闭）
 * 2. 编辑窗体：海拔自动获取（高德 elevation，fallback Open-Meteo）+ 逆地理自动填城市 + AI 生成介绍（DeepSeek）
 * 3. 用户节点数据模型增加 elev / province 自动填充
 */
const fs = require('fs');
const p = 'node-manager.html';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/\r\n/g, '\n');
let n = 0;
function rep(from, to, tag) {
  if (!s.includes(from)) { console.log('SKIP', tag); return; }
  s = s.split(from).join(to);
  n++;
  console.log('OK  ', tag);
}

/* 1. 实时搜索：input 防抖 + 清空关闭 */
rep(
  `  $('rsClose').onclick = function () { $('rsSheet').classList.remove('show'); };
  $('qGo').onclick = doSearch;
  $('q').onkeydown = function (e) { if (e.key === 'Enter') doSearch(); };`,
  `  $('rsClose').onclick = function () { $('rsSheet').classList.remove('show'); };
  $('qGo').onclick = doSearch;
  $('q').onkeydown = function (e) { if (e.key === 'Enter') doSearch(); };
  /* 实时模糊搜索：边输入边显示结果（防抖 260ms） */
  var searchTimer = null;
  $('q').oninput = function () {
    clearTimeout(searchTimer);
    var v = this.value.trim();
    if (!v) { $('rsSheet').classList.remove('show'); return; }
    searchTimer = setTimeout(doSearch, 260);
  };`,
  '1.realtime search'
);

/* 2. 高德 JSONP 工具 + 逆地理 + 海拔（插在 promptKey 前） */
rep(
  `  function promptKey(retry) {`,
  `  function amapJsonp(url, cb) {
    var cbName = 'amapCb' + Date.now().toString(36) + Math.floor(Math.random() * 9999);
    window[cbName] = function (data) { delete window[cbName]; cb(data); };
    var s = document.createElement('script');
    s.src = url + '&callback=' + cbName;
    s.onerror = function () { delete window[cbName]; cb(null); };
    document.head.appendChild(s);
  }
  /* 自动填充：逆地理（省市/地址）+ 海拔（高德 elevation，失败降级 Open-Meteo） */
  function autoFill(lat, lng) {
    var key = localStorage.getItem('tn_amap_key');
    if (key) {
      amapJsonp('https://restapi.amap.com/v3/geocode/regeo?key=' + encodeURIComponent(key) + '&location=' + lng + ',' + lat + '&extensions=base', function (d) {
        if (d && d.status === '1' && d.regeocode) {
          var ac = d.regeocode.addressComponent || {};
          var prov = ac.province || '', city = ac.city || ac.province || '';
          var el = document.getElementById('nmCity');
          if (el && !el.value && city) el.value = city;
          if (prov) window.__nmProvince = prov;
          var desc = document.getElementById('nmDesc');
          if (desc && !desc.value && d.regeocode.formatted_address && d.regeocode.formatted_address !== city) {
            desc.placeholder = '节点介绍（' + d.regeocode.formatted_address + '）';
          }
        }
      });
      amapJsonp('https://restapi.amap.com/v3/elevation/rectangle?key=' + encodeURIComponent(key) + '&locations=' + lng + ',' + lat, function (d) {
        var el = document.getElementById('nmElev');
        if (el && d && d.status === '1' && d.data && d.data.length) {
          var e = Math.round(+d.data[0].elevation);
          if (!isNaN(e) && !el.value) el.value = e;
        }
      });
    }
    /* 无高德 key 或失败时的海拔兜底：Open-Meteo（无需 key，CORS 开放） */
    fetch('https://api.open-meteo.com/v1/elevation?latitude=' + lat + '&longitude=' + lng)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var el = document.getElementById('nmElev');
        if (el && d && d.elevation != null && !el.value) el.value = Math.round(d.elevation);
      }).catch(function () {});
  }
  /* AI 生成节点介绍（DeepSeek，复用设置页的 AI Key） */
  function genDesc() {
    var name = document.getElementById('nmName').value.trim();
    if (!name) { UI.toast('先填写名称再生成介绍'); return; }
    var key = localStorage.getItem('tn_aiKey');
    if (!key) { UI.toast('请先在设置页配置 AI Key（DeepSeek）'); return; }
    var city = document.getElementById('nmCity').value.trim();
    var cat = document.getElementById('nmCat').value.trim();
    var btn = document.getElementById('nmGenDesc');
    btn.textContent = '生成中…';
    btn.disabled = true;
    fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: localStorage.getItem('tn_model') || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是旅行地点编辑助手，输出简洁准确的介绍。' },
          { role: 'user', content: '为旅行地点「' + name + '」' + ([city, cat].filter(Boolean).length ? '（' + [city, cat].filter(Boolean).join('，') + '）' : '') + '写一段 60-100 字的介绍：亮点、适合季节、注意事项。口语化，不要列表编号，不要编造不确定的史实。' }
        ],
        temperature: 0.7
      })
    }).then(function (r) { return r.json(); }).then(function (d) {
      var t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (t) { document.getElementById('nmDesc').value = t.trim(); UI.toast('介绍已生成，可再手动微调'); }
      else { UI.toast('生成失败：' + ((d && d.error && d.error.message) || '未知错误')); }
    }).catch(function () { UI.toast('生成失败，请检查网络'); })
      .then(function () { btn.textContent = '✨ 生成介绍'; btn.disabled = false; });
  }

  function promptKey(retry) {`,
  '2.autofill + genDesc'
);

/* 3. 表单：海拔输入 + 自动填充触发 + AI 介绍按钮 */
rep(
  `      '<input id="nmTags" class="nm-in" placeholder="标签（空格分隔，如 拍照 小众）" value="' + esc(((preset && preset.tags) || []).join(' ')) + '">' +
      '<textarea id="nmDesc" class="nm-ta" placeholder="简介 / 备注（可选）" rows="2">' + esc((preset && preset.desc) || '') + '</textarea>' +`,
  `      '<input id="nmTags" class="nm-in" placeholder="标签（空格分隔，如 拍照 小众）" value="' + esc(((preset && preset.tags) || []).join(' ')) + '">' +
      '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">' +
      '<input id="nmElev" class="nm-in" type="number" placeholder="海拔（米，自动获取）" style="flex:1;margin-bottom:0" value="' + esc((preset && preset.elev) || '') + '">' +
      '<button id="nmElevGo" type="button" class="ui-btn" style="min-height:40px;flex:0 0 auto;padding:0 14px" aria-label="重新获取海拔">⟳</button></div>' +
      '<textarea id="nmDesc" class="nm-ta" placeholder="节点介绍（可 ✨ 自动生成）" rows="3">' + esc((preset && preset.desc) || '') + '</textarea>' +
      '<div style="text-align:right;margin:-2px 0 8px"><button id="nmGenDesc" type="button" class="ui-btn" style="min-height:34px;padding:0 12px;font-size:12px">✨ 生成介绍</button></div>' +`,
  '3.form elev + gen button'
);

/* 4. 表单打开时触发自动填充 */
rep(
  `    document.getElementById('nmName').focus();
    var dupEl = m.querySelector('#nmDup');`,
  `    document.getElementById('nmName').focus();
    if (preset && preset.lat != null) { autoFill(preset.lat, preset.lng); }
    document.getElementById('nmElevGo').onclick = function () {
      if (preset && preset.lat != null) {
        document.getElementById('nmElev').value = '';
        autoFill(preset.lat, preset.lng);
      }
    };
    document.getElementById('nmGenDesc').onclick = genDesc;
    var dupEl = m.querySelector('#nmDup');`,
  '4.autofill on open'
);

/* 5. 保存：elev + province 自动填充 */
rep(
  `        var rec = {
          id: (preset && preset.uid) || Date.now().toString(36),
          name: name,
          lat: preset.lat, lng: preset.lng,
          gcj: !!(preset && preset.gcj),
          province: (preset && preset.province) || '',
          city: document.getElementById('nmCity').value.trim(),
          category: document.getElementById('nmCat').value.trim() || '其他',
          tags: document.getElementById('nmTags').value.trim().split(/\\s+/).filter(Boolean),
          desc: document.getElementById('nmDesc').value.trim(),
          createdAt: (preset && preset.createdAt) || Date.now()
        };`,
  `        var rec = {
          id: (preset && preset.uid) || Date.now().toString(36),
          name: name,
          lat: preset.lat, lng: preset.lng,
          gcj: !!(preset && preset.gcj),
          province: (preset && preset.province) || window.__nmProvince || '',
          city: document.getElementById('nmCity').value.trim(),
          category: document.getElementById('nmCat').value.trim() || '其他',
          tags: document.getElementById('nmTags').value.trim().split(/\\s+/).filter(Boolean),
          elev: document.getElementById('nmElev').value.trim(),
          desc: document.getElementById('nmDesc').value.trim(),
          createdAt: (preset && preset.createdAt) || Date.now()
        };`,
  '5.save elev+province'
);

fs.writeFileSync(p, s, 'utf8');
console.log('=== applied', n, 'patches ===');
