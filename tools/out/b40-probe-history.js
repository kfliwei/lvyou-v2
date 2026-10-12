const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:8125';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  const rd = () => p.evaluate('({len: history.length, state: history.state && history.state.tnEdit !== undefined ? "tnEdit" : (history.state && history.state.tnPanel !== undefined ? "tnPanel" : JSON.stringify(history.state))})');
  const log = async (tag) => console.log(tag, JSON.stringify(await rd()));

  await log('1 进屏');
  await p.evaluate('history.pushState({tnPanel:1},"")');       // 模拟「录音面板」压一条
  await new Promise(r => setTimeout(r, 150));
  await log('2 面板压一条后');
  await p.evaluate('history.back()');                            // 关面板时收掉自己压的那条
  await new Promise(r => setTimeout(r, 400));
  const hb = await rd();
  console.log('3 back 之后（这就是腿里的基线 HB）', JSON.stringify(hb));
  await p.evaluate('history.pushState({tnEdit:1},"")');         // 模拟「编辑游记屏」开层压一条
  await new Promise(r => setTimeout(r, 150));
  await log('4 编辑层压一条后');
  await b.close();
})();
