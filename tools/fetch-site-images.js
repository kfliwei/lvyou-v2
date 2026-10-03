/* tools/fetch-site-images.js — P0-2 景点实景照本地镜像
 * 遍历 site-images.js 的 SITE_IMAGES（高德 CDN 直链，53 条 http 明文），
 * 下载 → 校魔术字节 → 缩到 ≤900px 宽 JPEG(q78) → images/sites/<md5(名)前16位>.jpg，
 * 生成 site-images-local.js（window.SITE_IMAGES_LOCAL + __missing 失败名单，交人工补源）。
 * 文件名走 ASCII 哈希 slug，不用 encodeURIComponent(中文名)：磁盘上的 %E4%B8%AD… 字面名
 * 会被浏览器/file URL 解码成中文名去找真名文件，必挂 ERR_FILE_NOT_FOUND；且 APK assets
 * 非 ASCII 文件名跨工具链有历史坑（images_sc 全用 sN.svg 即是同族规避）。
 * 幂等：已存在且 >2KB 的产物默认跳过（--force 重拉）。写盘前自检：vm 可解析、
 * 条目数对得上、每个引用的文件真实存在——历史上生成物坏过两次，自检必须留。
 * 用法: node tools/fetch-site-images.js [--force] [--only 名1,名2]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'images', 'sites');
const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const onlyI = argv.indexOf('--only');
const ONLY = onlyI >= 0 ? argv[onlyI + 1].split(',').map(s => s.trim()) : null;

function loadSource() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'site-images.js'), 'utf8'), ctx);
  return ctx.window.SITE_IMAGES || {};
}

const MAGIC = [
  b => b.slice(0, 3).toString('hex') === 'ffd8ff',                       // JPEG
  b => b.slice(0, 8).toString('hex') === '89504e470d0a1a0a',             // PNG
  b => b.slice(0, 4).toString('hex') === '52494646' && b.slice(8, 12).toString() === 'WEBP', // WEBP
];

async function fetchOne(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1024) throw new Error('太小(' + buf.length + 'B)');
  if (!MAGIC.some(m => m(buf))) throw new Error('非图片体(' + buf.slice(0, 4).toString('hex') + ')');
  return buf;
}

async function main() {
  const src = loadSource();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const names = ONLY ? Object.keys(src).filter(n => ONLY.includes(n)) : Object.keys(src);
  const map = {};
  const missing = [];
  let done = 0, skipped = 0;
  const queue = names.slice();
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const name = queue.shift();
      const url = src[name];
      const file = 'images/sites/' + crypto.createHash('md5').update(name).digest('hex').slice(0, 16) + '.jpg';
      const fp = path.join(ROOT, file);
      if (!FORCE && fs.existsSync(fp) && fs.statSync(fp).size > 2048) { map[name] = file; skipped++; continue; }
      let last = null;
      for (let t = 0; t < 3; t++) {
        try {
          const raw = await fetchOne(url);
          const out = await sharp(raw).rotate().resize({ width: 900, withoutEnlargement: true })
            .jpeg({ quality: 78, mozjpeg: true }).toBuffer();
          if (out.length < 1024) throw new Error('产物过小');
          fs.writeFileSync(fp, out);
          map[name] = file;
          break;
        } catch (e) { last = e; await new Promise(r => setTimeout(r, 800 * (t + 1))); }
      }
      if (!map[name]) missing.push(name);
      done++;
      process.stdout.write('\r进度 ' + done + '/' + names.length + (last && !map[name] ? '  最后错误: ' + last.message.slice(0, 40) : '        '));
    }
  });
  await Promise.all(workers);
  console.log('');

  /* 生成 site-images-local.js（逐行 + 末行 __missing，自检后才算成功） */
  const lines = Object.keys(map).sort().map(n => '  ' + JSON.stringify(n) + ': ' + JSON.stringify(map[n]));
  const body = '/* 由 tools/fetch-site-images.js 生成——景点实景照本地镜像清单。勿手改，重跑生成器。 */\n'
    + 'window.SITE_IMAGES_LOCAL={\n' + lines.join(',\n') + ',\n  "__missing": ' + JSON.stringify(missing.sort()) + '\n};\n';
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(body, ctx);
  const chk = ctx.window.SITE_IMAGES_LOCAL;
  const nImg = Object.keys(chk).length - 1;
  if (nImg !== Object.keys(map).length || chk.__missing.length !== missing.length) throw new Error('自检失败：回读条目数不符');
  for (const k of Object.keys(map)) if (!fs.existsSync(path.join(ROOT, map[k]))) throw new Error('自检失败：' + map[k] + ' 不存在');
  fs.writeFileSync(path.join(ROOT, 'site-images-local.js'), body);
  const bytes = Object.values(map).reduce((a, f) => a + fs.statSync(path.join(ROOT, f)).size, 0);
  console.log('镜像 ' + nImg + ' 张（跳过已有 ' + skipped + '），共 ' + (bytes / 1048576).toFixed(1) + ' MB；失败 ' + missing.length + ' 条');
  if (missing.length) console.log('__missing: ' + missing.join('、'));
  console.log('→ site-images-local.js');
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });
