/* =========================================================
 * poster.js — 足迹地图海报 v1
 * 在 shareCanvas（文字长图）基础上补「地图版」：Canvas 绘制
 *   足迹连线（按时间序）+ 频次点 + 统计数字 + 省份徽章 + 印章
 * 竖版 1080x1620（2:3，适合分享/朋友圈）
 * 用法：window.FootprintPoster.generate()
 * 被 review.html 引用（「生成足迹海报」按钮）
 * ========================================================= */
window.FootprintPoster = (function () {
  var PROV_SHORT = {
    '北京': '京', '天津': '津', '河北': '冀', '山西': '晋', '内蒙古': '蒙',
    '辽宁': '辽', '吉林': '吉', '黑龙江': '黑', '上海': '沪', '江苏': '苏',
    '浙江': '浙', '安徽': '皖', '福建': '闽', '江西': '赣', '山东': '鲁',
    '河南': '豫', '湖北': '鄂', '湖南': '湘', '广东': '粤', '广西': '桂',
    '海南': '琼', '重庆': '渝', '四川': '川', '贵州': '黔', '云南': '滇',
    '西藏': '藏', '陕西': '陕', '甘肃': '甘', '青海': '青', '宁夏': '宁',
    '新疆': '新', '台湾': '台', '香港': '港', '澳门': '澳'
  };
  function shortProv(p) {
    if (!p) return '';
    var s = String(p).replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, '');
    return PROV_SHORT[s] || s.charAt(0) || '';
  }
  function hav(lat1, lng1, lat2, lng2) {
    var R = 6371, r = Math.PI / 180;
    var dLa = (lat2 - lat1) * r, dLo = (lng2 - lng1) * r;
    var a = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function esc2(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function flash(msg) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px)+14px);left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:11px 20px;border-radius:999px;font-size:13px;z-index:9600;box-shadow:0 6px 24px rgba(0,0,0,.3);white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis';
    d.textContent = msg; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2600);
  }
  function savePng(title, dataUrl) {
    if (window.AndroidVoice && window.AndroidVoice.saveImage) {
      window.__tnImgSaved = function (r) { flash(r === 'err' ? '保存失败' : '海报已保存：Download/' + r); };
      try { AndroidVoice.saveImage(title + '.png', dataUrl); } catch (e) { flash('保存不可用'); }
    } else {
      var a = document.createElement('a');
      a.href = dataUrl; a.download = title + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      flash('足迹海报已生成');
    }
  }
  /* 全屏预览弹层：生成后先预览，点「保存」才保存（避免点击无反馈） */
  function previewPoster(title, dataUrl) {
    var old = document.getElementById('posterPreview');
    if (old) old.remove();
    var mask = document.createElement('div');
    mask.id = 'posterPreview';
    mask.style.cssText = 'position:fixed;inset:0;z-index:9900;background:rgba(20,19,15,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px';
    var img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'max-width:100%;max-height:66vh;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.5)';
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:12px;margin-top:18px';
    var save = document.createElement('button');
    save.textContent = '保存到手机';
    save.style.cssText = 'min-height:46px;padding:0 26px;border:0;border-radius:999px;background:#C86D4B;color:#fff;font-size:14px;cursor:pointer';
    var close = document.createElement('button');
    close.textContent = '关闭';
    close.style.cssText = 'min-height:46px;padding:0 26px;border:1px solid rgba(255,255,255,.4);border-radius:999px;background:transparent;color:#fff;font-size:14px;cursor:pointer';
    save.onclick = function () { try { savePng(title, dataUrl); } catch (e) { flash('保存失败，请重试'); } };
    close.onclick = function () { mask.remove(); };
    bar.appendChild(save); bar.appendChild(close);
    mask.appendChild(img); mask.appendChild(bar);
    document.body.appendChild(mask);
  }
  var THEMES = {
    ink: { bg: ['#2E3B42', '#20201D', '#14130F'], deco: 'rgba(200,109,75,.07)', title: '#FAF8F3', sub: '#C8C0B2', grid: 'rgba(250,248,243,.05)', track: 'rgba(200,109,75,.85)', dotFill: 'rgba(250,248,243,.95)', dotStroke: '#C86D4B', statBg: 'rgba(250,248,243,.06)', statV: '#FAF8F3', statK: '#C8C0B2', badgeBg: 'rgba(200,109,75,.16)', badgeT: '#E8B49A', foot: '#8F8A80' },
    carto: { bg: ['#F7F2E7', '#EFE7D4', '#E7DCC4'], deco: 'rgba(169,86,59,.08)', title: '#26241F', sub: '#8C7B66', grid: 'rgba(169,86,59,.12)', track: 'rgba(169,86,59,.9)', dotFill: '#FFFDF8', dotStroke: '#A9563B', statBg: 'rgba(169,86,59,.07)', statV: '#26241F', statK: '#8C7B66', badgeBg: 'rgba(169,86,59,.12)', badgeT: '#A9563B', foot: '#8C7B66' }
  };
  function generate(landscape, themeName) {
    var th = THEMES[themeName] || THEMES.ink;
    var all = (window.TravelNotes ? TravelNotes.list() : []).slice()
      .sort(function (a, b) { return a.ts - b.ts; });
    var pts = all.filter(function (n) { return n.lat != null && n.lng != null; });
    if (!pts.length) { flash('还没有带位置的游记，先去记录一段旅程吧'); return; }

    /* ---- 统计 ---- */
    var days = new Set(all.map(function (n) { return String(n.date || '').slice(0, 10); }).filter(Boolean));
    var provs = {};
    all.forEach(function (n) { if (n.province) provs[n.province] = 1; });
    var tripCnt = 1;
    for (var i = 1; i < pts.length; i++) {
      if (pts[i].ts - pts[i - 1].ts > 3 * 24 * 3600 * 1000) tripCnt++;
    }
    var km = 0;
    for (var j = 1; j < pts.length; j++) km += hav(pts[j - 1].lat, pts[j - 1].lng, pts[j].lat, pts[j].lng);
    var year = new Date().getFullYear();

    /* ---- 画布 ---- */
    var W = landscape ? 1920 : 1080, H = landscape ? 1080 : 1620;
    /* 布局参数（竖版 2:3 / 横版 16:9） */
    var TY = landscape ? 96 : 130, TY2 = landscape ? 148 : 186;   /* 标题/副标题 y */
    var MX = landscape ? 90 : 110, MY = landscape ? 225 : 250;    /* 地图区起点 */
    var MW = W - (landscape ? 180 : 220), MH = H - (landscape ? 480 : 900);  /* 地图区宽高 */
    var statY = landscape ? H - 165 : H - 400, boxW = (W - (landscape ? 220 : 240)) / 4;
    var sealX = W - (landscape ? 120 : 150), sealY = landscape ? H - 300 : H - 290;
    var footY = landscape ? H - 88 : H - 120;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');

    /* 背景：深墨渐变 */
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(.55, th.bg[1]); g.addColorStop(1, th.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* 装饰圆 */
    ctx.fillStyle = th.deco;
    [[140, 380, 110], [900, 980, 150], [520, 1420, 120]].forEach(function (c) {
      ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.fill();
    });

    /* 制图风等高线纹理（carto 主题） */
    if (themeName === 'carto') {
      ctx.strokeStyle = 'rgba(169,86,59,.10)'; ctx.lineWidth = 1.2;
      [[260,500,120],[520,620,90],[700,400,140],[340,900,180],[820,1080,110]].forEach(function (c) {
        ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(c[0], c[1], c[2] + 26, 0, Math.PI * 2); ctx.stroke();
      });
    }

    /* 制图风等高线纹理（carto 主题） */
    if (themeName === 'carto') {
      ctx.strokeStyle = 'rgba(169,86,59,.10)'; ctx.lineWidth = 1.2;
      [[260,500,120],[520,620,90],[700,400,140],[340,900,180],[820,1080,110]].forEach(function (c) {
        ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(c[0], c[1], c[2] + 26, 0, Math.PI * 2); ctx.stroke();
      });
    }

    /* 标题 */
    ctx.textAlign = 'center';
    ctx.fillStyle = th.title;
    ctx.font = '600 64px "Songti SC","Noto Serif SC",serif';
    ctx.fillText('我的旅行足迹', W / 2, TY);
    ctx.font = '26px "Noto Serif SC",serif';
    ctx.globalAlpha = .7; ctx.fillStyle = th.sub;
    ctx.fillText(year + ' · 行迹 TRACE', W / 2, TY2);
    ctx.globalAlpha = 1;

    /* ---- 足迹地图区（投影：中国范围 lng 73-135, lat 18-54） ---- */
    /* 地图区：MX/MY/MW/MH 见布局参数 */
    function px(lng) { return MX + (lng - 73) / (135 - 73) * MW; }
    function py(lat) { return MY + (54 - lat) / (54 - 18) * MH; }

    /* 网格参考线（极淡） */
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
    for (var gl = 80; gl <= 130; gl += 10) {
      ctx.beginPath(); ctx.moveTo(px(gl), MY); ctx.lineTo(px(gl), MY + MH); ctx.stroke();
    }
    for (var gt = 20; gt <= 50; gt += 10) {
      ctx.beginPath(); ctx.moveTo(MX, py(gt)); ctx.lineTo(MX + MW, py(gt)); ctx.stroke();
    }

    /* 足迹连线（时间序） */
    ctx.beginPath();
    pts.forEach(function (n, k) {
      var X = px(n.lng), Y = py(n.lat);
      if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.strokeStyle = th.track;
    ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();

    /* 频次点（同坐标合并，点越大去得越多） */
    var freq = {};
    pts.forEach(function (n) {
      var k = n.lat.toFixed(2) + ',' + n.lng.toFixed(2);
      freq[k] = (freq[k] || 0) + 1;
    });
    Object.keys(freq).forEach(function (k) {
      var c = k.split(',');
      var r = 5 + Math.min(14, freq[k] * 3);
      ctx.beginPath();
      ctx.arc(px(+c[1]), py(+c[0]), r, 0, Math.PI * 2);
      ctx.fillStyle = th.dotFill;
      ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = th.dotStroke;
      ctx.stroke();
    });

    /* ---- 统计四格 ---- */
    /* statY/boxW 见布局参数 */
    var stats = [
      { v: tripCnt, k: '段旅程' },
      { v: days.size, k: '天在路上' },
      { v: Object.keys(provs).length, k: '个省份' },
      { v: km >= 100 ? Math.round(km) : Math.round(km * 10) / 10, k: km >= 100 ? 'km 足迹' : 'km 足迹' }
    ];
    ctx.textAlign = 'center';
    stats.forEach(function (s, i) {
      var x = 120 + i * boxW + boxW / 2;
      ctx.fillStyle = th.statBg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - boxW / 2 + 6, statY - 14, boxW - 12, 118, 18);
      else ctx.rect(x - boxW / 2 + 6, statY - 14, boxW - 12, 118);
      ctx.fill();
      ctx.fillStyle = th.statV;
      ctx.font = '600 44px "Songti SC",serif';
      ctx.fillText(String(s.v), x, statY + 42);
      ctx.font = '20px "Noto Serif SC",serif';
      ctx.globalAlpha = .65; ctx.fillStyle = th.statK;
      ctx.fillText(s.k, x, statY + 82);
      ctx.globalAlpha = 1;
    });

    /* ---- 省份徽章 ---- */
    var shorts = Object.keys(provs).map(shortProv).filter(Boolean);
    var bx = landscape ? (W - Math.min(shorts.length, 12) * 46 - 60) : (W / 2 - (Math.min(shorts.length, 12) * 46 - 12) / 2);
    var by = landscape ? 236 : (H - 250);
    ctx.font = '22px "Noto Serif SC",serif';
    shorts.slice(0, 12).forEach(function (s) {
      ctx.fillStyle = th.badgeBg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, 40, 40, 10);
      else ctx.rect(bx, by, 40, 40);
      ctx.fill();
      ctx.fillStyle = th.badgeT;
      ctx.fillText(s, bx + 20, by + 27);
      bx += 46;
    });

    /* ---- 落款 + 印章 ---- */
    ctx.globalAlpha = .5; ctx.fillStyle = th.foot;
    ctx.font = '22px "Noto Serif SC",serif';
    ctx.fillText('行迹 TRACE · 走过的路都算数', W / 2, footY);
    ctx.globalAlpha = 1;

    /* 印章 */
    ctx.save();
    ctx.translate(sealX, sealY); ctx.rotate(-0.08);
    ctx.strokeStyle = '#C86D4B'; ctx.lineWidth = 3;
    ctx.strokeRect(-34, -34, 68, 68);
    ctx.fillStyle = '#C86D4B';
    ctx.font = '600 40px "Songti SC",serif';
    ctx.fillText('迹', 0, 13);
    ctx.restore();

    var dataUrl = cv.toDataURL('image/png');
    var styleName = { carto: '制图', paper: '纸感' }[themeName] || '';
    var title = (landscape ? '足迹海报横版 ' : '足迹海报' + (styleName ? '·' + styleName + ' ' : ' ')) + year;
    previewPoster(title, dataUrl);
  }
  return { generate: generate };
})();
