/* B1：生成 topic-meta-lite.js（去掉 routes 行程数据，保留注册表配置 + 自动补全逻辑） */
const fs = require('fs');
const vm = require('vm');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('topic-meta.js', 'utf8'), ctx);
const reg = ctx.window.TOPIC_REGISTRY;
const lite = {};
Object.keys(reg).forEach(k => {
  const t = reg[k];
  const c = {};
  Object.keys(t).forEach(f => { if (f !== 'routes') c[f] = t[f]; });
  lite[k] = c;
});
const out = 'window.TOPIC_REGISTRY=' + JSON.stringify(lite) + ';\n' +
  '/* 自动补全新增专题的 themeOrder / themeIcons（与 topic-meta.js 一致） */\n' +
  '(function(){var ks=Object.keys(window.TOPIC_REGISTRY);ks.forEach(function(k){var t=window.TOPIC_REGISTRY[k];if(!t)return;if(t.themes&&!t.themeOrder)t.themeOrder=Object.keys(t.themes);if(!t.themeIcons)t.themeIcons={};});})();\n';
fs.writeFileSync('topic-meta-lite.js', out, 'utf8');
console.log('lite bytes:', out.length, '| full:', fs.statSync('topic-meta.js').size, '| 省', Math.round((1 - out.length / fs.statSync('topic-meta.js').size) * 100) + '%');
/* 语法校验 */
try { new vm.Script(out, { filename: 'topic-meta-lite.js' }); console.log('SYNTAX OK'); } catch (e) { console.log('ERR', e.message); }
