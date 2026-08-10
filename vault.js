/* ============================================================
   TRACE v2 · Obsidian 库导出模块
   - Vault.mdFor(note)        单篇 Markdown（YAML frontmatter + 正文 + 附件引用）
   - Vault.buildVault(notes)  {files: {path: string|Blob}} 完整库结构
   - Vault.exportOne(note)    单篇导出（Android saveTextFile / 浏览器下载）
   - Vault.exportVault(notes) 整库导出（Chrome 写目录 → zip 下载 → Android 逐篇）
   结构：
     TRACE-Vault/
       README.md               使用说明
       00-索引.md              时间线 / 地点 / 标签 三索引（Obsidian MOC）
       journeys/YYYY-MM/标题.md
       attachments/            照片、原声
   ============================================================ */
(function () {
  function escYaml(s) { return '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  function fn(s, len) {
    var t = String(s == null ? '' : s).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    return (len && t.length > len) ? t.slice(0, len) : t;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* 附件名：从路径/base64 提取可读名，统一 ASCII 安全名 */
  function fileExt(name) { var m = /\.([a-zA-Z0-9]+)$/.exec(name || ''); return m ? m[1].toLowerCase() : 'jpg'; }

  /* ---------- 单篇 Markdown ---------- */
  function mdFor(note) {
    var n = note || {};
    var fm = [
      '---',
      'title: ' + escYaml(n.title || n.siteName || '未命名'),
      'date: ' + escYaml(n.date || ''),
      (n.siteName ? 'place: ' + escYaml(n.siteName) : null),
      (n.lat != null ? 'lat: ' + n.lat : null),
      (n.lng != null ? 'lng: ' + n.lng : null),
      (n.province ? 'province: ' + escYaml(n.province) : null),
      (n.city ? 'city: ' + escYaml(n.city) : null),
      (n.county ? 'county: ' + escYaml(n.county) : null),
      (n.weather ? 'weather: ' + escYaml(n.weather) : null),
      (n.style ? 'style: ' + escYaml(n.style) : null),
      ((n.tags && n.tags.length) ? 'tags:\n' + n.tags.map(function (t) { return '  - ' + fn(t, 20); }).join('\n') : null),
      '---',
      ''
    ].filter(Boolean).join('\n');
    var body = (n.text || n.raw || '').trim();
    var parts = [fm];
    parts.push(body || '*（这篇游记没有文字内容）*');
    if (n.audio) parts.push('\n## 原声\n\n![原声](audio-' + n.id + '.m4a)');
    if (n.photos && n.photos.length) {
      parts.push('\n## 照片\n');
      n.photos.forEach(function (p, i) {
        var name = attachName('photo', n.id, i, p);
        parts.push('![' + '照片 ' + (i + 1) + '](' + name + ')');
      });
    }
    return parts.join('\n') + '\n';
  }
  /* 附件在 vault 内的文件名（attachments/ 下），并给出正文引用方式 */
  function attachName(kind, id, idx, raw) {
    if (!raw) return null;
    if (/^(https?:|file:)/.test(raw)) return null;                    // 远程/本地路径：不复制，正文直接引用原地址
    if (/^data:/.test(raw)) return kind + '-' + id + (idx != null ? '-' + (idx + 1) : '') + '.' + fileExt(/^data:[^;]+;/.test(raw) ? raw.slice(0, 40) : 'jpg');
    if (/^blob:/.test(raw)) return null;
    if (/^[a-zA-Z0-9_\-/.\u4e00-\u9fa5 ]+$/.test(raw)) return raw.split('/').pop();  // 相对路径 → 取文件名
    return null;
  }
  /* 解码 base64 / data URI → Blob */
  function toBlob(raw) {
    try {
      if (/^data:/.test(raw)) {
        var m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(raw);
        if (!m) return null;
        var mime = m[1] || 'image/jpeg';
        var bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
        var u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return new Blob([u8], { type: mime });
      }
      return null; // 相对/远程路径由 fetch 处理，不在此解码
    } catch (e) { return null; }
  }
  function b64ToBlob(b64, mime) {
    try {
      var bin = atob(b64);
      var u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Blob([u8], { type: mime || 'audio/mp4' });
    } catch (e) { return null; }
  }

  /* ---------- 整库构建 ---------- */
  function buildVault(notesIn) {
    var files = {};   // path -> string | Blob
    var sorted = notesIn.slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    var notesByPath = {};
    sorted.forEach(function (n) {
      var day = (n.day || (n.date ? n.date.slice(0, 10) : '未知')).replace(/-/g, '');
      var ym = day.slice(0, 6);
      var fname = (n.date ? n.date.slice(0, 10) : '') + ' ' + (fn(n.title || n.siteName || '未命名', 40) || '未命名') + '.md';
      var path = 'journeys/' + ym + '/' + fname;
      // 防重名
      var k = 2, base = path;
      while (files[path]) { path = base.replace(/\.md$/, ' ' + (k++) + '.md'); }
      notesByPath[n.id] = { path: path, note: n, day: day, ym: ym };
      files[path] = mdFor(n);
      /* 附件 */
      if (n.photos && n.photos.length) {
        n.photos.forEach(function (p, i) {
          if (!p) return;
          var nm = attachName('photo', n.id, i, p);
          if (!nm) return;
          var blob = toBlob(p);
          if (blob) files['attachments/' + nm] = blob;
          else if (/^(https?:|\/)/.test(p)) { /* 远程：引用原地址，不下载 */ }
          else if (/^[a-zA-Z0-9_\-/.\u4e00-\u9fa5 ]+$/.test(p)) { /* 相对路径：尝试 fetch 复制 */ }
        });
      }
      if (n.audio && /^data:/.test(n.audio)) {
        var nm = 'audio-' + n.id + '.m4a';
        var b = toBlob(n.audio);
        if (b) files['attachments/' + nm] = b;
      } else if (n.audio && !/^data:/.test(n.audio) && !/^(https?:|file:|blob:)/.test(n.audio)) {
        var nm2 = 'audio-' + n.id + '.m4a';
        var b2 = b64ToBlob(n.audio, 'audio/mp4');
        if (b2) files['attachments/' + nm2] = b2;
      }
    });
    /* 索引（MOC） */
    var lines = ['# 我的旅行 · 索引', '', '> 由 行迹 TRACE 导出 · ' + new Date().toLocaleDateString(), ''];
    lines.push('## 全部游记（' + sorted.length + ' 篇）', '');
    sorted.forEach(function (n) {
      var info = notesByPath[n.id];
      if (!info) return;
      lines.push('- ' + (n.date || '') + ' · [[' + info.path.replace(/^journeys\/\d{6}\//, '').replace(/\.md$/, '') + ']] ' + (n.siteName ? '— ' + n.siteName : ''));
    });
    lines.push('', '## 地点');
    var locs = {};
    sorted.forEach(function (n) { var k = n.province || ''; (locs[k] = locs[k] || []).push(n); });
    Object.keys(locs).sort().forEach(function (p) {
      lines.push('', '### ' + (p || '未知省份'));
      locs[p].forEach(function (n) {
        var info = notesByPath[n.id];
        if (!info) return;
        lines.push('- [[' + info.path.replace(/^journeys\/\d{6}\//, '').replace(/\.md$/, '') + ']]' + (n.city ? '（' + n.city + '）' : ''));
      });
    });
    lines.push('', '## 标签');
    var tags = {};
    sorted.forEach(function (n) { (n.tags || []).forEach(function (t) { (tags[t] = tags[t] || []).push(n); }); });
    Object.keys(tags).sort().forEach(function (t) {
      lines.push('- #' + t + '（' + tags[t].length + '）');
    });
    files['00-索引.md'] = lines.join('\n') + '\n';
    /* README */
    files['README.md'] = [
      '# 行迹 TRACE · Obsidian 库',
      '',
      '> 由「行迹」旅行记录 App 导出的 Markdown 库，可直接用 [Obsidian](https://obsidian.md) 打开此文件夹。',
      '',
      '## 结构',
      '',
      '```',
      'TRACE-Vault/',
      '  README.md          本文件',
      '  00-索引.md         时间线 / 地点 / 标签 索引（MOC）',
      '  journeys/          按 年-月 分组的游记',
      '  attachments/       照片与原声',
      '```',
      '',
      '## 使用',
      '',
      '1. Obsidian → 「打开文件夹作为库」→ 选择本文件夹；',
      '2. 打开 `00-索引.md` 浏览全部游记；',
      '3. 每篇游记头部是 YAML 属性（日期 / 坐标 / 地点 / 标签 / 天气），可在 Obsidian 属性面板查看与筛选；',
      '4. 游记内 `![[文件名]]` 会直接嵌入照片与原声。',
      '',
      '> 标签、坐标等元数据均为机器可读，可配合 Dataview 等插件使用。',
      ''
    ].join('\n');
    return { files: files, count: sorted.length };
  }

  /* ---------- 保存路径 ---------- */
  function saveFileAndroid(name, content) {
    return new Promise(function (resolve) {
      if (!(window.AndroidVoice && AndroidVoice.saveTextFile)) { resolve(false); return; }
      window.__tnSaveDone = function (r) {
        if (r === 'err' || r === 'need_perm') resolve(false);
        else resolve(true);
      };
      try { AndroidVoice.saveTextFile(name, content); } catch (e) { resolve(false); }
    });
  }
  function download(name, content, mime) {
    var a = document.createElement('a');
    a.href = (content instanceof Blob) ? URL.createObjectURL(content) : 'data:' + (mime || 'text/markdown') + ';charset=utf-8,' + encodeURIComponent(content);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function flash(msg) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px)+14px);left:50%;transform:translateX(-50%);background:rgba(32,32,29,.92);color:#fff;padding:12px 22px;border-radius:999px;font-size:13px;z-index:9800;box-shadow:0 8px 24px rgba(30,30,28,.18);white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2400);
  }

  /* ---------- File System Access（Chrome 桌面：写入真实目录） ---------- */
  async function writeToDir(root, files) {
    var paths = Object.keys(files);
    for (var i = 0; i < paths.length; i++) {
      var path = paths[i];
      var seg = path.split('/');
      var dir = root;
      for (var j = 0; j < seg.length - 1; j++) {
        dir = await dir.getDirectoryHandle(seg[j], { create: true });
      }
      var fh = await dir.getFileHandle(seg[seg.length - 1], { create: true });
      var w = await fh.createWritable();
      await w.write(files[path]);
      await w.close();
    }
  }

  /* ---------- 手写 STORE ZIP（无压缩，UTF-8 文件名） ---------- */
  var CRC_TABLE = (function () {
    var t = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function strBytes(s) { return new TextEncoder().encode(s); }
  function toBytes(content) {
    if (content instanceof Blob) return null; // Blob 由 async 版本处理
    return strBytes(content);
  }
  function dosDateTime(d) {
    var t = d || new Date();
    return {
      time: u16((t.getHours() << 11) | (t.getMinutes() << 5) | (t.getSeconds() >> 1)),
      date: u16((((t.getFullYear() - 1980) & 0x7F) << 9) | ((t.getMonth() + 1) << 5) | t.getDate())
    };
  }
  function u16(v) { var b = new Uint8Array(2); b[0] = v & 0xFF; b[1] = (v >> 8) & 0xFF; return b; }
  function u32(v) { var b = new Uint8Array(4); b[0] = v & 0xFF; b[1] = (v >> 8) & 0xFF; b[2] = (v >> 16) & 0xFF; b[3] = (v >>> 24) & 0xFF; return b; }
  function concat(parts) {
    var len = 0, i;
    for (i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len), o = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }
  async function buildZip(files) {
    var central = [], dataParts = [], offset = 0, i;
    var names = Object.keys(files).sort();
    var now = dosDateTime();
    for (i = 0; i < names.length; i++) {
      var name = names[i];
      var nameB = strBytes(name);
      var content = files[name];
      var body;
      if (content instanceof Blob) body = new Uint8Array(await content.arrayBuffer());
      else body = strBytes(content);
      var crc = crc32(body);
      var lh = concat([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), now.time, now.date,
        u32(crc), u32(body.length), u32(body.length), u16(nameB.length), u16(0), nameB
      ]);
      dataParts.push(lh, body);
      central.push(concat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), now.time, now.date,
        u32(crc), u32(body.length), u32(body.length), u16(nameB.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(offset), nameB
      ]));
      offset += lh.length + body.length;
    }
    var cd = concat(central);
    var eocd = concat([
      u32(0x06054b50), u16(0), u16(0), u16(names.length), u16(names.length),
      u32(cd.length), u32(offset), u16(0)
    ]);
    return new Blob([concat(dataParts.concat([cd, eocd]))], { type: 'application/zip' });
  }

  /* ---------- 导出入口 ---------- */
  function exportOne(note) {
    var md = mdFor(note);
    var base = fn(note.title || note.siteName || '游记', 40) || '游记';
    if (window.AndroidVoice && AndroidVoice.saveTextFile) {
      saveFileAndroid('游记-' + base + '.md', md).then(function (ok) {
        flash(ok ? '已保存：Download/' + '游记-' + base + '.md' : '保存失败');
      });
    } else {
      download('游记-' + base + '.md', md);
      flash('已下载 ' + base + '.md');
    }
  }
  async function exportVault(notesIn) {
    if (!notesIn || !notesIn.length) { flash('还没有游记，先去记录几篇'); return; }
    var v = buildVault(notesIn);
    /* 路径 1：Chrome File System Access → 写入真实目录（最像 Obsidian） */
    if (window.showDirectoryPicker) {
      try {
        var root = await window.showDirectoryPicker({ mode: 'readwrite' });
        flash('正在写入 ' + v.count + ' 篇…');
        await writeToDir(root, v.files);
        flash('已写入 ' + v.count + ' 篇到所选目录（含附件）');
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') { return; }  // 用户取消
        /* 其他失败 → 降级 zip */
      }
    }
    /* 路径 2：zip 下载 */
    var zip = await buildZip(v.files);
    download('TRACE-Vault-' + new Date().toISOString().slice(0, 10) + '.zip', zip, 'application/zip');
    flash('已下载库 zip（' + v.count + ' 篇，解压后用 Obsidian 打开）');
  }

  window.Vault = {
    mdFor: mdFor,
    buildVault: buildVault,
    buildZip: buildZip,
    exportOne: exportOne,
    exportVault: exportVault
  };
})();
