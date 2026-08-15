/* loadSitePhoto 改用 fetch（替代 JSONP，代码更简洁；key 校验配置由用户在控制台处理） */
const fs = require('fs');
let t = fs.readFileSync('topic-common.js', 'utf8');
const crlf = t.includes('\r\n');
if (crlf) t = t.replace(/\r\n/g, '\n');

/* 1. 删除 amapJsonp（JSONP 版本），改 fetch */
const jsonpBlock = `  /* 高德 JSONP（详情实景照按需拉取用） */
  function amapJsonp(url, cb) {
    var cbName = 'amapPhotoCb' + Date.now().toString(36) + Math.floor(Math.random() * 9999);
    window[cbName] = function (data) { delete window[cbName]; cb(data); };
    var sc = document.createElement('script');
    sc.src = url + '&callback=' + cbName;
    sc.onerror = function () { delete window[cbName]; cb(null); };
    document.head.appendChild(sc);
  }
`;
if (t.includes(jsonpBlock)) {
  t = t.split(jsonpBlock).join('');
  console.log('amapJsonp removed');
} else console.log('SKIP jsonp removal');

/* 2. fetch 拉取 */
const from = `    amapJsonp('https://restapi.amap.com/v3/place/text?key=' + encodeURIComponent(key) +
      '&keywords=' + encodeURIComponent(s.name) +
      '&city=' + encodeURIComponent(s.city || '') +
      '&offset=1&page=1&extensions=all', function (d) {
      var ph = '';
      try { if (d && d.status === '1' && d.pois && d.pois[0] && d.pois[0].photos && d.pois[0].photos[0]) ph = d.pois[0].photos[0].url; } catch (e) {}
      if (ph) { try { localStorage.setItem('tn_photo_' + s.name, JSON.stringify({ ts: Date.now(), u: ph })); } catch (e) {} cb && cb(ph); }
      else cb && cb(null);
    });`;
const to = `    fetch('https://restapi.amap.com/v3/place/text?key=' + encodeURIComponent(key) +
      '&keywords=' + encodeURIComponent(s.name) +
      '&city=' + encodeURIComponent(s.city || '') +
      '&offset=1&page=1&extensions=all')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var ph = '';
        try { if (d && d.status === '1' && d.pois && d.pois[0] && d.pois[0].photos && d.pois[0].photos[0]) ph = d.pois[0].photos[0].url; } catch (e) {}
        if (ph) { try { localStorage.setItem('tn_photo_' + s.name, JSON.stringify({ ts: Date.now(), u: ph })); } catch (e) {} cb && cb(ph); }
        else cb && cb(null);
      })
      .catch(function () { cb && cb(null); });`;
if (t.includes(from)) {
  t = t.split(from).join(to);
  fs.writeFileSync('topic-common.js', crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log('loadSitePhoto → fetch');
} else console.log('SKIP fetch swap');
