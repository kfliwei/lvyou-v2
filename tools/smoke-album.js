/* tools/smoke-album.js — 旅行图册三页冒烟（分步 + 进度输出 + 每步超时保护）
 * 覆盖：album.html（沉浸阅读）/ album-edit.html（编辑器）/ 三项子设计
 * 用法: node tools/smoke-album.js [step]   step: seed|read|export|edit|clean|all
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:8125/';

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
}
function log(s) { console.log('... ' + s); }

(async () => {
  const step = process.argv[2] || 'all';
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function openPage(file, waitMs) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
    await Promise.race([
      page.goto(BASE + file, { waitUntil: 'domcontentloaded', timeout: 45000 }),
      sleep(50000).then(() => { throw new Error('goto-timeout:' + file); })
    ]);
    await sleep(waitMs || 2500);
    return { page, errors };
  }
  function realErrors(errors) {
    return errors.filter(e => !/Failed to load resource|net::|ERR_|manifest\.webmanifest/.test(e));
  }
  async function run(stepName, fn) {
    log('STEP ' + stepName);
    try {
      await fn();
    } catch (e) {
      ok(stepName + ': 执行异常', false, e.message.slice(0, 200));
    }
  }

  /* 0. seed */
  if (step === 'all' || step === 'seed') {
    await run('seed', async () => {
      const { page, errors } = await openPage('travel-map.html', 2000);
      log('travel-map opened, seeding...');
      const seeded = await Promise.race([
        page.evaluate(async () => {
          const mk = (id, day, site, lat, lng, text, photos, audio) => ({
            id, ts: new Date('2026-07-' + String(day).padStart(2, '0') + 'T09:00:00').getTime(),
            date: '2026-07-' + String(day).padStart(2, '0'),
            day: '2026-07-' + String(day).padStart(2, '0'),
            title: site, siteName: site, text, raw: text,
            lat, lng, weather: '晴', province: '湖南', city: '湘西',
            tags: ['test'], photos, audio
          });
          const notes = [
            mk('t1', 18, '凤凰古城', 27.95, 109.53, '到凤凰的时候天快黑了。放下行李，沿着沱江慢慢走。', ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='], ''),
            mk('t2', 18, '虹桥', 27.949, 109.533, '吊脚楼里的灯一盏一盏亮起来，江水把灯影拉得很长。', ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='], ''),
            mk('t3', 19, '苗寨', 28.32, 109.41, '第三天开始下雨。雨不大，但是很密，山被洗得很绿。', ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='], ''),
            mk('t4', 19, '沱江', 27.952, 109.52, '我们在廊桥下躲了半个下午，看雨点落在江面上。', [], ''),
            mk('t5', 20, '米粉店', 28.322, 109.412, '离开前的早上，阿婆的米粉店开了。我们一人一碗牛肉粉。', ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='], ''),
            mk('t6', 20, '凤凰古城', 27.95, 109.53, '凤凰的雨下得很突然，但是灯亮起来以后，一切都变得很好看。', [], '')
          ];
          function open(name, ver, store) { return new Promise((res, rej) => { const r = indexedDB.open(name, ver); r.onupgradeneeded = () => { const d = r.result; if (store && !d.objectStoreNames.contains(store)) d.createObjectStore(store, { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
          function clearStore(db, name) { return new Promise(res => { const tx = db.transaction(name, 'readwrite'); const q = tx.objectStore(name).clear(); q.onsuccess = res; }); }
          try {
            let db = await open('gujian-notes', 1, 'notes');
            await clearStore(db, 'notes');
            await new Promise(res => { const tx = db.transaction('notes', 'readwrite'); notes.forEach(n => tx.objectStore('notes').put(n)); tx.oncomplete = res; });
            db.close();
            db = await open('trace-albums', 1, 'albums');
            await clearStore(db, 'albums');
            await new Promise(res => { const tx = db.transaction('albums', 'readwrite'); tx.oncomplete = res; });
            db.close();
            return 'ok';
          } catch (e) { return 'idb-error:' + e.message; }
        }),
        sleep(15000).then(() => 'timeout')
      ]);
      ok('seed: 测试数据写入', seeded === 'ok', seeded);
      ok('seed: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));
      await page.close();
    });
  }

  /* 1. album.html 阅读页 */
  if (step === 'all' || step === 'read') {
    await run('read', async () => {
      const { page, errors } = await openPage('album.html', 4000);
      log('album.html opened');
      const r = await Promise.race([
        page.evaluate(() => {
          const q = s => document.querySelectorAll(s).length;
          const coverImg = document.querySelector('.al-cover__img');
          return {
            cover: q('.al-cover'),
            coverTitle: (document.querySelector('.al-cover__title') || {}).textContent || '',
            opening: q('.al-opening'),
            openingStats: q('.al-opening__stats .al-os'),
            chapters: q('.al-chapter'),
            chapterTitles: [...document.querySelectorAll('.al-ch-title')].map(e => e.textContent),
            mapPlates: q('.al-map-plate svg'),
            audioBlocks: q('.al-audio'),
            closing: q('.al-closing'),
            closingLink: (document.querySelector('.al-closing__link') || {}).getAttribute('href') || '',
            progressBar: q('.al-progress i'),
            editBtn: q('#alEdit'),
            exportBtn: q('#alExport'),
            coverBg: coverImg ? (coverImg.style.backgroundImage || coverImg.style.background || '') : '',
            empty: q('.al-empty')
          };
        }),
        sleep(15000).then(() => 'timeout')
      ]);
      if (r === 'timeout') { ok('read: 页面求值超时', false); }
      else {
        ok('album: 封面渲染', r.cover === 1, 'title=' + r.coverTitle + ' empty=' + r.empty);
        ok('album: 封面使用照片或渐变', /url\(|linear-gradient/.test(r.coverBg), r.coverBg.slice(0, 40));
        ok('album: Opening 渲染', r.opening === 1);
        ok('album: Opening 四指标', r.openingStats === 4, 'n=' + r.openingStats);
        ok('album: 章节渲染', r.chapters >= 3, 'n=' + r.chapters + ' ' + r.chapterTitles.join('/'));
        ok('album: 地图插页 SVG', r.mapPlates >= 1, 'n=' + r.mapPlates);
        ok('album: Closing + 记忆地图闭环', r.closing === 1 && r.closingLink === 'travel-map.html');
        ok('album: 进度条/编辑/导出就位', r.progressBar === 1 && r.editBtn === 1 && r.exportBtn === 1);
      }
      ok('album: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));
      await page.close();
    });
  }

  /* 2. export */
  if (step === 'all' || step === 'export') {
    await run('export', async () => {
      const { page, errors } = await openPage('album.html', 3000);
      const out = await Promise.race([
        page.evaluate(() => new Promise(res => {
          const r = indexedDB.open('trace-albums');
          r.onsuccess = e => {
            const db = e.target.result;
            const tx = db.transaction('albums', 'readonly');
            const q = tx.objectStore('albums').getAll();
            q.onsuccess = () => {
              const list = q.result || [];
              if (!list.length) { res({ ok: false, why: 'no albums' }); return; }
              const a = list[list.length - 1];
              const html = window.Album.exportHTML(a);
              res({ ok: true, len: html.length, hasCover: html.indexOf('al-cover') >= 0, hasClosing: html.indexOf('al-closing') >= 0, hasMap: html.indexOf('al-map-plate') >= 0, hasAudioEl: html.indexOf('al-audio') >= 0 });
            };
            q.onerror = () => res({ ok: false, why: 'idb read err' });
          };
          r.onerror = () => res({ ok: false, why: 'idb open err' });
        })),
        sleep(15000).then(() => 'timeout')
      ]);
      if (out === 'timeout') { ok('export: 超时', false); }
      else {
        ok('export: 导出包含封面/Closing/地图插页', out.ok && out.hasCover && out.hasClosing && out.hasMap, out.why || 'len=' + out.len + ' map=' + out.hasMap + ' audio=' + out.hasAudioEl);
      }
      ok('export: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));
      await page.close();
    });
  }

  /* 3. album-edit.html 编辑器 */
  if (step === 'all' || step === 'edit') {
    await run('edit', async () => {
      const { page, errors } = await openPage('album-edit.html', 4000);
      log('album-edit.html opened');
      const r = await Promise.race([
        page.evaluate(() => {
          const q = s => document.querySelectorAll(s).length;
          return {
            coverCard: q('.ed-cover'), coverSwap: q('#cvSwap'), titleInput: q('#cvTitle'),
            chapterCards: q('.ed-chapter'), photoSlots: q('.eph'), layoutBtns: q('.lay-mode'),
            textAreas: q('.ech-text'), addBar: q('.add-bar'), addBtns: q('.add-btn'), doneBtn: q('#edDone'),
            emptyRoot: q('#edRoot') === 0 ? 0 : (document.getElementById('edRoot') || {}).children.length || 0
          };
        }),
        sleep(15000).then(() => 'timeout')
      ]);
      if (r === 'timeout') { ok('edit: 页面求值超时', false); }
      else {
        ok('edit: 封面卡+换封面按钮', r.coverCard === 1 && r.coverSwap === 1);
        ok('edit: 章节卡渲染', r.chapterCards >= 1, 'n=' + r.chapterCards);
        ok('edit: 照片位渲染', r.photoSlots >= 1, 'n=' + r.photoSlots);
        ok('edit: 布局按钮（每章4种）', r.layoutBtns >= 4, 'n=' + r.layoutBtns);
        ok('edit: 文字编辑区', r.textAreas >= 1);
        ok('edit: 添加栏四按钮', r.addBtns === 4, 'n=' + r.addBtns);
        ok('edit: 完成保存按钮', r.doneBtn === 1);
      }
      ok('edit: 无脚本错误', realErrors(errors).length === 0, realErrors(errors).join(' | ').slice(0, 150));

      /* 3a. 换布局 */
      const lay = await Promise.race([
        page.evaluate(() => {
          const btns = document.querySelectorAll('.ed-chapter .lay-mode');
          if (!btns.length) return 'no-btns';
          const target = [...btns].find(b => b.dataset.l === 'duo') || btns[0];
          target.click();
          return [...document.querySelectorAll('.lay-mode')].map(b => b.className.includes('active') ? b.dataset.l : '').filter(Boolean).join(',');
        }),
        sleep(8000).then(() => 'timeout')
      ]);
      ok('edit-交互: 布局切换生效', lay !== 'timeout' && lay.length > 0, String(lay).slice(0, 40));

      /* 3b. 改文字 */
      const txt = await Promise.race([
        page.evaluate(() => {
          const el = document.querySelector('.ech-text');
          if (!el) return 'no-text';
          el.textContent = '修改后的文字测试';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return el.textContent;
        }),
        sleep(8000).then(() => 'timeout')
      ]);
      ok('edit-交互: 文字编辑生效', txt === '修改后的文字测试', String(txt));

      /* 3c. 添加文字章节 */
      const before = await page.evaluate(() => document.querySelectorAll('.ed-chapter').length);
      await page.evaluate(() => { const b = document.getElementById('addText'); if (b) b.click(); });
      await sleep(500);
      const after = await page.evaluate(() => document.querySelectorAll('.ed-chapter').length);
      ok('edit-交互: 添加章节 +1', after === before + 1, before + '->' + after);

      /* 3d. 删除章节 */
      const beforeD = await page.evaluate(() => document.querySelectorAll('.ed-chapter').length);
      await page.evaluate(() => {
        const cards = document.querySelectorAll('.ed-chapter');
        const last = cards[cards.length - 1];
        const del = last.querySelector('[data-act="del"]');
        if (del) del.click();
      });
      await sleep(600);
      // 点确认（ui.js confirm 的确定按钮 .ui-btn-primary）
      await page.evaluate(() => {
        const btn = document.querySelector('.ui-modal .ui-btn-primary');
        if (btn) btn.click();
      });
      await sleep(500);
      const afterD = await page.evaluate(() => document.querySelectorAll('.ed-chapter').length);
      ok('edit-交互: 删除章节 -1', afterD === beforeD - 1, beforeD + '->' + afterD);

      /* 3e. 完成保存跳转 */
      await page.evaluate(() => { const b = document.getElementById('edDone'); if (b) b.click(); });
      await sleep(1500);
      const url = page.url();
      ok('edit-交互: 完成保存跳转图册', url.indexOf('album.html') >= 0, url.split('/').pop());

      await page.close();
    });
  }

  /* 4. clean */
  if (step === 'all' || step === 'clean') {
    await run('clean', async () => {
      const { page } = await openPage('travel-map.html', 2000);
      await Promise.race([
        page.evaluate(async () => {
          function open(name, store) { return new Promise((res, rej) => { const r = indexedDB.open(name, 1); r.onupgradeneeded = () => { const d = r.result; if (store && !d.objectStoreNames.contains(store)) d.createObjectStore(store, { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
          try {
            let db = await open('gujian-notes', 'notes');
            await new Promise(res => { const tx = db.transaction('notes', 'readwrite'); tx.objectStore('notes').clear(); tx.oncomplete = res; });
            db.close();
            db = await open('trace-albums', 'albums');
            await new Promise(res => { const tx = db.transaction('albums', 'readwrite'); tx.objectStore('albums').clear(); tx.oncomplete = res; });
            db.close();
          } catch (e) {}
        }),
        sleep(10000).then(() => 'timeout')
      ]);
      await page.close();
    });
  }

  await browser.close();
  console.log(fails === 0 ? '\nALL PASS' : '\nFAILS: ' + fails);
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
