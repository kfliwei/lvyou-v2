const fs = require('fs');
const F = 'docs/功能与UI全面审核-2026-10-09.md';
const L = fs.readFileSync(F, 'utf8').split('\n');
const i = L.findIndex(l => l.indexOf('- **批次 37 已落地（2026-10-11）') === 0);
if (i === -1) { console.log('ABORT 找不到批次 37 那条变更日志'); process.exit(2); }
if (L[i + 1].indexOf('- **') !== 0) { console.log('ABORT 该条下一行不是同列表的项：' + JSON.stringify(L[i + 1].slice(0, 60))); process.exit(2); }
const NEW = '- **README 改写之后复跑了哪几条（批次 37-D 的最后一步，登记以免日后对不上账）**：本批把 `README.md` 的 §47 登记段改写了六处（条数、族数、场景名、变异网读数，以及把同类漏口的 `results.js` 行号从凭印象的 `426/427` 订正为实测的 **`425/426`**——那一族的两枚钮在 425 与 426，`426` 是遮罩那一行），而 `README.md` 在 `FILES47` 的受检名单里，所以「85 条全量跑过」那份读数是**改写之前**的树。按「锚点随文件漂移要复跑」复打 README 那一发：`MUT_ONLY=S17 MUT_LOG=tools/out/b37-mut47-s17.txt node tools/out/mut-verify47.js` ⇒ 基准两条腿当场全绿（verify 印 81 条锚、smoke 95 条 I+J）＋启动指纹（`README.md` 含「§47 不可逆动作闸门」）过，靶子红在那句「README.md 的 verify 清单没提 §47（新闸门不写进 README 就等于没装）」。为什么只复打这一发：README 改写只碰 §47 的**散文与行号引用**，闸门对 README 只锚 `indexOf(\'§47\')` 一处（现读 4 个 `§47`，`S17` 用 `kind:\'all\'` 抹全部出现，出现数变了判据不失效），而全网 85 发里 `kind:\'all\'` 只有这一发（摘要行「红 73／抹登记 1／静默 11」那个 1 就是它）；其余 84 发的靶子串全在 `travel-notes.js`／`sync-webdav.js`／`settings.html`／`tools/verify.js`／`tools/smoke-irreversible.js` 这五个文件里，本批定稿之后一个字节没再改。**复跑副作用当场收拾**：`S17` 那次连带重跑了基线 smoke，它按固定文件名落 `tools/out/b32-smoke-irreversible.txt`，同一棵树复跑后读数 **117 行／95 PASS／0 FAIL**（`I56` 读 `checks=94`）。最后 `node tools/verify.js` **exit 0／0 FAIL／`=== ALL CHECKS PASSED ===`**（`tools/out/b37-verify-docfix.txt`：verify 自身那 112 行与上面 `b37-verify-docs.txt` 同口径、§47 同在 `:106`，文件另有 5 行是包装脚本自己追加的对账行——exit／行数／FAIL 计数／§47 那行摘要，这份「长跑证据由脚本落盘」的口径就是上一批那条过程账换来的）。';
L.splice(i + 1, 0, NEW);
fs.writeFileSync(F, L.join('\n'));
const chk = fs.readFileSync(F, 'utf8').split('\n');
console.log('OK 插入于第 ' + (i + 2) + ' 行之后 · 总行数 ' + chk.length);
console.log('新行前 60: ' + chk[i + 1].slice(0, 60));
console.log('其后 3 行首 40: ' + [chk[i + 2], chk[i + 3], chk[i + 4]].map(s => JSON.stringify(s.slice(0, 40))).join(' | '));
