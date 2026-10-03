/* gen-icons.js - 从 lucide-static 生成应用图标 sprite（icons.js）与画廊（icons-demo.html）
 * 用法: node tools/gen-icons.js   （需先 npm i lucide-static）
 * lucide-static v1.51.0, ISC License - 生成产物头部已带声明 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'node_modules', 'lucide-static', 'icons');

/* lucide 文件名 -> 行迹图标名 */
const MAP = {
  'arrow-left': 'back', 'x': 'close', 'copy': 'copy', 'search': 'search', 'settings': 'settings',
  'star': 'star', 'heart': 'heart', 'camera': 'camera', 'map': 'map', 'map-pin': 'pin',
  'plus': 'plus', 'minus': 'minus', 'play': 'play', 'pause': 'pause', 'save': 'save',
  'upload': 'export', 'download': 'import', 'hourglass': 'hourglass',
  'triangle-alert': 'warn', 'check': 'check', 'refresh-cw': 'sync',
  'sun': 'sun', 'cloud': 'cloud', 'cloud-rain': 'rain', 'snowflake': 'snow', 'cloud-sun': 'cloudsun', 'cloud-lightning': 'bolt',
  'car': 'car', 'train-front': 'train', 'plane': 'plane', 'bed-double': 'hotel',
  'utensils': 'food', 'wallet': 'budget', 'users': 'companions', 'calendar': 'calendar',
  'trending-up': 'stats', 'image': 'gallery', 'compass': 'compass', 'file-text': 'note',
  'mic': 'mic', 'trash-2': 'trash', 'pencil': 'edit', 'link': 'link', 'house': 'home',
  'moon': 'moon', 'clock': 'clock', 'scissors': 'cut', 'eye': 'eye', 'sparkles': 'sparkles',
  'landmark': 'landmark', 'route': 'route', 'bookmark': 'bookmark', 'share-2': 'share',
  'wifi-off': 'wifioff', 'loader-circle': 'loader', 'trophy': 'trophy', 'book-open': 'book',
  'palette': 'palette', 'mountain': 'mountain', 'footprints': 'footprints', 'user': 'user',
  'list': 'list', 'layout-grid': 'grid', 'flag': 'flag', 'info': 'info', 'lock': 'lock',
  'globe': 'globe', 'navigation': 'navigation', 'locate-fixed': 'locate', 'layers': 'layers',
  'sliders-horizontal': 'filter', 'pen-line': 'pen', 'notebook-pen': 'journal',
  'volume-2': 'volume', 'headphones': 'headphones', 'message-circle': 'chat', 'smile': 'smile', 'meh': 'meh', 'frown': 'sad', 'gauge': 'gauge', 'map-pinned': 'pinned', 'ticket': 'ticket'
};

function innerOf(file) {
  const s = fs.readFileSync(file, 'utf8');
  const start = s.indexOf('<svg');         /* 先跳过文件头部的许可证注释 */
  const openEnd = s.indexOf('>', start) + 1; /* 再取 <svg ...> 开标签真正的结尾 */
  const j = s.lastIndexOf('</svg>');
  return s.slice(openEnd, j).trim().replace(/\s+/g, ' ');
}

const syms = {}, missing = [];
for (const [src, name] of Object.entries(MAP)) {
  const f = path.join(SRC, src + '.svg');
  if (!fs.existsSync(f)) { missing.push(src); continue; }
  syms[name] = innerOf(f);
}
if (missing.length) { console.error('MISSING:', missing.join(', ')); process.exit(1); }

const names = Object.keys(syms);
const js = '/* icons.js - 行迹 TRACE 图标库（由 tools/gen-icons.js 生成，勿手改）\n'
  + ' * 源: lucide-static v1.51.0 (ISC License) - 24x24 网格 / 2px 圆头描边 / currentColor\n'
  + ' * 重新生成: node tools/gen-icons.js    图形清单: ' + names.length + ' 个\n'
  + ' * 用法: TI("mic") 返回 <svg><use> 字符串; TI("mic",20,"lg") 可调尺寸与附加类名 */\n'
  + '(function () {\n'
  + '  var SYMS = {\n'
  + names.map(function (n) { return '    ' + JSON.stringify(n) + ': ' + JSON.stringify(syms[n]); }).join(',\n') + '\n'
  + '  };\n'
  + '  var SPRITE = \'<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">\'\n'
  + '    + Object.keys(SYMS).map(function (n) { return \'<symbol id="ti-\' + n + \'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\' + SYMS[n] + \'</symbol>\'; }).join(\'\')\n'
  + '    + \'</svg>\';\n'
  + '  function inject() { if (!document.getElementById("ti-sprite")) { var d = document.createElement("div"); d.id = "ti-sprite"; d.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; d.innerHTML = SPRITE; document.body.insertBefore(d, document.body.firstChild); } }\n'
  + '  if (document.body) inject(); else document.addEventListener("DOMContentLoaded", inject);\n'
  + '  window.TI = function (name, size, cls) {\n'
  + '    if (!SYMS[name]) return \'\';\n'
  + '    var s = size || 16;\n'
  + '    return \'<svg class="ti \' + (cls || \'\') + \'" aria-hidden="true" width="\' + s + \'" height="\' + s + \'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#ti-\' + name + \'"/></svg>\';\n'
  + '  };\n'
  + '  window.TI_NAMES = ' + JSON.stringify(names) + ';\n'
  + '})();\n';
fs.writeFileSync(path.join(ROOT, 'icons.js'), js, 'utf8');

const cell = function (n) {
  return '<div class="cell"><div class="row">'
    + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + syms[n] + '</svg>'
    + '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + syms[n] + '</svg>'
    + '</div><div class="nm">' + n + '</div></div>';
};
const demo = '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>行迹图标库 · ' + names.length + '</title><style>'
  + 'body{font-family:system-ui;margin:24px;background:#F7F5EF;color:#20201D}'
  + 'h1{font-size:18px} p{color:#7D7970;font-size:13px}'
  + '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}'
  + '.cell{background:#fff;border:1px solid #E6E1D7;border-radius:12px;padding:12px 10px;text-align:center}'
  + '.row{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:8px}'
  + '.nm{font-size:11px;color:#7D7970;font-family:monospace}'
  + '.dark{background:#20201D;color:#F4EDDF;padding:20px;border-radius:14px;margin-top:20px}'
  + '.dark .cell{background:#2B2A26;border-color:#4C4A45}.dark .nm{color:#AAA59B}'
  + '</style></head><body>'
  + '<h1>行迹图标库 · ' + names.length + ' 字形</h1><p>lucide-static v1.51.0 (ISC) · 24 网格 / 2px 描边 / currentColor · 生成于 ' + new Date().toISOString().slice(0, 10) + '</p>'
  + '<div class="grid">' + names.map(cell).join('') + '</div>'
  + '<div class="dark"><div class="grid">' + names.slice(0, 24).map(function (n) {
      return '<div class="cell"><div class="row"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + syms[n] + '</svg></div><div class="nm">' + n + '</div></div>';
    }).join('') + '</div></div>'
  + '</body></html>';
fs.writeFileSync(path.join(ROOT, 'icons-demo.html'), demo, 'utf8');
console.log('OK icons.js: ' + names.length + ' glyphs; icons-demo.html written');
