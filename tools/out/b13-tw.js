/* b13-tw.js — 390 档 tw 页残余 5 枚胶囊「收了但没收够」的定点探针
 *
 * 普查里这些胶囊：中心比锚点偏 -7px（不是 0），右缘还溢出 4px。
 * 两种解释要分开：① clamp 算错 lim；② clamp 之后胶囊又变宽（mini/必去N 文案在避让阶段变过）。
 * 所以逐枚报：锚点、--lod-dx/--lod-dy、当前宽、lim（可用区）、按当前宽应有的 dx。
 * 用法：NODE_PATH=…/tools/node_modules node tools/out/b13-tw.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8171', 10);
const VP = (process.env.VP || '390x844').split('x').map(Number);
const PID = process.env.PID || 'tw';
const BASE = 'http://127.0.0.1:' + PORT;
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});

const SNAP = `(() => {
  const mapEl = document.getElementById('mapEl');
  const mr = mapEl.getBoundingClientRect();
  const o = window.TopicEngine.usableInsets();
  const ins = Array.isArray(o) ? o : [o.top, o.right, o.bottom, o.left];
  const bad = !ins || ins.length !== 4 || ins.some(v => typeof v !== 'number' || !isFinite(v));
  const lim = bad ? null : { l: mr.left + ins[3], t: mr.top + ins[0], r: mr.right - ins[1], b: mr.bottom - ins[2] };
  const out = [];
  [].slice.call(document.querySelectorAll('#mapEl .lod-cl')).forEach(function (n) {
    const cont = n.closest('.leaflet-marker-icon');
    const cr = cont.getBoundingClientRect();
    const r = n.getBoundingClientRect();
    const dx = parseFloat(n.style.getPropertyValue('--lod-dx')) || 0;
    const dy = parseFloat(n.style.getPropertyValue('--lod-dy')) || 0;
    /* 减掉当前 dx 回到「纯居中」盒，再算应有内收 */
    const l0 = r.left - dx, r0 = l0 + r.width;
    const anchor = cr.left + cr.width / 2;
    const need = !lim ? NaN : (r0 > lim.r ? lim.r - r0 : (l0 < lim.l ? lim.l - l0 : 0));
    out.push({
      t: (n.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 16),
      w: Math.round(r.width), anch: Math.round(anchor),
      box: [Math.round(r.left), Math.round(r.right)],
      dx: dx, dy: dy, need: Math.round(need),
      centered: Math.round((r.left + r.right) / 2 - anchor),
      over: !lim ? -999 : Math.round(Math.max(0, r.right - lim.r, lim.l - r.left))
    });
  });
  return { ins: ins, mr: [mr.left, mr.top, mr.width, mr.height], bad: !!bad, lim: lim, z: window.TopicEngine._map.getZoom(), caps: out };
})()`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'], headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR ' + String(e.message).slice(0, 120)));
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tn_onboarded', '1'); localStorage.setItem('tn_layer', 'amapStreet'); } catch (e) {} });
  await page.setViewport({ width: VP[0], height: VP[1], deviceScaleFactor: 2 });
  await page.goto(BASE + '/topic.html?p=' + PID, { waitUntil: 'domcontentloaded', timeout: 60000 });

  for (const wait of [1500, 3000, 5000]) {
    await sleep(wait - (wait === 1500 ? 0 : wait === 3000 ? 1500 : 3000));
    const s = await page.evaluate(SNAP);
    const bad = s.caps.filter(c => c.over > 2);
    console.log('--- 累计等待 ' + wait + 'ms  z=' + s.z + '  胶囊 ' + s.caps.length + ' 枚，越可用区 ' + bad.length + ' 枚  内缩=' + JSON.stringify(s.ins) + ' 元素=' + s.mr.map(Math.round).join('x') + (s.bad ? '  【usableInsets 返回非有限值】' : ''));
    s.caps.forEach(c => console.log('    ' + (c.over > 2 ? '*' : ' ') + ' ' + c.t.padEnd(17) +
      ' 宽' + String(c.w).padStart(4) + ' 锚' + String(c.anch).padStart(4) +
      ' 盒' + c.box.join('..').padStart(9) + ' dx=' + String(c.dx).padStart(4) +
      ' 应收=' + String(c.need).padStart(4) + ' 中心偏锚=' + String(c.centered).padStart(4) +
      ' 越=' + c.over));
  }
  await browser.close();
  server.close();
})().catch(e => { console.log('ERR ' + e.stack); process.exit(2); });
