/* 1. openSettings 改为直跳设置页（卡框不再使用）2. travel-map 按钮补 SVG 图标 */
const fs = require('fs');

/* travel-notes.js */
let t = fs.readFileSync('travel-notes.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');
const from = `  function openSettings() {
    buildUI();
    $X(ui.set, '#tnKeyInput').value = localStorage.getItem(AI_KEY) || '';`;
const to = `  function openSettings() {
    /* 2026-08-15：参数卡框移除，直接打开设置页（Key/模型/VAD/保留录音/主题开关/存储均在设置页） */
    location.href = 'settings.html';
    return;
    buildUI();
    $X(ui.set, '#tnKeyInput').value = localStorage.getItem(AI_KEY) || '';`;
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('travel-notes.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('OK   openSettings → settings.html');
} else console.log('SKIP travel-notes');

/* travel-map.html 按钮加图标（与专题页一致） */
let m = fs.readFileSync('travel-map.html', 'utf8');
const mcrlf = m.includes('\r\n');
if (mcrlf) m = m.replace(/\r\n/g, '\n');
const micSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="vertical-align:-2px;margin-right:4px"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11 a7 7 0 0 0 14 0 M12 18 v3"/></svg>';
const listSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="vertical-align:-2px;margin-right:4px"><path d="M9 6 H20 M9 12 H20 M9 18 H20"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>';
const a1 = '<button class="act" onclick="__tnAnywhere()" title="用当前 GPS 位置随手语音记录">随手记</button>';
const a2 = '<button class="act sec" onclick="TravelNotes.openList()">游记</button>';
const b1 = '<button class="act" onclick="__tnAnywhere()" title="用当前 GPS 位置随手语音记录">' + micSvg + '随手记</button>';
const b2 = '<button class="act sec" onclick="TravelNotes.openList()">' + listSvg + '游记</button>';
let n = 0;
if (m.includes(a1)) { m = m.split(a1).join(b1); n++; console.log('OK   travel-map 随手记 icon'); } else console.log('SKIP tm a1');
if (m.includes(a2)) { m = m.split(a2).join(b2); n++; console.log('OK   travel-map 游记 icon'); } else console.log('SKIP tm a2');
fs.writeFileSync('travel-map.html', mcrlf ? m.replace(/\n/g, '\r\n') : m, 'utf8');
console.log('tm patches:', n);
