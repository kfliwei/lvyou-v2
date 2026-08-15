/* 高德 Key 有效性实测（Node 无 Referer） */
const fs = require('fs');
const m = fs.readFileSync('tn-key.js', 'utf8').match(/window\.__TN_AMAP_KEY__ = '([^']+)';/);
const KEY = m[1];
const url = 'https://restapi.amap.com/v3/direction/driving?origin=104.06,30.57&destination=103.62,30.99&extensions=base&key=' + KEY;
fetch(url).then(r => r.json()).then(j => {
  console.log('status:', j.status, 'info:', j.info);
  if (j.status === '1') {
    const p = j.route.paths[0];
    console.log('距离:', (p.distance / 1000).toFixed(1), 'km 耗时:', (p.duration / 3600).toFixed(1), 'h');
  } else {
    console.log('info_code:', j.infocode, 'msg:', j.info);
  }
}).catch(e => console.log('网络错误:', e.message));
