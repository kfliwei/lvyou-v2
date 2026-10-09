/* tools/out/probe32-mask.js — 只跑 L4 的几何腿：328×723 下面板开着时，遮罩到底摸不摸得到
 * 用途：probe32-overwrite.js 的 9px 网格数出 mask 命中 0/2997，另外 198 个点落在「其它元素」上，
 *       这里把这 198 个点具体是谁列出来，免得把没查清的东西写进结论。
 * 用法：PYTHONIOENCODING=utf-8 NODE_PATH=tools/node_modules node tools/out/probe32-mask.js */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = parseInt(process.env.PORT || '8153', 10);
const BASE = 'http://127.0.0.1:' + PORT;

function staticServer() {
  return http.createServer(function (req, res) {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html;charset=utf-8'
        : p.endsWith('.css') ? 'text/css;charset=utf-8'
        : p.endsWith('.js') ? 'text/javascript;charset=utf-8'
        : p.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
      res.end(data);
    });
  });
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  const server = staticServer();
  await new Promise(function (r) { server.listen(PORT, '127.0.0.1', r); });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 328, height: 723, deviceScaleFactor: 2 });
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate('localStorage.setItem("tn_onboarded","1")');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.TravelNotes && TravelNotes.ensureUI', { timeout: 20000 });
  await sleep(600);
  await page.evaluate('TravelNotes.ensureUI(); TravelNotes.openPanel({label:"应县木塔",lat:39.66,lng:113.19,__i:0})');
  await sleep(500);
  var EXPR = '(function(){var e=document.elementFromPoint(164,360);return e?(e.tagName+"."+(e.className||"")):"null";})()';
  console.log('面板状态+命中 = ' + await page.evaluate(
    'JSON.stringify({inline:document.querySelector(".tn-panel").style.display,' +
    'computed:getComputedStyle(document.querySelector(".tn-panel")).display,' +
    'visibility:getComputedStyle(document.querySelector(".tn-panel")).visibility,' +
    'opacity:getComputedStyle(document.querySelector(".tn-panel")).opacity,' +
    'rect:(function(){var r=document.querySelector(".tn-panel").getBoundingClientRect();' +
    'return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];})(),' +
    'at164_360:' + EXPR + '})'));
  await sleep(900);
  console.log('再等 900ms 后 at164_360 = ' + await page.evaluate(EXPR));

  console.log('mask display = ' + await page.evaluate('document.querySelector(".tn-mask").style.display'));
  console.log('遮罩矩形 = ' + JSON.stringify(await page.evaluate(
    '(function(){var m=document.querySelector(".tn-mask").getBoundingClientRect();return [m.left,m.top,m.width,m.height];})()')));

  const detail = await page.evaluate('(function(){' +
    'var out={},order=[];' +
    'function key(e){if(!e)return "null";var c=(e.className&&typeof e.className==="string")?e.className.split(" ").filter(Boolean).join("."):"";' +
    'return e.tagName + (e.id?"#"+e.id:"") + (c?"."+c:"");}' +
    'function pes(e){var a=[],n=e;while(n&&n!==document.body){var s=getComputedStyle(n);a.push((n.tagName)+"{z:"+s.zIndex+",pe:"+s.pointerEvents+",pos:"+s.position+"}");n=n.parentElement;}return a.join(" | ");}' +
    'for(var y=2;y<723;y+=9){for(var x=2;x<328;x+=9){var e=document.elementFromPoint(x,y);var k=key(e);' +
    'out[k]=(out[k]||0)+1;if((k==="null"||!(e.closest&&e.closest(".tn-panel")))&&order.length<3)order.push({p:[x,y],k:k,chain:pes(e)});}}' +
    'return {counts:out,nonPanelSamples:order};})()');
  console.log('网格归属计数 = ' + JSON.stringify(detail.counts));
  console.log('非面板点样本 = ' + JSON.stringify(detail.nonPanelSamples, null, 1));

  /* 面板内「可点的关闭出口」逐个列出：真实用户能摸到的就这几颗 */
  console.log('面板上的关闭/危险控件 = ' + JSON.stringify(await page.evaluate(
    '(function(){var a=[];[].slice.call(document.querySelectorAll(".tn-panel button,.tn-panel .tn-x")).forEach(function(e){' +
    'var r=e.getBoundingClientRect();a.push({id:e.id||"",cls:String(e.className).slice(0,26),txt:(e.textContent||"").trim().slice(0,10),' +
    'rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],' +
    'click:(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e)});});return a;})()')));

  await browser.close();
  server.close(function () {});
})().catch(function (e) { console.error('ERR ' + (e && e.stack || e)); process.exit(1); });
