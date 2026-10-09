const fs = require('fs');
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
lines.forEach((line, i) => {
  const k = line.indexOf(': ');
  if (k < 0 || !/^\{/.test(line.slice(k + 2))) { console.log('[' + i + '] RAW ' + line.slice(0, 120)); return; }
  let o;
  try { o = JSON.parse(line.slice(k + 2)); } catch (e) { console.log('[' + i + '] UNPARSABLE ' + line.slice(0, 80)); return; }
  console.log('[' + i + '] ' + line.slice(0, k) + ' ->');
  Object.keys(o).forEach(key => {
    const v = o[key];
    console.log('     ' + key + ' = ' + (typeof v === 'object' ? JSON.stringify(v).slice(0, 400) : String(v).slice(0, 400)));
  });
});
