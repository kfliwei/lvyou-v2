/* 修复 gen-site-images：用 name 作 key（节点无 id 字段）+ 扩大抓取 */
const fs = require('fs');
let s = fs.readFileSync('tools/gen-site-images.js', 'utf8');
s = s.replace("return { id: s.id, name: s.name, url: ph };", "return { name: s.name, url: ph };");
s = s.replace("return { id: s.id, name: s.name, url: '' };", "return { name: s.name, url: '' };");
s = s.replace("return { id: s.id, name: s.name, url: '' };", "return { name: s.name, url: '' };");
s = s.replace("if (r.url) { out[r.id] = r.url; hit++; }", "if (r.url) { out[r.name] = r.url; hit++; }");
fs.writeFileSync('tools/gen-site-images.js', s, 'utf8');
console.log('key fix applied');
