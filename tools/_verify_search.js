var fs = require('fs');
var s = fs.readFileSync('nation-index.js', 'utf8');
var raw = s.match(/NATION_SITES_RAW="([\s\S]*)"/)[1];
var SITES = raw.split(/\n/).map(function (line) {
  var p = line.split('|');
  return { name: p[0], label: p[1], region: p[2], city: p[3], county: p[4], theme: p[5], flag: p[6], lat: +p[7], lng: +p[8], desc: p[9] || '' };
});

var PROV_KEY = {'北京':'bj','天津':'tj','河北':'he','山西':'sx','内蒙古':'nmg','辽宁':'ln','吉林':'jl','黑龙江':'hlj','上海':'sh','江苏':'js','浙江':'zj','安徽':'ah','福建':'fj','江西':'jx','山东':'sd','河南':'ha','湖北':'hb','湖南':'hn','广东':'gd','广西':'gy','海南':'hi','重庆':'cq','四川':'sc','贵州':'gz','云南':'gy','西藏':'xz','陕西':'sx2','甘肃':'gs','青海':'qh','宁夏':'nx','新疆':'xj','香港':'hk','澳门':'mo','台湾':'tw'};

function search(q, region, theme) {
  q = q.toLowerCase();
  var words = q.split(/\s+/).filter(Boolean);
  var hits = [];
  SITES.forEach(function (s) {
    if (region && s.region !== region) return;
    if (theme && (s.theme || '') !== theme) return;
    var hay = (s.name + ' ' + s.label + ' ' + s.region + ' ' + s.city + ' ' + s.county + ' ' + (s.theme || '') + ' ' + (s.desc || '')).toLowerCase();
    if (words.every(function (w) { return hay.indexOf(w) >= 0; })) hits.push(s);
  });
  return hits;
}

function show(tag, hits) {
  console.log(tag + ': ' + hits.length + ' 个');
  hits.slice(0, 5).forEach(function (s) { console.log('   ' + s.name + ' [' + s.region + '] -> ' + (PROV_KEY[s.region] || 'nation')); });
}

show('搜「四大石窟」(desc匹配)', search('四大石窟'));
show('搜「海内孤品」(desc匹配)', search('海内孤品'));
show('搜「山西 石窟」(多关键词)', search('山西 石窟'));
show('搜「太原 古塔」(多关键词)', search('太原 古塔'));
var jx = search('庐山');
show('搜「庐山」(江西→jx)', jx);
var jxNote = search('庐山')[0];
console.log('   庐山跳转 key = ' + (PROV_KEY[jxNote.region] || 'nation') + (PROV_KEY[jxNote.region] === 'jx' ? ' ✓' : ' ✗'));
