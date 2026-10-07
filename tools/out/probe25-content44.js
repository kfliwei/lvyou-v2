/* 批次 25-B：内容区那几枚 40px 破坏性钮（.ck-remove / .ech-del）抬到 44 的**代价实测**。
   一次跑完两个状态：注入真行版式 → 量 40 那一版 → 把钮改成 44 再量同一行，
   看行高、页高、有没有横向溢出。不为改而改：抬一枚钮把整页撑高就是要不得的代价。 */
const puppeteer = require('../node_modules/puppeteer-core');
const ROOT = 'F:/MyAi/trace/lvyou-v2/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mk = (host, cls, btnCls, size) => `(() => {
  const box = document.querySelector('${host}') || document.body;
  const row = document.createElement('div');
  row.className = '${cls}';
  row.innerHTML = '${btnCls === 'ck-remove'
    ? '<div class="main"><b>门票与预约凭据</b><small>出发前一周确认，别到门口才发现要预约</small></div>'
    : '<div class="ech-body"><div class="ech-num">Chapter 01</div><input class="ech-title" value="进城的第一站"></div>'}';
  const btn = document.createElement('button');
  btn.className = '${btnCls}';
  btn.textContent = '✕';
  btn.style.width = '${size}px';
  btn.style.height = '${size}px';
  row.appendChild(btn);
  box.appendChild(row);
  const r = btn.getBoundingClientRect(), rr = row.getBoundingClientRect();
  const de = document.documentElement;
  const out = { btn: [Math.round(r.width), Math.round(r.height)], rowH: Math.round(rr.height), pageH: de.scrollHeight, over: de.scrollWidth > de.clientWidth };
  row.remove();
  return out;
})()`;
const CASES = [
  { url: 'checklist.html?trip=p111', host: '#ckBody', cls: 'ck-row', btn: 'ck-remove' },
  { url: 'album-edit.html', host: '.ed-chapter', cls: 'ech-head', btn: 'ech-del' },
];
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] });
  for (const c of CASES) {
    for (const w of [328, 320]) {
      const p = await b.newPage();
      await p.setViewport({ width: w, height: 723, isMobile: true, hasTouch: true });
      await p.goto('file:///' + ROOT + c.url, { waitUntil: 'load', timeout: 40000 });
      await sleep(2200);
      const r40 = await p.evaluate(mk(c.host, c.cls, c.btn, 40));
      const r44 = await p.evaluate(mk(c.host, c.cls, c.btn, 44));
      const hostIn = await p.evaluate(h => !!document.querySelector(h), c.host);
      console.log(w + ' ' + c.url + ' host=' + c.host + (hostIn ? '' : '(缺，落到 body)') + ' :: 40→' + JSON.stringify(r40) + '  44→' + JSON.stringify(r44));
      await p.close();
    }
  }
  await b.close();
})();
