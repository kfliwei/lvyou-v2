/* ============================================================
   成果生成模块 · 把游记/景点/名言/AI 加工成可带走的结果
   ------------------------------------------------------------
   · 旅行纪念册（年鉴）：统计 + 每篇游记 + 名言
   · 个人旅行图鉴：探访景点成册
   · 定制路书：偏好 → 每日行程
   · 旅程故事：时间范围 → AI 叙事
   公共：数据聚合 / HTML 文档 / 长图分享 / 保存 / AI 调用
   依赖：travel-notes.js（TravelNotes）、quotes.js（QUOTES）
   ============================================================ */
(function () {
  /* 深色适配：成果弹窗内联浅色 → 主题变量（注入一次，覆盖所有 rz-panel） */
  (function () {
    var st = document.createElement('style');
    st.textContent =
      '.theme-dark .rz-panel{background:var(--color-surface)!important}' +
      '.theme-dark .rz-panel div,.theme-dark .rz-panel span,.theme-dark .rz-panel h4,.theme-dark .rz-panel p{color:var(--color-ink)!important}' +
      '.theme-dark .rz-panel select,.theme-dark .rz-panel input,.theme-dark .rz-panel textarea{background:var(--color-surface)!important;color:var(--color-ink)!important;border-color:var(--color-line)!important}';
    document.head.appendChild(st);
  })();
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function el(tag, cls, html) { var d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function flash(msg) {
    var f = document.createElement('div');
    f.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px)+14px);left:50%;transform:translateX(-50%);background:rgba(32,32,29,.92);color:#fff;padding:11px 20px;border-radius:10px;font-size:13.5px;font-weight:700;z-index:9500;box-shadow:0 6px 24px rgba(30,30,28,.3);white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis';
    f.textContent = msg; document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 2400);
  }
  function aiKey() { try { return localStorage.getItem('tn_aiKey'); } catch (e) { return ''; } }
  function aiModel() { var m = localStorage.getItem('tn_model') || 'deepseek-v4-flash'; var a = { 'deepseek-chat': 'deepseek-v4-flash', 'deepseek-reasoner': 'deepseek-v4-pro' }; return a[m] || m; }
  function aiCall(messages, cb, stream) {
    if (!(window.Ai && Ai.hasKey())) { if (cb) cb(null, '未配置 AI key，请到 设置 → AI 润色 填入 DeepSeek key 后重试'); return; }
    if (stream === false) {
      Ai.chat(messages).then(function (t) { cb(t); }).catch(function (e) { cb(null, String(e && e.message || e)); });
      return;
    }
    Ai.stream(messages).then(function (t) { cb(t); }).catch(function (e) { cb(null, String(e && e.message || e)); });
  }
  /* ============ 本地兜底（无 AI Key 时也能出结果） ============ */
  /* 旅程故事：把时间线记录组织成一篇叙事散文 */
  function localStory(list) {
    var uniq = {}; list.forEach(function (x) { if (x.siteName) uniq[x.siteName] = 1; });
    var places = Object.keys(uniq);
    var head = list[0], tail = list[list.length - 1];
    var span = (head && tail && head.date && tail.date) ? (head.date + ' 到 ' + tail.date) : '这段时间';
    var body = list.map(function (x) {
      var w = x.weather ? '，' + x.weather : '';
      return '· ' + x.date + '，来到' + (x.siteName || '某处') + w + '。' + (x.text || x.raw || '').replace(/\s+/g, ' ').slice(0, 80);
    }).join('\n');
    var close = places.length ? '走过的' + places.length + '个地方，' : '';
    return '这是一段属于' + span + '的旅程。\n\n' + body + '\n\n' + close + '把风景和心情都收进了行囊。愿下一次出发，仍有热爱。';
  }
  /* 定制路书：贪心最近邻 + 按天切分，不依赖 AI */
  function localItinerary(sites, days) {
    var hav = (window.Geo && Geo.hav) ? Geo.hav : function () { return 0; };
    var pool = sites.filter(function (s) { return s && s.lat != null && s.lng != null; });
    if (pool.length < 2) pool = sites.slice();
    var ordered = [pool[0]];
    var rest = pool.slice(1);
    while (rest.length) {
      var last = ordered[ordered.length - 1];
      var bi = 0, bd = Infinity;
      rest.forEach(function (s, i) { var d = hav(last.lat, last.lng, s.lat, s.lng); if (d < bd) { bd = d; bi = i; } });
      ordered.push(rest.splice(bi, 1)[0]);
    }
    var per = Math.max(1, Math.min(6, Math.ceil(ordered.length / days)));
    var out = [];
    for (var i = 0; i < days; i++) {
      var chunk = ordered.slice(i * per, i * per + per);
      if (!chunk.length) break;
      out.push('【第 ' + (i + 1) + ' 天】' + chunk.map(function (s) { return s.label || s.name; }).join(' → '));
    }
    return out.join('\n\n') + '\n\n（本地排程，按地理顺路切分；配置 AI Key 可生成更细的衔接建议）';
  }
  /* 保存 HTML 文档（App 下载 / 浏览器下载 / 复制） */
  function saveDoc(name, html) {
    var d = el('div', 'rz-dlg');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9400;padding:18px 16px calc(env(safe-area-inset-bottom,0px)+20px);background:var(--color-surface);border:1px solid var(--color-line);border-top:1px solid var(--color-primary);border-radius:16px 16px 0 0;box-shadow:0 -10px 40px rgba(30,30,28,.18);display:block';
    d.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-family:&quot;Songti SC&quot;,serif;font-size:17px;color:var(--color-ink)">' + esc(name) + ' <button id="rzX" style="border:0;background:var(--color-bg-soft);border-radius:8px;width:34px;height:34px;color:var(--color-muted);font-size:15px;cursor:pointer">✕</button></div>'
      + '<div id="rzPrev" style="border:1px solid var(--color-line);border-radius:12px;max-height:40vh;overflow-y:auto;font-size:10.5px;color:var(--color-muted);padding:12px;white-space:pre-wrap;background:var(--color-surface)">' + esc(html.slice(0, 2000)) + (html.length > 2000 ? '…（共 ' + html.length + ' 字符）' : '') + '</div>'
      + '<button id="rzSave" class="btn-primary" style="width:100%;margin-top:12px">保存文档</button>'
      + '<button id="rzCopy" class="btn-secondary" style="width:100%;margin-top:8px">复制 HTML</button>';
    document.body.appendChild(d);
    var X = function (id) { return d.querySelector('#' + id); };
    X('rzX').onclick = function () { d.remove(); };
    X('rzCopy').onclick = function () {
      var ta = document.createElement('textarea'); ta.value = html; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); flash('HTML 已复制'); } catch (e) { flash('复制失败'); }
      ta.remove();
    };
    X('rzSave').onclick = function () {
      if (window.AndroidVoice && window.AndroidVoice.saveTextFile) {
        window.__tnSaveDone = function (r) {
          if (r === 'err') flash('保存失败');
          else if (r === 'need_perm') flash('需要存储权限');
          else flash('已保存：Download/' + r);
        };
        try { AndroidVoice.saveTextFile(name + '.html', html); } catch (e) { flash('保存不可用，请用复制'); }
      } else {
        var a = document.createElement('a'); a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html); a.download = name + '.html'; a.click();
        flash('已下载');
      }
    };
  }
  /* 长图分享（canvas 生成） */
  function shareCanvas(title, subtitle, body, theme) {
    var t = theme || 0;
    var themes = [
      { bg: ['#2E3B42', '#20201D', '#1A1A18'], fg: '#FAF8F3', accent: 'rgba(200,109,75,.08)' },
      { bg: ['#A9563B', '#8F4A33', '#7D3A28'], fg: '#FAF8F3', accent: 'rgba(250,248,243,.10)' },
      { bg: ['#F0EDE5', '#E6E1D7', '#D8D4CB'], fg: '#20201D', accent: 'rgba(200,109,75,.07)' }
    ];
    var th = themes[t % themes.length];
    var W = 1080, H = Math.max(1440, 720 + body.length * 0.62);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = th.accent;
    for (var i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(120 + i * 120, 300 + (i % 3) * 380, 90, 0, Math.PI * 2); ctx.fill(); }
    ctx.textAlign = 'center';
    ctx.fillStyle = th.fg; ctx.font = 'bold 60px "Songti SC",serif';
    wrapText(ctx, title, W / 2, 150, W - 120, 78);
    ctx.font = '26px "Noto Serif SC",serif'; ctx.globalAlpha = .75;
    ctx.fillText(subtitle, W / 2, 220);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.font = '28px "Noto Serif SC",serif'; ctx.lineHeight = 1.7;
    wrapText(ctx, body, 100, 300, W - 200, 48);
    var dataUrl = cv.toDataURL('image/png');
    if (window.AndroidVoice && window.AndroidVoice.saveImage) {
      window.__tnImgSaved = function (r) { flash(r === 'err' ? '保存失败' : '长图已保存：Download/' + r); };
      try { AndroidVoice.saveImage(title + '.png', dataUrl); } catch (e) { flash('保存不可用'); }
    } else {
      var a = document.createElement('a'); a.href = dataUrl; a.download = title + '.png'; a.click();
      flash('长图已生成');
    }
  }
  function wrapText(ctx, text, x, y, maxW, lh) {
    var chars = String(text).split('');
    var line = '';
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = chars[i]; y += lh; }
      else line = test;
    }
    if (line) { ctx.fillText(line, x, y); }
  }
  /* 统计游记（可传入过滤后的 notes） */
  function summarize(notesIn) {
    var notes = notesIn || (window.TravelNotes ? TravelNotes.list() : []);
    var withLoc = notes.filter(function (n) { return n.lat != null; });
    var provinces = {}, dynasties = {}, types = {}, days = new Set(), cities = new Set();
    notes.forEach(function (n) {
      var d = (n.date || '').slice(0, 10); if (d) days.add(d);
      if (n.province) provinces[n.province] = 1;
    });
    withLoc.forEach(function (n) {
      var s = n.siteName || '';
      if (s) cities.add(s);
    });
    var km = 0;
    for (var i = 1; i < withLoc.length; i++) {
      var a = withLoc[i - 1], b = withLoc[i];
      km += window.Geo.hav(a.lat, a.lng, b.lat, b.lng);
    }
    return {
      notes: notes, count: notes.length, withLoc: withLoc.length, sites: cities.size,
      days: days.size, km: Math.round(km),
      provinces: Object.keys(provinces).length,
      photos: notes.reduce(function (s, n) { return s + (n.photos ? n.photos.length : 0); }, 0),
      audio: notes.reduce(function (s, n) { return s + (n.audio ? 1 : 0); }, 0)
    };
  }
  function docShell(title, subtitle, body) {
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>'
      + '<style>body{margin:0;background:#F7F5EF;font-family:&quot;PingFang SC&quot;,&quot;Microsoft YaHei&quot;,sans-serif}'
      + '.cover{background:linear-gradient(135deg,#20201D,#1A1A18);color:#fff;padding:44px 24px;text-align:center}'
      + '.cover h1{margin:0;font-size:30px;font-family:&quot;Songti SC&quot;,serif}'
      + '.cover p{margin:10px 0 0;font-size:14px;opacity:.85}'
      + '.wrap{max-width:720px;margin:0 auto;padding:18px}'
      + '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}'
      + '.stat{background:#fff;border-radius:14px;padding:16px 10px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.06)}'
      + '.stat b{display:block;font-size:26px;color:#C86D4B;font-family:&quot;Songti SC&quot;,serif}'
      + '.stat span{font-size:12px;color:#7D7970}'
      + '.card{background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:18px;margin-bottom:16px}'
      + '.card h2{margin:0 0 4px;font-size:18px;color:#20201D}'
      + '.card .m{color:#7D7970;font-size:12px;margin-bottom:8px}'
      + '.card .t{white-space:pre-wrap;line-height:1.8;font-size:14px;color:#333}'
      + '.q{margin:8px 0 0;font-size:13px;color:#8a6408;font-family:&quot;Noto Serif SC&quot;,serif;border-left:3px solid #C86D4B;padding-left:10px}'
      + '.tag{display:inline-block;background:rgba(200,109,75,.10);color:#C86D4B;border-radius:999px;font-size:11px;padding:2px 9px;margin:0 4px 4px 0}'
      + '@media print{body{background:#fff}.card{box-shadow:none;border:1px solid #ddd}}'
      + '</style></head><body><div class="cover"><h1>' + esc(title) + '</h1><p>' + esc(subtitle) + '</p></div><div class="wrap">' + body + '</div></body></html>';
  }
  /* 从游记里取可用省/市集合 */
  function geoOptions(notes) {
    var provs = {}, cities = {};
    notes.forEach(function (n) {
      if (n.province) provs[n.province] = 1;
      if (n.city) cities[(n.city || '') + '|' + (n.province || '')] = n.city;
    });
    return {
      provs: Object.keys(provs).sort(),
      cities: Object.keys(cities).sort()
    };
  }
  /* 过滤游记：优先走 IDB 索引/范围查询，否则内存 filter；结果回调 cb(arr) */
  function filterNotes(notes, prov, city, rangeDays, fromDay, toDay, cb) {
    var cutoff = rangeDays ? Date.now() - rangeDays * 86400000 : 0;
    function apply(rows) {
      var out = rows.filter(function (n) {
        if (prov && n.province !== prov) return false;
        if (city && n.city !== city) return false;
        if (cutoff && (!n.ts || n.ts < cutoff)) return false;
        return true;
      });
      cb(out);
    }
    // 只有时间条件时才走索引/范围查询；省份/城市条件后续内存过滤
    var tn = window.TravelNotes;
    if (tn && tn.queryRange && (fromDay || toDay || rangeDays)) {
      var f = fromDay, t = toDay;
      if (rangeDays && !f && !t) {
        f = dayStr(Date.now() - rangeDays * 86400000);
      }
      try {
        tn.queryRange(f, t, function (rows) { apply(rows); });
        return;
      } catch (e) {}
    }
    apply(notes);
  }
  function dayStr(ts) {
    var d = new Date(ts); function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  /* 共用「筛选 + 生成」面板 */
  function openFilterPanel(kind, label, icon, emptyMsg, render) {
    var all = window.TravelNotes ? TravelNotes.list() : [];
    if (!all.length) { (window.UI && window.UI.toast ? window.UI.toast(emptyMsg) : flash(emptyMsg)); return; }
    var opts = geoOptions(all);
    var d = el('div', 'rz-dlg');
    d.style.cssText = 'position:fixed;inset:0;z-index:9450;background:rgba(32,32,29,.5);display:flex;align-items:center;justify-content:center;padding:20px';
    d.innerHTML = '<div class="rz-panel" style="background:#FAF8F3;border-radius:20px;max-width:420px;width:100%;padding:22px;box-shadow:0 18px 50px rgba(30,30,28,.3);max-height:88vh;overflow-y:auto">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;font-family:&quot;Songti SC&quot;,serif;font-size:19px;color:#20201D;margin-bottom:4px">' + icon + ' ' + label + '</div>'
      + '<div style="font-size:12.5px;color:#7D7970;margin-bottom:14px">选择范围后生成，支持按省 / 市 / 时间筛选</div>'
      + '<div style="font-size:11.5px;color:#9c958a;margin-bottom:6px">省份（可多选跳过则不限）</div>'
      + '<select id="fp" style="width:100%;height:44px;border:1px solid rgba(32,32,29,.09);border-radius:12px;font-size:14px;padding:0 12px;background:#fff;color:#20201D;margin-bottom:10px">'
      + '<option value="">全部省份</option>' + opts.provs.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join('')
      + '</select>'
      + '<select id="fc" style="width:100%;height:44px;border:1px solid rgba(32,32,29,.09);border-radius:12px;font-size:14px;padding:0 12px;background:#fff;color:#20201D;margin-bottom:10px">'
      + '<option value="">全部城市</option>' + opts.cities.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('')
      + '</select>'
      + '<select id="ft" style="width:100%;height:44px;border:1px solid rgba(32,32,29,.09);border-radius:12px;font-size:14px;padding:0 12px;background:#fff;color:#20201D;margin-bottom:8px">'
      + '<option value="0">全部时间</option><option value="30">最近 30 天</option><option value="90">最近 90 天</option><option value="365">最近一年</option><option value="custom">自定义日期范围</option>'
      + '</select>'
      + '<div id="fdate" style="display:none;gap:8px;margin-bottom:10px">'
      + '<input type="date" id="ffrom" placeholder="开始日期" style="flex:1;min-width:0;height:44px;border:1px solid rgba(32,32,29,.09);border-radius:12px;font-size:14px;padding:0 8px;background:#fff;color:#20201D">'
      + '<input type="date" id="fto" placeholder="结束日期" style="flex:1;min-width:0;height:44px;border:1px solid rgba(32,32,29,.09);border-radius:12px;font-size:14px;padding:0 8px;background:#fff;color:#20201D">'
      + '</div>'
      + '<div id="fcount" style="font-size:12px;color:#9c958a;margin-bottom:12px">共 <b style="color:#C86D4B">' + all.length + '</b> 篇</div>'
      + '<button id="fgo" style="width:100%;height:48px;border:0;border-radius:12px;background:#C86D4B;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:&quot;Songti SC&quot;,serif">生成' + label + '</button>'
      + '</div>';
    document.body.appendChild(d);
    function close(){ d.remove(); }
    function readFilter() {
      var t = d.querySelector('#ft').value;
      var days = t === 'custom' ? 0 : parseInt(t, 10) || 0;
      var from = t === 'custom' ? d.querySelector('#ffrom').value : '';
      var to = t === 'custom' ? d.querySelector('#fto').value : '';
      return {
        prov: d.querySelector('#fp').value,
        city: d.querySelector('#fc').value,
        days: days, from: from, to: to
      };
    }
    function updateCount(){
      var f = readFilter();
      filterNotes(all, f.prov, f.city, f.days, f.from, f.to, function (n) {
        d.querySelector('#fcount').innerHTML = '符合条件的 <b style="color:#C86D4B">' + n.length + '</b> 篇';
      });
    }
    d.querySelector('#ft').onchange = function () {
      var custom = d.querySelector('#ft').value === 'custom';
      var fd = d.querySelector('#fdate');
      fd.style.display = custom ? 'flex' : 'none';
      updateCount();
    };
    /* 原生日期选择器：选择即生效，值格式固定为 YYYY-MM-DD */
    d.querySelectorAll('#ffrom, #fto').forEach(function (s) { s.onchange = updateCount; });
    d.querySelectorAll('#fp, #fc').forEach(function (s) { s.onchange = updateCount; });
    var goBtn = d.querySelector('#fgo');
    goBtn.onclick = function () {
      var f = readFilter();
      var isDate = /^\d{4}-\d{2}-\d{2}$/;
      if (f.from && !isDate.test(f.from)) { flash('开始日期格式应为 YYYY-MM-DD'); return; }
      if (f.to && !isDate.test(f.to)) { flash('结束日期格式应为 YYYY-MM-DD'); return; }
      if (f.from && f.to && f.from > f.to) { flash('开始日期不能晚于结束日期'); return; }
      if (goBtn._busy) return;
      goBtn._busy = true;
      filterNotes(all, f.prov, f.city, f.days, f.from, f.to, function (n) {
        goBtn._busy = false;
        if (!n.length) { flash('没有符合条件的游记'); return; }
        close();
        var range = f.from || f.to ? ((f.from || '…') + ' ~ ' + (f.to || '…')) : (f.days ? '近' + f.days + '天' : '全部时间');
        render(n, f.prov || '全部', f.city || '全部', range);
      });
    };
    d.onclick = function (e) { if (e.target === d) close(); };
    var x = el('button', '', '✕');
    x.style.cssText = 'position:absolute;top:10px;right:10px;width:30px;height:30px;border:0;background:#E6E1D7;border-radius:8px;color:#7D7970;cursor:pointer';
    x.onclick = close;
    d.firstChild.appendChild(x);
  }
  /* ============ 1. 旅行纪念册 ============ */
  function buildAlbum() {
    openFilterPanel('album', '旅行纪念册', '', '还没有游记，先去记录几篇吧', function (notes, prov, city, range) {
      var s = summarize(notes);
      if (!s.count) { flash('没有游记'); return; }
    var stats = '<div class="stats">'
      + '<div class="stat"><b>' + s.count + '</b><span>篇游记</span></div>'
      + '<div class="stat"><b>' + s.sites + '</b><span>处地点</span></div>'
      + '<div class="stat"><b>' + s.days + '</b><span>天旅程</span></div>'
      + '<div class="stat"><b>' + s.km + '</b><span>公里轨迹</span></div>'
      + '<div class="stat"><b>' + s.photos + '</b><span>张照片</span></div>'
      + '<div class="stat"><b>' + s.audio + '</b><span>段录音</span></div>'
      + '</div>';
    var cards = s.notes.slice().sort(function (a, b) { return b.ts - a.ts; }).map(function (n, i) {
      var pics = (n.photos && n.photos.length) ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">' + n.photos.map(function (p) { return '<img src="' + esc(p) + '" style="max-width:46%;border-radius:10px">'; }).join('') + '</div>' : '';
      var tags = (n.tags && n.tags.length) ? '<div style="margin:8px 0">' + n.tags.map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('') + '</div>' : '';
      var q = pickQuote(n.siteName || n.title || '');
      var quoteHtml = q ? '<div class="q">「' + esc(q.t) + '」——' + esc(q.a) + '</div>' : '';
      return '<div class="card"><h2>' + esc(n.title || n.siteName) + '</h2>'
        + '<div class="m">' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + (n.lat != null ? ' · ' + n.lat.toFixed(4) + ', ' + n.lng.toFixed(4) : '') + '</div>'
        + pics + tags + '<div class="t">' + esc(n.text || n.raw) + '</div>' + quoteHtml + '</div>';
    }).join('');
    var html = docShell('我的旅行纪念册', s.count + ' 篇游记 · ' + s.days + ' 天 · ' + prov + ' / ' + city + ' · ' + range + ' · 生成于 ' + new Date().toLocaleDateString(), stats + cards);
    saveDoc('我的旅行纪念册', html);
    });
  }
  /* ============ 3. 个人旅行图鉴 ============ */
  function buildAtlas() {
    openFilterPanel('atlas', '个人旅行图鉴', '', '还没有游记', function (notes, prov, city, range) {
      if (!notes.length) { flash('没有游记'); return; }
      var seen = {};
      var cards = notes.slice().sort(function (a, b) { return a.ts - b.ts; }).map(function (n) {
        var name = n.siteName || n.title || '';
        if (seen[name]) return '';
        seen[name] = 1;
        var q = pickQuote(name);
        var quoteHtml = q ? '<div class="q">「' + esc(q.t) + '」——' + esc(q.a) + '</div>' : '';
        return '<div class="card"><h2>' + esc(name) + '</h2>'
          + '<div class="m">首次探访 ' + esc(n.date) + (n.weather ? ' · ' + esc(n.weather) : '') + '</div>'
          + (n.photos && n.photos[0] ? '<div style="margin:10px 0"><img src="' + esc(n.photos[0]) + '" style="max-width:100%;border-radius:12px"></div>' : '')
          + '<div class="t">' + esc((n.text || n.raw || '').slice(0, 220)) + (n.text && n.text.length > 220 ? '…' : '') + '</div>' + quoteHtml + '</div>';
      }).join('');
      var html = docShell('个人旅行图鉴', '探访 ' + Object.keys(seen).length + ' 处 · ' + prov + ' / ' + city + ' · ' + range + ' · 生成于 ' + new Date().toLocaleDateString(), cards);
      saveDoc('个人旅行图鉴', html);
      });
  }
  /* 名言选取：优先按地点名匹配，否则取通用 */
  function pickQuote(kw) {
    var all = window.QUOTES || [];
    if (!all.length) return null;
    var k = (kw || '').toLowerCase();
    var hit = null;
    if (k) {
      hit = all.find(function (it) { return it.k.some(function (x) { return k.indexOf(x.toLowerCase()) >= 0; }); });
    }
    if (!hit) {
      var generic = all.filter(function (it) { return it.k.some(function (x) { return ['旅行', '旅途', '远方', '山川', '风景'].indexOf(x) >= 0; }); });
      hit = generic[Math.floor(Math.random() * generic.length)] || all[Math.floor(Math.random() * all.length)];
    }
    return hit;
  }
  /* ============ 4. 旅程故事 ============ */
  function buildStory() {
    openFilterPanel('story', '旅程故事', '', '还没有游记，先去记录几篇吧', function (notes, prov, city, range) {
      if (!notes.length) { flash('该范围没有游记'); return; }
      var d = el('div', 'rz-dlg');
      d.style.cssText = 'position:fixed;inset:0;z-index:9450;background:rgba(32,32,29,.5);display:flex;align-items:center;justify-content:center;padding:20px';
      d.innerHTML = '<div class="rz-panel" style="background:#FAF8F3;border-radius:18px;max-width:440px;width:100%;padding:20px;box-shadow:0 18px 50px rgba(30,30,28,.3)">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;font-family:&quot;Songti SC&quot;,serif;font-size:18px;color:#20201D;margin-bottom:4px">生成旅程故事</div>'
        + '<div style="font-size:12px;color:#7D7970;margin-bottom:12px">' + notes.length + ' 篇游记 · ' + prov + ' / ' + city + ' · ' + range + '</div>'
        + '<div id="sbody" style="margin-top:12px;max-height:44vh;overflow-y:auto;line-height:1.9;font-size:14px;color:#333;white-space:pre-wrap;display:none"></div>'
        + '<div id="sact" style="display:none;margin-top:12px;gap:8px">'
        + '<button id="scopy" class="btn-secondary" style="flex:1">复制全文</button>'
        + '<button id="ssave" class="btn-primary" style="flex:1">保存文档</button>'
        + '</div>'
        + '<button id="sgo" class="btn-primary" style="width:100%;margin-top:14px">生成故事</button>'
        + '</div>';
      document.body.appendChild(d);
      d.onclick = function (e) { if (e.target === d) d.remove(); };
      var go = d.querySelector('#sgo'), body = d.querySelector('#sbody'), act = d.querySelector('#sact');
      function copyStory() {
        var ta = document.createElement('textarea'); ta.value = body.textContent; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); flash('故事已复制'); } catch (e) { flash('复制失败'); }
        ta.remove();
      }
      d.querySelector('#scopy').onclick = copyStory;
      d.querySelector('#ssave').onclick = function () {
        var title = '我的旅程故事';
        var html = docShell(title, prov + ' / ' + city + ' · ' + range + ' · 生成于 ' + new Date().toLocaleDateString(), '<div class="card"><div class="t">' + esc(body.textContent) + '</div></div>');
        if (window.AndroidVoice && window.AndroidVoice.saveTextFile) {
          window.__tnSaveDone = function (r) {
            if (r === 'err') flash('保存失败');
            else if (r === 'need_perm') flash('需要存储权限');
            else flash('已保存：Download/' + r);
          };
          try { AndroidVoice.saveTextFile(title + '.html', html); } catch (e) { flash('保存不可用，请用复制'); }
        } else {
          var a = document.createElement('a'); a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html); a.download = title + '.html'; a.click();
          flash('已下载');
        }
      };
      go.onclick = function () {
        var list = notes.slice().sort(function (a, b) { return a.ts - b.ts; });
        go.disabled = true; go.textContent = '⏳ 正在写故事…'; body.style.display = 'block'; body.textContent = ''; act.style.display = 'none';
        var timeline = list.map(function (n) {
          return n.date + ' 在' + (n.siteName || '某处') + (n.weather ? '（' + n.weather + '）' : '') + '：' + (n.text || n.raw || '').slice(0, 120);
        }).join('\n');
        /* 无 Key 本地兜底：时间线叙事，不让用户空手而归 */
        if (!(window.Ai && Ai.hasKey())) {
          go.disabled = false; go.textContent = '生成故事';
          body.textContent = localStory(list);
          act.style.display = 'flex';
          flash('已生成本地版故事（配置 AI Key 可获得更优文采）');
          return;
        }
        aiCall([
          { role: 'system', content: '你是旅行文学作家。根据用户旅程的时间线记录，写一篇 500-800 字、有画面感与情感的完整旅行故事，像一篇散文，时间顺序推进，可融入旅途感悟，不要编造未出现的史实。只输出故事正文。' },
          { role: 'user', content: timeline }
        ], function (text, err) {
          go.disabled = false; go.textContent = '生成故事';
          if (err) { body.textContent = '生成失败：' + err; return; }
          body.textContent = text;
          act.style.display = 'flex';
          flash('故事已生成');
        });
      };
      var x = el('button', '', '✕');
      x.style.cssText = 'position:absolute;top:10px;right:10px;width:30px;height:30px;border:0;background:#E6E1D7;border-radius:8px;color:#7D7970;cursor:pointer';
      x.onclick = function () { d.remove(); };
      d.firstChild.appendChild(x);
    });
  }
  /* ============ 2. 定制路书 ============ */
  function buildItinerary(sitesIn, topicLabel) {
    var sites = (sitesIn && sitesIn.length) ? sitesIn : (window.SITES || []);
    /* 无专题数据时，回退到「游记里带坐标的地点」，让回顾页的路书入口也可用 */
    if (!sites.length) {
      var loc = (window.TravelNotes && TravelNotes.list) ? TravelNotes.list().filter(function (n) { return n && n.lat != null && n.lng != null; }) : [];
      if (loc.length) {
        sites = loc.map(function (n) { return { name: n.siteName || n.title || '某处', label: n.siteName || n.title || '某处', lat: n.lat, lng: n.lng, city: n.city || '', county: '', theme: '', ty: '' }; });
        topicLabel = topicLabel || '我的足迹';
      }
    }
    if (!sites.length) { flash('还没有可用的景点：先去专题地图选点，或记录带位置的游记'); return; }
    var d = el('div', 'rz-dlg');
    d.style.cssText = 'position:fixed;inset:0;z-index:9450;background:rgba(32,32,29,.5);display:flex;align-items:center;justify-content:center;padding:20px';
    d.innerHTML = '<div class="rz-panel" style="background:#FAF8F3;border-radius:18px;max-width:440px;width:100%;padding:20px;box-shadow:0 18px 50px rgba(30,30,28,.3);max-height:88vh;overflow-y:auto">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;font-family:&quot;Songti SC&quot;,serif;font-size:18px;color:#20201D;margin-bottom:14px">定制路书' + (topicLabel ? ' · ' + topicLabel : '') + ' <button id="ix" style="border:0;background:var(--color-bg-soft);border-radius:8px;width:34px;height:34px;color:var(--color-muted);font-size:15px;cursor:pointer">✕</button></div>'
      + '<div style="font-size:13px;color:#7D7970;margin-bottom:8px">告诉我你想怎么走，基于真实景点生成每日行程：</div>'
      + '<input id="idays" type="number" min="1" max="15" value="3" style="width:100%;height:44px;border:1px solid rgba(32,32,29,.09);border-radius:12px;font-size:14px;padding:0 12px;background:#fff;color:#20201D;margin-bottom:8px" placeholder="游玩天数">'
      + '<input id="ipref" style="width:100%;height:44px;border:1px solid rgba(32,32,29,.09);border-radius:12px;font-size:14px;padding:0 12px;background:#fff;color:#20201D;margin-bottom:8px" placeholder="偏好，如：唐构+彩塑 / 石窟 / 轻松的">'
      + '<div id="iout" style="margin-top:8px;font-size:13px;color:#333;line-height:1.8;white-space:pre-wrap;display:none"></div>'
      + '<div style="font-size:11.5px;color:#9c958a;margin-top:8px">可用景点 ' + sites.length + ' 处。会为你挑选并给出衔接建议，生成后可参考现有「路线」页导航。</div>'
      + '<button id="igo" class="btn-primary" style="width:100%;margin-top:14px">生成路书</button>'
      + '</div>';
    document.body.appendChild(d);
    d.querySelector('#ix').onclick = function () { d.remove(); };
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    var go = d.querySelector('#igo'), out = d.querySelector('#iout');
    go.onclick = function () {
      var days = parseInt(d.querySelector('#idays').value, 10) || 3;
      var pref = d.querySelector('#ipref').value.trim() || '经典路线';
      go.disabled = true; go.textContent = '⏳ 正在规划…'; out.style.display = 'block'; out.textContent = '';
      /* 无 Key 本地兜底：贪心顺路排程，不让用户空手而归 */
      if (!(window.Ai && Ai.hasKey())) {
        go.disabled = false; go.textContent = '生成路书';
        out.textContent = localItinerary(sites, days);
        flash('已生成本地版路书（配置 AI Key 可获得更细建议）');
        return;
      }
      var pool = sites.slice(0, 80).map(function (s) {
        var tag = [s.ty || s.theme || '', s.dy || '', s.county || s.city || ''].filter(Boolean).join('·');
        return s.label + (tag ? '（' + tag + '）' : '');
      }).join('、');
      aiCall([
        { role: 'system', content: '你是旅行规划师。从提供的真实景点中为游客规划 ' + days + ' 日行程，考虑地理顺路与每日节奏。只输出 JSON，格式：[{"day":1,"title":"D1 标题","sites":["景点名"],"note":"衔接建议"}]. 景点名必须从列表里原样选取。' },
        { role: 'user', content: '偏好：' + pref + '。可选景点：' + pool }
      ], function (text, err) {
        go.disabled = false; go.textContent = '生成路书';
        if (err) { out.textContent = '生成失败：' + err; return; }
        var plan = [];
        try { plan = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch (e) { plan = []; }
        if (!plan.length) { out.textContent = text; return; }
        out.textContent = plan.map(function (day) {
          return '【第 ' + day.day + ' 天】' + (day.title || '') + '\n  ' + (day.sites || []).join(' → ') + (day.note ? '\n  提示：' + day.note : '');
        }).join('\n\n');
        flash('路书已生成');
      });
    };
  }

  /* ---------- 入口：成果面板 ---------- */
  function openResults() {
    /* TRACE v2：成果工坊已迁移至 review.html（原 workshop.html 页面已移除） */
    location.href = 'review.html';
  }

  window.Results = {
    open: openResults,
    album: buildAlbum,
    atlas: buildAtlas,
    itinerary: function (sitesIn, topicLabel) { buildItinerary(sitesIn, topicLabel); },
    story: buildStory
  };
})();
