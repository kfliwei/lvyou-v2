/* ============================================================
   行迹 TRACE · 旅行图册 Album（杂志式旅行书）
   ------------------------------------------------------------
   蓝图 v2.0 §4.5：一本真正属于自己的旅行书（非相册/PDF/AI排版）
   结构：封面 → Opening → Chapter(大图/双图/全宽/文字页)
         → 地图插页 → 声音页 → Closing → 记忆地图
   数据来源：游记对象（photos[] / audio / text / siteName /
            lat / lng / weather / tags / province / city）
   存储：独立 IndexedDB「trace-albums」，零侵入 travel-notes.js
   依赖：design.css（--color-* / --font-* / --radius-* 令牌）
   ============================================================ */
(function () {
  'use strict';

  var DB_NAME = 'trace-albums', DB_VER = 2;

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtD(ts) { var d = new Date(ts); return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()); }
  function fmtDM(ts) { var d = new Date(ts); return pad(d.getMonth() + 1) + '.' + pad(d.getDate()); }
  function fmtRange(a, b) {
    var da = new Date(a), db = new Date(b);
    if (da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()) return fmtD(a);
    return fmtD(a) + ' — ' + fmtD(b);
  }

  /* ---------- IndexedDB（Promise 封装） ---------- */
  function dbOpen() {
    return new Promise(function (res, rej) {
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VER); }
      catch (e) { rej(e); return; }
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('albums')) db.createObjectStore('albums', { keyPath: 'id' });
      };
      // 兜底：库已存在但 store 缺失（早期版本/异常残留）时，升级重建，避免永久不可用
      req.onsuccess = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('albums')) {
          var v = db.version;
          db.close();
          var r2 = indexedDB.open(DB_NAME, v + 1);
          r2.onupgradeneeded = function (e2) {
            var db2 = e2.target.result;
            if (!db2.objectStoreNames.contains('albums')) db2.createObjectStore('albums', { keyPath: 'id' });
          };
          r2.onsuccess = function (e2) { res(e2.target.result); };
          r2.onerror = function (e2) { rej(e2); };
          return;
        }
        res(db);
      };
      req.onerror = function (e) { rej(e); };
    });
  }
  function albumList() {
    return dbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('albums', 'readonly');
        var rq = tx.objectStore('albums').getAll();
        rq.onsuccess = function () { res(rq.result || []); db.close(); };
        rq.onerror = function (e) { rej(e); };
      });
    });
  }
  function albumGet(id) {
    return dbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('albums', 'readonly');
        var rq = tx.objectStore('albums').get(id);
        rq.onsuccess = function () { res(rq.result || null); db.close(); };
        rq.onerror = function (e) { rej(e); };
      });
    });
  }
  function albumSave(a) {
    return dbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('albums', 'readwrite');
        tx.objectStore('albums').put(a);
        tx.oncomplete = function () { res(a); db.close(); };
        tx.onerror = function (e) { rej(e); };
      });
    });
  }
  function albumRemove(id) {
    return dbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('albums', 'readwrite');
        tx.objectStore('albums').delete(id);
        tx.oncomplete = function () { res(true); db.close(); };
        tx.onerror = function (e) { rej(e); };
      });
    });
  }

  /* ---------- 游记分组：旅程（间隔 >3 天分割） → 天 ---------- */
  function groupTrips(notes) {
    var GAP = 3 * 24 * 3600 * 1000;
    var ordered = notes.slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    var trips = [];
    ordered.forEach(function (n) {
      var last = trips[trips.length - 1];
      if (last && (n.ts || 0) - last.end <= GAP) { last.notes.push(n); last.end = n.ts; }
      else trips.push({ start: n.ts, end: n.ts, notes: [n] });
    });
    return trips;
  }
  function groupByPlace(notes) {
    var map = {}, order = [];
    notes.forEach(function (n) {
      var k = (n.siteName || n.title || '未命名').trim();
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(n);
    });
    return order.map(function (k) { return map[k]; });
  }

  /* ---------- 自动生成图册：游记 → Album 对象 ---------- */
  function pickCover(notes) {
    for (var i = 0; i < notes.length; i++) {
      var ph = notes[i].photos || [];
      if (ph.length) return ph[0];
    }
    return '';
  }
  function chapterTitle(notes) {
    for (var i = 0; i < notes.length; i++) {
      var t = notes[i].title || notes[i].siteName;
      if (t) return t;
    }
    return '某一天';
  }
  function buildFromNotes(notes) {
    var ordered = notes.slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    var trips = groupTrips(ordered);
    // 每趟旅程内按地点聚合（同一地点多段记忆 → 一章），保持时间顺序
    var chapters = [];
    trips.forEach(function (trip) {
      groupByPlace(trip.notes).forEach(function (placeNotes) {
        chapters.push(chapterFromNotes(placeNotes));
      });
    });
    if (!chapters.length) chapters.push(emptyChapter());
    // 图册级地图插页：整本 ≥2 个坐标点时，末尾追加「我们的路线」
    var allPoints = [];
    ordered.forEach(function (n) {
      if (n.lat != null && n.lng != null) allPoints.push({ lat: n.lat, lng: n.lng, name: n.siteName || n.title || '·' });
    });
    if (allPoints.length >= 2) {
      chapters.push({ id: 'ch_route_' + Date.now(), title: '我们的路线', lead: '', layout: 'text', photos: [], caption: '', audio: '', audioLabel: '', mapPoints: allPoints });
    }
    var all = ordered;
    var first = all[0], last = all[all.length - 1];
    var stats = summarize(all);
    var year = first ? String(new Date(first.ts).getFullYear()) : String(new Date().getFullYear());
    // 标题：优先用覆盖最多的省 / 市，其次第一站地点
    var title = dominantPlace(all);
    return {
      id: 'album_' + Date.now(),
      title: title,
      subtitle: '',
      year: year,
      cover: pickCover(all),
      coverGradient: 'linear-gradient(160deg,#3E4A40 0%,#5C6B60 40%,#8A7A62 100%)',
      opening: {
        dates: first ? fmtRange(first.ts, last.ts) : '',
        words: '这一次，\n我们去了很远的地方。\n\n走过的路，\n都留在了心里。'
      },
      stats: stats,
      chapters: chapters,
      closing: '这段旅程，\n到这里了。\n\n但它已经成为\n你的一部分。',
      updatedAt: Date.now()
    };
  }
  function chapterFromNotes(notes) {
    var sorted = notes.slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    var photos = [];
    var audios = [];
    var texts = [];
    var points = [];
    sorted.forEach(function (n) {
      (n.photos || []).forEach(function (p) { photos.push(p); });
      if (n.audio) audios.push({ src: n.audio, label: n.title || n.siteName || '' });
      var t = (n.text || n.raw || '').trim();
      if (t) texts.push(t);
      if (n.lat != null && n.lng != null) points.push({ lat: n.lat, lng: n.lng, name: n.siteName || n.title || '·' });
    });
    // 文字合并：每段独立成段
    var lead = texts.join('\n\n');
    var layout = photos.length >= 2 ? 'duo' : (photos.length === 1 ? 'full' : 'text');
    var first = sorted[0], last = sorted[sorted.length - 1];
    var dayLabel = fmtRange(first.ts, last.ts);
    return {
      id: 'ch_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
      title: chapterTitle(sorted),
      lead: lead,
      layout: layout,
      photos: photos.slice(0, 4),       // 最多 4 张入章
      caption: dayLabel + (first && first.weather ? ' · ' + first.weather : ''),
      audio: audios.length ? audios[0].src : '',
      audioLabel: audios.length ? audios[0].label : '',
      mapPoints: points
    };
  }
  function emptyChapter() {
    return { id: 'ch_empty', title: '未命名章节', lead: '', layout: 'text', photos: [], caption: '', audio: '', audioLabel: '', mapPoints: [] };
  }
  function summarize(notes) {
    var withLoc = notes.filter(function (n) { return n.lat != null; });
    var days = {}, cities = {}, provs = {}, photos = 0, audio = 0;
    notes.forEach(function (n) {
      var d = (n.day || (n.date || '').slice(0, 10)); if (d) days[d] = 1;
      if (n.siteName) cities[n.siteName] = 1;
      if (n.province) provs[n.province] = 1;
      photos += (n.photos || []).length;
      if (n.audio) audio++;
    });
    var km = 0;
    for (var i = 1; i < withLoc.length; i++) {
      if (window.Geo && Geo.hav) km += Geo.hav(withLoc[i - 1].lat, withLoc[i - 1].lng, withLoc[i].lat, withLoc[i].lng);
    }
    return {
      days: Object.keys(days).length,
      sites: Object.keys(cities).length,
      photos: photos,
      memory: notes.length,
      audio: audio,
      km: Math.round(km)
    };
  }
  function dominantPlace(notes) {
    var c = {};
    notes.forEach(function (n) {
      var k = n.city || n.province || n.siteName;
      if (k) c[k] = (c[k] || 0) + 1;
    });
    var best = '', max = 0;
    Object.keys(c).forEach(function (k) { if (c[k] > max) { max = c[k]; best = k; } });
    return best || '我的旅行';
  }

  /* ---------- 地图插页 SVG（经纬度投影 + 陶土路线） ---------- */
  function renderMapPlateSVG(points) {
    if (!points || points.length < 2) return '';
    var W = 360, H = 220, PD = 34;
    var lats = points.map(function (p) { return p.lat; }), lngs = points.map(function (p) { return p.lng; });
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    var spanLng = (maxLng - minLng) || 1, spanLat = (maxLat - minLat) || 1;
    var X = function (lng) { return PD + (lng - minLng) / spanLng * (W - 2 * PD); };
    var Y = function (lat) { return PD + (maxLat - lat) / spanLat * (H - 2 * PD); };
    var pts = points.map(function (p) { return { x: X(p.lng), y: Y(p.lat), name: p.name }; });
    var pathD = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    var dots = pts.map(function (p, i) {
      return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4.5" fill="#20201D"/>';
    }).join('');
    // 地点名（仅标注首尾，避免拥挤）
    var label = function (p) {
      var dy = p.y < H - 30 ? 22 : -12;
      return '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + dy).toFixed(1) + '" font-size="11" fill="#4C4A45" font-family="Songti SC, serif" text-anchor="middle">' + esc(String(p.name).slice(0, 6)) + '</text>';
    };
    var labels = label(pts[0]) + label(pts[pts.length - 1]);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">'
      + '<rect width="' + W + '" height="' + H + '" fill="none"/>'
      + '<path d="M0 60 Q 70 40 120 70 T 240 55 T 360 70" stroke="#F7F4ED" stroke-width="8" fill="none" stroke-linecap="round" opacity=".5"/>'
      + '<path d="M0 150 Q 80 130 160 155 T 360 140" stroke="#F7F4ED" stroke-width="8" fill="none" stroke-linecap="round" opacity=".5"/>'
      + '<path d="M60 0 Q 80 110 70 220" stroke="#D8D4CB" stroke-width="3" fill="none" opacity=".7"/>'
      + '<path d="M250 0 Q 270 100 260 220" stroke="#D8D4CB" stroke-width="3" fill="none" opacity=".7"/>'
      + '<circle cx="120" cy="70" r="24" fill="#DCE6E6" opacity=".8"/>'
      + '<path d="' + pathD + '" stroke="#C86D4B" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>'
      + dots + labels
      + '</svg>';
  }

  /* ---------- 排版引擎：Album → 阅读页 HTML（片段） ---------- */
  function renderAlbumHTML(album) {
    if (!album) return '<div class="al-empty">还没有图册</div>';
    var h = [];
    // 封面
    var coverBg = album.cover
      ? 'background-image:url(' + album.cover + ');background-size:cover;background-position:center;'
      : 'background:' + album.coverGradient + ';';
    h.push('<section class="al-cover">'
      + '<div class="al-cover__img" style="' + coverBg + '"></div>'
      + '<div class="al-cover__shade"></div>'
      + '<div class="al-cover__content">'
      + '<div class="al-cover__tag">Travel Album</div>'
      + '<h1 class="al-cover__title">' + esc(album.title) + '</h1>'
      + '<div class="al-cover__sub">' + esc(album.subtitle || '') + '</div>'
      + '<div class="al-cover__year">' + esc(album.year || '') + '</div>'
      + '</div>'
      + '<div class="al-cover__scroll">向下翻阅 ↓</div>'
      + '</section>');

    // Opening
    var st = album.stats || {};
    h.push('<section class="al-page al-opening">'
      + '<h2 class="al-opening__title">' + esc(album.title) + '</h2>'
      + (album.opening && album.opening.dates ? '<div class="al-opening__dates">' + esc(album.opening.dates) + '</div>' : '')
      + '<div class="al-opening__stats">'
      + '<div class="al-os"><b>' + (st.days || 0) + '</b><span>天</span></div>'
      + '<div class="al-os"><b>' + (st.sites || 0) + '</b><span>个地点</span></div>'
      + '<div class="al-os"><b>' + (st.photos || 0) + '</b><span>张照片</span></div>'
      + '<div class="al-os"><b>' + (st.memory || 0) + '</b><span>段记忆</span></div>'
      + '</div>'
      + (album.opening && album.opening.words ? '<p class="al-opening__words">' + esc(album.opening.words).replace(/\n/g, '<br>') + '</p>' : '')
      + '</section>');

    // Chapters
    (album.chapters || []).forEach(function (ch, i) {
      h.push(renderChapterHTML(ch, i));
    });

    // Closing
    h.push('<section class="al-closing">'
      + '<p class="al-closing__t">' + esc(album.closing || '').replace(/\n/g, '<br>') + '</p>'
      + '<div class="al-closing__mark">' + esc(album.title) + '<br>' + esc(album.year || '') + '</div>'
      + '<a class="al-closing__link" href="travel-map.html">查看我的记忆地图 <span>→</span></a>'
      + '</section>');
    return h.join('');
  }

  function renderChapterHTML(ch, idx) {
    var num = 'Chapter ' + pad(idx + 1);
    var h = ['<section class="al-page al-chapter" data-ch="' + esc(ch.id) + '">'
      + '<div class="al-ch-num">' + num + '</div>'
      + '<h3 class="al-ch-title">' + esc(ch.title || '') + '</h3>'];

    // 图块（按布局）
    if (ch.photos && ch.photos.length) {
      if (ch.layout === 'duo' && ch.photos.length >= 2) {
        h.push('<div class="al-duo">'
          + '<img class="al-ch-img" src="' + ch.photos[0] + '" alt="" onerror="this.remove()">'
          + '<img class="al-ch-img" src="' + ch.photos[1] + '" alt="" onerror="this.remove()">'
          + '</div>');
      } else {
        var cls = ch.layout === 'wide' ? 'al-ch-img al-ch-img--wide' : (ch.layout === 'tall' ? 'al-ch-img al-ch-img--tall' : 'al-ch-img');
        h.push('<img class="' + cls + '" src="' + ch.photos[0] + '" alt="" onerror="this.remove()">');
        // 多余的图，纵向补排
        for (var k = 1; k < ch.photos.length; k++) {
          h.push('<img class="al-ch-img" src="' + ch.photos[k] + '" alt="" onerror="this.remove()" style="margin-top:14px">');
        }
      }
      if (ch.caption) h.push('<div class="al-ch-caption">' + esc(ch.caption) + '</div>');
    }

    // 文字
    if (ch.lead) {
      h.push('<p class="al-ch-lead">' + esc(ch.lead).replace(/\n/g, '<br>') + '</p>');
    }

    // 地图插页
    if (ch.mapPoints && ch.mapPoints.length >= 2) {
      h.push('<div class="al-map-plate">'
        + '<div class="al-mp-title">Route</div>'
        + renderMapPlateSVG(ch.mapPoints)
        + '</div>');
    }

    // 声音块
    if (ch.audio) {
      h.push('<div class="al-audio" data-audio="' + esc(ch.audio) + '">'
        + '<button class="al-audio__btn" type="button" aria-label="播放这一刻">'
        + '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5 L19 12 L7 19 Z"/></svg>'
        + '</button>'
        + '<div class="al-audio__meta"><span class="al-audio__label">听这一刻</span>'
        + (ch.audioLabel ? '<span class="al-audio__place">' + esc(ch.audioLabel) + '</span>' : '')
        + '</div>'
        + '<span class="al-audio__time">00:00</span>'
        + '</div>');
    }

    h.push('</section>');
    return h.join('');
  }

  /* ---------- 导出独立 HTML（内联 base64；file:// 音频注明 App 内回听） ---------- */
  function exportHTML(album) {
    var body = renderAlbumHTML(album);
    var audioNote = '';
    var hasFileAudio = false;
    (album.chapters || []).forEach(function (ch) { if (ch.audio && ch.audio.indexOf('file:') === 0) hasFileAudio = true; });
    if (hasFileAudio) audioNote = '<div class="al-export-note">部分原声为本地录音，导出文件在 App 外无法播放；请在「行迹」内回听完整原声。</div>';
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">'
      + '<title>' + esc(album.title) + ' · 旅行图册</title>'
      + '<style>'
      + ':root{--color-bg:#F7F5EF;--color-bg-soft:#F0EDE5;--color-ink:#20201D;--color-ink-soft:#4C4A45;--color-muted:#7D7970;--color-faint:#AAA59B;--color-line:rgba(32,32,29,.09);--color-primary:#C86D4B;--color-primary-dark:#A9563B;--font-serif:"Songti SC","STSong","Noto Serif SC",serif;--font-sans:"PingFang SC","Noto Sans SC",sans-serif}'
      + '*{box-sizing:border-box;margin:0;padding:0}'
      + 'body{background:var(--color-bg);color:var(--color-ink);font-family:var(--font-sans);line-height:1.75}'
      + '.al{max-width:720px;margin:0 auto;min-height:100vh}'
      + '.al-cover{position:relative;min-height:100vh;display:flex;flex-direction:column;justify-content:flex-end;padding:64px 30px 56px;overflow:hidden}'
      + '.al-cover__img{position:absolute;inset:0}'
      + '.al-cover__shade{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.55),rgba(0,0,0,.05) 55%)}'
      + '.al-cover__content{position:relative;z-index:2;color:#F4F1E7}'
      + '.al-cover__tag{font-size:11px;letter-spacing:.34em;opacity:.8}'
      + '.al-cover__title{font-family:var(--font-serif);font-size:clamp(46px,13vw,64px);font-weight:400;line-height:1.1;letter-spacing:.04em;margin-top:18px}'
      + '.al-cover__sub{margin-top:14px;font-family:var(--font-serif);font-size:19px;opacity:.92}'
      + '.al-cover__year{margin-top:22px;font-size:12px;letter-spacing:.3em;opacity:.75}'
      + '.al-page{padding:100px 30px 90px}'
      + '.al-opening__title{font-family:var(--font-serif);font-size:44px;font-weight:400;line-height:1.15}'
      + '.al-opening__dates{margin-top:18px;font-size:13px;color:var(--color-muted);letter-spacing:.12em}'
      + '.al-opening__stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:44px}'
      + '.al-os b{display:block;font-family:var(--font-serif);font-size:26px;font-weight:400}'
      + '.al-os span{font-size:11px;color:var(--color-muted);display:block;margin-top:4px}'
      + '.al-opening__words{margin-top:64px;font-family:var(--font-serif);font-size:20px;line-height:2;color:var(--color-ink-soft)}'
      + '.al-ch-num{font-size:11px;color:var(--color-muted);letter-spacing:.26em}'
      + '.al-ch-title{font-family:var(--font-serif);font-size:clamp(38px,10vw,48px);font-weight:400;line-height:1.15;margin-top:16px}'
      + '.al-ch-img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;margin-top:44px;display:block}'
      + '.al-ch-img--wide{aspect-ratio:16/10}.al-ch-img--tall{aspect-ratio:3/4}'
      + '.al-ch-caption{margin-top:10px;font-size:11px;color:var(--color-muted);letter-spacing:.1em;text-align:right}'
      + '.al-duo{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:44px}'
      + '.al-duo .al-ch-img{margin-top:0;aspect-ratio:3/4}'
      + '.al-ch-lead{margin-top:24px;font-family:var(--font-serif);font-size:17px;line-height:2.05;color:var(--color-ink-soft)}'
      + '.al-map-plate{margin:64px 0 0;border-radius:18px;background:#E8E5DC;padding:34px 24px 28px;position:relative;overflow:hidden}'
      + '.al-map-plate svg{width:100%;height:auto;display:block}'
      + '.al-mp-title{font-size:11px;letter-spacing:.24em;color:var(--color-muted);text-align:center}'
      + '.al-audio{margin-top:44px;display:flex;align-items:center;gap:16px;padding:18px 20px;background:var(--color-bg-soft);border-radius:16px}'
      + '.al-audio__btn{width:56px;height:56px;border-radius:50%;background:var(--color-primary);color:#fff;display:grid;place-items:center;cursor:pointer;flex:0 0 auto;border:0;box-shadow:0 8px 20px rgba(200,109,75,.3)}'
      + '.al-audio__meta{flex:1;min-width:0}'
      + '.al-audio__label{display:block;font-family:var(--font-serif);font-size:16px}'
      + '.al-audio__place{display:block;font-size:11px;color:var(--color-muted);margin-top:3px}'
      + '.al-audio__time{font-size:12px;color:var(--color-muted);font-variant-numeric:tabular-nums}'
      + '.al-closing{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:60px 34px}'
      + '.al-closing__t{font-family:var(--font-serif);font-size:30px;font-weight:400;line-height:2;color:var(--color-ink-soft)}'
      + '.al-closing__mark{margin-top:44px;font-family:var(--font-serif);font-size:34px;letter-spacing:.1em}'
      + '.al-closing__link{margin-top:52px;display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:500;color:var(--color-primary-dark);cursor:pointer;padding:6px 0;border-bottom:1.5px solid var(--color-primary-dark)}'
      + '.al-export-note{margin:20px;padding:14px 16px;background:rgba(200,109,75,.08);border-radius:12px;font-size:12.5px;color:var(--color-primary-dark)}'
      + '</style></head><body><div class="al">' + audioNote + body + '</div>'
      + '<script>'
      + 'document.querySelectorAll(".al-audio").forEach(function(a){var btn=a.querySelector(".al-audio__btn"),t=a.querySelector(".al-audio__time"),au=new Audio(a.dataset.audio);'
      + 'function fmt(s){if(!isFinite(s))return"00:00";s=Math.floor(s);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}'
      + 'au.addEventListener("loadedmetadata",function(){t.textContent=fmt(au.duration);});'
      + 'btn.onclick=function(){if(au.paused){au.play();btn.innerHTML=\'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5 H10 V19 H6 Z M14 5 H18 V19 H14 Z"/></svg>\';}else{au.pause();btn.innerHTML=\'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5 L19 12 L7 19 Z"/></svg>\';}};'
      + 'au.addEventListener("ended",function(){btn.innerHTML=\'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5 L19 12 L7 19 Z"/></svg>\';});'
      + '});'
      + '<\/script></body></html>';
  }

  /* ---------- 暴露 ---------- */
  window.Album = {
    list: albumList,
    get: albumGet,
    save: albumSave,
    remove: albumRemove,
    buildFromNotes: buildFromNotes,
    groupTrips: groupTrips,
    render: renderAlbumHTML,
    renderChapter: renderChapterHTML,
    exportHTML: exportHTML,
    esc: esc
  };
})();
