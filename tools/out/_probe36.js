/* tools/out/_probe36.js — 临时探针：按 verify.js 口径打印 §36 候选锚点的命中次数 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const ws = s => s.replace(/\s+/g, ' ').trim();
const flat = s => ws(s.replace(/\/\*[\s\S]*?\*\//g, ''));
const cnt = (s, n) => s.split(n).length - 1;
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const view = f => /\.html$/.test(f) ? ws(rd(f)) : flat(rd(f));

const FILES = ['ui.js', 'design.css', 'topic-common.js', 'topic.html', 'node-manager.html', 'travel-map.html',
  'node-lod.js', 'planner.js', 'share.html', 'story.html', 'wishlist.html', 'travel-notes.js', 'README.md', 'tools/smoke-aria.js'];
const V = {};
FILES.forEach(f => { try { V[f] = view(f); } catch (e) { V[f] = ''; console.log('MISSING ' + f); } });

const NEEDLES = [
  ['ui.js', "function trapFocus(container, sel) {"],
  ['ui.js', "var trap = trapFocus(m, 'button');"],
  ['ui.js', "trap = trapFocus(el, opts.focus);"],
  ['ui.js', "if (n.namespaceURI && n.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;"],
  ['ui.js', "if (n.disabled || n.getAttribute && n.getAttribute('disabled') !== null) continue;"],
  ['ui.js', "var f = [];"],
  ['ui.js', "f.push(n);"],
  ['ui.js', "if (!f.length) return false;"],
  ['ui.js', "var first = f[0], last = f[f.length - 1];"],
  ['ui.js', "function markerLabel(m, label) {"],
  ['ui.js', "function markerKeys(m, fn) {"],
  ['ui.js', "function sheet(el, opts) {"],
  ['ui.js', "if (el.__uiSheet) return el.__uiSheet;"],
  ['ui.js', "el.__uiSheet = api;"],
  ['ui.js', "sheet: sheet, markerLabel: markerLabel, markerKeys: markerKeys, trapFocus: trapFocus"],
  ['ui.js', "el.__uiKeys = 1;"],
  ['ui.js', "setAttribute('aria-live', 'polite')"],
  ['ui.js', 'aria-live'],
  ['ui.js', "'<div class=\"ui-errorbox\" role=\"alert\" aria-live=\"assertive\">'"],
  ['ui.js', "'<div class=\"eb-t\"></div><div class=\"eb-d\"></div>'"],
  ['ui.js', "if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');"],
  ['ui.js', "if (opts.modal) el.setAttribute('aria-modal', 'true');"],
  ['ui.js', "el.removeAttribute('aria-modal');"],
  ['ui.js', "if (opener) opener.setAttribute('aria-expanded', 'true');"],
  ['ui.js', "opener.setAttribute('aria-expanded', 'false');"],
  ['ui.js', "if (api.isOpen()) return;"],
  ['ui.js', "if (!api.isOpen()) { detach(); return; }"],
  ['ui.js', "if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');"],
  ['ui.js', "var pageLabel = !!el.getAttribute('aria-label');"],
  ['ui.js', "if (!pageLabel && lb) el.setAttribute('aria-label', lb);"],
  ['ui.js', "var cls = opts.cls || 'show';"],
  ['ui.js', "if (!back.isConnected) {"],
  ['ui.js', "var want = back.getAttribute && back.getAttribute('aria-label');"],
  ['ui.js', "document.querySelector('.leaflet-marker-icon[aria-label=\"'"],
  ['ui.js', "document.querySelector('.leaflet-container')"],
  ['ui.js', "aria-hidden"],
  ['ui.js', "inert"],
  ['ui.js', "document.body.appendChild(d);"],
  ['ui.js', "d.appendChild(document.createTextNode(msg));"],
  ['ui.js', "d.appendChild(msg);"],
  ['ui.js', "document.body.appendChild(tileWarnEl);"],
  ['ui.js', "tileWarnEl.textContent = msg;"],
  ['ui.js', "document.body.appendChild(bar);"],
  ['ui.js', "bar.innerHTML = '<span class=\"oic\">'"],
  ['ui.js', "t.textContent = opts.title || '加载失败';"],
  ['ui.js', "d.setAttribute('aria-live', 'polite');"],
  ['ui.js', "d.setAttribute('role', 'status');"],
  ['ui.js', "window.addEventListener('offline', show);"],
  ['ui.js', "if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }"],
  ['ui.js', "document.addEventListener('keydown', keyH);"],
  ['topic-common.js', "UI.markerLabel("],
  ['topic-common.js', "UI.markerKeys("],
  ['topic-common.js', "UI.sheet("],
  ['topic-common.js', "m.setIcon(nodeIcon(SITES[idx], idx === i));"],
  ['topic-common.js', "UI.markerLabel(m, siteAria(SITES[idx]));"],
  ['topic-common.js', "UI.markerKeys(m, function () { openSheet(idx); });"],
  ['topic-common.js', "m.setIcon(nearIcon(s));"],
  ['topic-common.js', "if (window.UI) { UI.markerLabel(nm, siteAria(s)); UI.markerKeys(nm, function () { openSheet(i); }); }"],
  ['topic-common.js', "$('locSheet').classList.add('show')"],
  ['topic-common.js', "$('locSheet').classList.remove('show')"],
  ['topic-common.js', "$('arriveDlg').classList.add('show')"],
  ['topic-common.js', "$('arriveDlg').classList.remove('show')"],
  ['topic-common.js', "nearSheet.classList.remove('open')"],
  ['topic-common.js', "sh.classList.add('open')"],
  ['topic-common.js', "aria-live"],
  ['topic.html', "aria-live"],
  ['topic.html', "var d = document.getElementById('arriveDlg'); if (d) d.classList.remove('show');"],
  ['node-manager.html', "UI.sheet("],
  ['node-manager.html', "aria-live"],
  ['node-manager.html', "$('rsSheet').classList"],
  ['node-manager.html', "$('infoSheet').classList"],
  ['travel-map.html', "UI.sheet("],
  ['travel-map.html', "aria-live"],
  ['travel-map.html', "document.getElementById('memSheet').classList.add('show')"],
  ['travel-map.html', "document.getElementById('memSheet').classList.remove('show')"],
  ['node-lod.js', "UI.markerLabel("],
  ['node-lod.js', "UI.markerKeys("],
  ['node-lod.js', "aria-live"],
  ['node-lod.js', "setAttribute('aria-label'"],
  ['planner.js', "UI.markerLabel("],
  ['planner.js', "UI.markerKeys("],
  ['planner.js', 'role="list"'],
  ['planner.js', 'role="listitem"'],
  ['planner.js', "aria-live"],
  ['share.html', "UI.markerLabel("],
  ['share.html', "UI.markerKeys("],
  ['share.html', 'role="list"'],
  ['share.html', 'role="listitem"'],
  ['share.html', "aria-live"],
  ['story.html', "UI.markerLabel("],
  ['story.html', "UI.markerKeys("],
  ['story.html', "aria-live"],
  ['wishlist.html', "UI.markerLabel("],
  ['wishlist.html', "UI.markerKeys("],
  ['wishlist.html', "aria-live"],
  ['travel-notes.js', "UI.markerLabel("],
  ['travel-notes.js', "UI.markerKeys("],
  ['travel-notes.js', "UI.sheet("],
  ['travel-notes.js', "aria-live"],
  ['design.css', ":focus-visible"],
  ['tools/smoke-aria.js', "ok('A"],
  ['tools/smoke-aria.js', "ok('C"],
  ['tools/smoke-aria.js', "ok('D"],
  ['tools/smoke-aria.js', "ok('S"],
  ['tools/smoke-aria.js', "ok('E"],
  ['tools/smoke-aria.js', 'interestingOnly: false'],
  ['tools/smoke-aria.js', 'interestingOnly: true'],
  ['tools/smoke-aria.js', 'Share.encodePayload(Share.payloadOf'],
  ['README.md', '§36'],
];
NEEDLES.forEach(([f, n]) => console.log(cnt(V[f], n) + '\t' + f + '\t' + n));
console.log('--- aria-live 全站分布（除 ui.js 外应 0）');
FILES.filter(x => x !== 'ui.js' && x !== 'README.md' && x !== 'tools/smoke-aria.js').forEach(f => {
  const c = cnt(V[f], 'aria-live');
  if (c) console.log('  ' + f + ' ' + c);
});
console.log('--- 全站 L.marker( 数');
['node-lod.js', 'node-manager.html', 'planner.js', 'share.html', 'story.html', 'topic-common.js', 'travel-map.html', 'travel-notes.js', 'wishlist.html'].forEach(f =>
  console.log('  ' + f + ' marker=' + cnt(V[f], 'L.marker(') + ' label=' + cnt(V[f], 'UI.markerLabel(') + ' keys=' + cnt(V[f], 'UI.markerKeys(')));
console.log('=== 第二批 ===');
[['topic.html', "UI.sheet("], ['topic-common.js', "addEventListener('keydown'"], ['node-lod.js', "addEventListener('keydown'"],
 ['node-lod.js', "'add', set"], ['planner.js', "第 ' + (di + 1) + ' 天"], ['planner.js', "赶路日"],
 ['planner.js', "共 ' + days.length + ' 天"], ['share.html', "赶路日"], ['share.html', "共 ' + days.length + ' 天"],
 ['tools/smoke-aria.js', "ok('"], ['tools/smoke-aria.js', "Share.encodePayload(window.Share.payloadOf(t))"],
 ['ui.js', "'http://www.w3.org/1999/xhtml'"], ['node-manager.html', "UI.markerKeys("],
 ['planner.js', "'，' + s.name"], ['travel-notes.js', "UI.markerLabel(m, (n.title"],
 ['wishlist.html', "UI.markerLabel(m, (x.label"], ['share.html', "UI.markerLabel(mk, (i + 1)"]].forEach(([f, n]) =>
  console.log(cnt(V[f], n) + '\t' + f + '\t' + n));
