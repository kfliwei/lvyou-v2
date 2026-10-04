/* 探针：连续两次 startViewTransition，被 abort 的那次到底从哪条 promise 冒出来。
   ViewTransition 有 updateCallbackDone / ready / finished（老版本还有 done），
   UI.vt 目前只 catch 了 finished + updateCallbackDone。若拒绝来自 ready，就得补。
   跑法：NODE_PATH=F:/MyAi/trace/lvyou-v2/tools/node_modules node tools/out/probe-vt-abort.js */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async function () {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const CASES = {
    none: '',
    fin: 't.finished.catch(function(e){window.__rx.push("finished:"+e.name+":" + e.message)});',
    fin_upd: 't.finished.catch(function(e){window.__rx.push("finished:"+e.name+":" + e.message)});t.updateCallbackDone.catch(function(e){window.__rx.push("updateCallbackDone:"+e.name+":" + e.message)});',
    all3: 't.finished.catch(function(e){window.__rx.push("finished:"+e.name+":" + e.message)});t.updateCallbackDone.catch(function(e){window.__rx.push("updateCallbackDone:"+e.name+":" + e.message)});t.ready.catch(function(e){window.__rx.push("ready:"+e.name+":" + e.message)});'
  };
  for (const [name, catchCode] of Object.entries(CASES)) {
    const page = await browser.newPage();
    const perr = [];
    page.on('pageerror', function (e) { perr.push(e.message); });
    await page.setContent('<!doctype html><meta charset=utf-8><title>p</title><body><div id=x style="width:100px;height:100px;background:#ccc"></div></body>');
    const r = await page.evaluate(async function (catchCode) {
      window.__rx = [];
      const step = function () { const d = document.getElementById('x'); d.style.background = '#' + Math.random().toString(16).slice(2, 8); };
      const t = document.startViewTransition(step);
      window.__keys = Object.keys(t).concat(['ready' in t, 'finished' in t, 'updateCallbackDone' in t, 'done' in t]);
      eval(catchCode);
      /* 紧接着再来一次：前一个会被 abort */
      const t2 = document.startViewTransition(step);
      await new Promise(function (res) { setTimeout(res, 900); });
      return { rx: window.__rx.slice(0), perr: 0, keys: window.__keys, chrome: navigator.userAgent };
    }, catchCode);
    await new Promise(function (res) { setTimeout(res, 300); });
    console.log('CASE ' + name + '  已catch到的拒绝=' + JSON.stringify(r.rx) + '  pageerror=' + JSON.stringify(perr));
    if (name === 'none') console.log('  ViewTransition 上有的 promise 字段: ' + JSON.stringify(r.keys) + '\n  ' + r.chrome);
    await page.close();
  }
  await browser.close();
})().catch(function (e) { console.log('探针崩了: ' + (e && e.stack || e)); process.exit(2); });
