/* tools/apply-desc.js — 批量写回景点 desc（精确替换 "desc":"旧值" -> "desc":"新值"）
 * 用法: node tools/apply-desc.js
 * 每批补全后，把「文件 → {旧desc → 新desc}」写进 PATCHES 再跑一次。
 */
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

// 文件 → { 旧desc(精确) : 新desc }
var PATCHES = {
  'tw-data.js': {
    '高山湖泊。': '台湾最大天然湖泊，位于南投县鱼池乡，湖中拉鲁岛分湖为日轮月钩两半故名。青山环抱湖水澄碧，环湖有文武庙、玄奘寺、慈恩塔等名胜，可乘船游湖、骑行环潭，是宝岛最具代表性的山水胜景。',
    '日出云海。': '位于嘉义县，海拔两千余米，以日出、云海、晚霞、森林与小火车五奇著称。阿里山森林铁路是世界仅存三条高山铁路之一，巨木群步道有数十株千年红桧，樱花季满山粉樱，是台湾最具代表性的高山胜地。',
    '热带海岸。': '位于台湾岛最南端恒春半岛，三面环海，拥有热带海岸、珊瑚礁与洁白沙滩，是台湾第一座国家公园。鹅銮鼻灯塔、猫鼻头、垦丁大街与水上活动闻名，四季温暖，是南台湾最热门的度假胜地。'
  },
  'mo-data.js': {
    '澳门地标。': '澳门标志性建筑，原为圣保禄教堂正面前壁，1602年始建、1637年竣工，1835年大火后仅存前壁。花岗石砌筑，高25.5米宽23米，巴洛克风格融合东方元素，为远东第一所西式大学圣保禄学院遗址。'
  },
  'hk-data.js': {
    '俯瞰维港全景。': '香港岛最高峰，海拔约552米，是俯瞰维多利亚港与九龙半岛的最佳观景台。自中环花园道乘山顶缆车登顶，沿途可观港岛楼群与南海，凌霄阁、卢吉道环山步道、狮子亭等景点云集，是香港最具辨识度的地标。',
    '世界三大夜景。': '位于香港岛与九龙半岛之间，港阔水深，是世界三大天然良港之一，两岸高楼林立、霓虹璀璨，以幻彩咏香江灯光秀与夜景闻名。星光大道、天星小轮、中环摩天轮环港而设，是香港的城市名片。'
  }
};

var total = 0;
Object.keys(PATCHES).forEach(function (f) {
  var p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log('SKIP (not found):', f); return; }
  var src = fs.readFileSync(p, 'utf8');
  var done = 0;
  Object.keys(PATCHES[f]).forEach(function (oldDesc) {
    var newDesc = PATCHES[f][oldDesc];
    var from = '"desc":"' + oldDesc + '"';
    var to = '"desc":"' + newDesc + '"';
    if (src.indexOf(from) >= 0) {
      src = src.split(from).join(to);
      done++;
    } else {
      console.log('  ✗ 未找到旧 desc:', f, '->', oldDesc);
    }
  });
  fs.writeFileSync(p, src, 'utf8');
  total += done;
  console.log('OK:', f, '补全', done, '条');
});
console.log('\n共补全', total, '条');
