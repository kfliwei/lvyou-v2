/* check-topic-catalog.js — 验证 index/explore-map 列表由 topic-catalog.js 正常渲染 */
const p = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const b = await p.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await b.newPage();
  await pg.goto('file:///F:/myai/trace/explore-map.html');
  await new Promise(r => setTimeout(r, 800));
  console.log('explore-map items:', await pg.evaluate(() => document.querySelectorAll('#topicList .story-item').length));
  await pg.goto('file:///F:/myai/trace/index.html');
  await new Promise(r => setTimeout(r, 800));
  const n2 = await pg.evaluate(() => document.querySelectorAll('#topicList .story-item').length);
  const cnt = await pg.evaluate(() => { var e = document.querySelector('#topicList .story-item__n'); return e ? e.textContent : '(none)'; });
  console.log('index featured:', n2, '| first count:', cnt);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
