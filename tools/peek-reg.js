/* 提取 TOPIC_REGISTRY 中 hk/mo/tw 的标题等配置 */
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('F:/MyAi/trace/lvyou-v2/topic-meta.js', 'utf8');
const ctx = { window: {}, console };
vm.createContext(ctx);
try { vm.runInContext(src, ctx); } catch (e) { console.log('run err:', e.message); }
const reg = (ctx.window && ctx.window.TOPIC_REGISTRY) || ctx.TOPIC_REGISTRY;
if (!reg) { console.log('no registry'); process.exit(1); }
['hk', 'mo', 'tw', 'bj', 'tj'].forEach(k => {
  const t = reg[k];
  if (!t) { console.log(k, 'NOT FOUND'); return; }
  console.log('===== ' + k + ' =====');
  console.log(JSON.stringify(t, null, 0).slice(0, 500));
});
