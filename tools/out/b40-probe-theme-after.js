/* 落地验证：修后 bj 页 chip 文案已归一，点主题 chip 不再「整张图变淡零命中」，图例那行出现且联动 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('file:///' + path.join(ROOT, 'topic.html?p=bj').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction('window.TopicEngine && document.querySelectorAll("#dynChips .chip").length > 3', { timeout: 25000 });
  await p.evaluate(() => window.TopicEngine._map.setView([39.92, 116.40], 12));
  await new Promise(r => setTimeout(r, 1800));

  const READ = () => ({
    chips: [...document.querySelectorAll('#dynChips .chip')].map(c => c.textContent.trim().slice(0, 10)),
    legs: [...document.querySelectorAll('#legBody .lg')].map(l => l.dataset.th + '|' + l.textContent.trim().slice(0, 12)),
    total: document.querySelectorAll('#mapEl .tr-node').length,
    dim: document.querySelectorAll('#mapEl .tr-dim').length,
    onChips: [...document.querySelectorAll('#dynChips .chip.on')].map(c => c.textContent.trim().slice(0, 10)),
    onLegs: [...document.querySelectorAll('#legBody .lg.on')].map(l => l.dataset.th),
  });

  const pre = await p.evaluate(READ);
  console.log('进屏 chip(' + pre.chips.length + '):', pre.chips.join(' '));
  console.log('进屏 图例行:', pre.legs.join(' / '));
  console.log('进屏 节点 总/淡:', pre.total + '/' + pre.dim);

  /* 修前点「古建寺院」＝state.theme 存别名，筛选比归一值 → 全淡。修后这颗不存在，只有「寺庙」 */
  for (const label of ['寺庙', '森林草原', '古城古镇']) {
    const hit = pre.chips.some(c => c.indexOf(label) === 0);
    if (!hit) { console.log('!! chip 里没有「' + label + '」，跳过'); continue; }
    await p.evaluate(l => { [...document.querySelectorAll('#dynChips .chip')].find(c => c.textContent.trim().indexOf(l) === 0).click(); }, label);
    await new Promise(r => setTimeout(r, 1500));
    const s = await p.evaluate(READ);
    console.log('点「' + label + '」→ 总 ' + s.total + ' 淡 ' + s.dim + ' 亮 ' + (s.total - s.dim) +
      ' | chip选中=' + s.onChips.join(',') + ' | 图例选中=' + s.onLegs.join(',') +
      (hit ? '' : ' (chip缺席)'));
    await p.evaluate(() => { document.querySelector('#dynChips .chip.all').click(); });
    await new Promise(r => setTimeout(r, 1000));
  }

  /* 列表 tab 的分组标题也吃同一个 themeOrder，确认没有空组 */
  const groups = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.tl-head, .tl-group h3, #listBody h3').forEach(h => out.push(h.textContent.trim().slice(0, 16)));
    return out;
  });
  console.log('列表分组标题:', groups.join(' / ') || '(取样选择器没命中)');
  console.log('未捕获报错:', errs.length ? errs.slice(0, 3).join(' | ') : '0');
  await b.close();
})();
