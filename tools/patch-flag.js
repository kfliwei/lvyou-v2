/* 为 19 个缺失省份的景点数据补必去(m)/网红(h) 标注
 * 标注依据：景点知名度常识（世界遗产/5A 级必去，社媒热门网红）
 * 用法：node tools/patch-flag.js
 */
const fs = require('fs');
const path = require('path');
const dir = 'F:/MyAi/trace/lvyou-v2';

const PATCHES = {
  'ah-data.js': { '黄山': 'm', '宏村': 'm', '西递': 'm', '九华山': 'm', '天柱山': 'm', '徽杭古道': 'h', '皖南川藏线': 'h', '合柴1972': 'h' },
  'bj-data.js': { '故宫': 'm', '天安门广场': 'm', '八达岭长城': 'm', '颐和园': 'm', '天坛': 'm', '环球影城': 'h', '古北水镇': 'h', '首钢园': 'h' },
  'fj-data.js': { '鼓浪屿': 'm', '武夷山': 'm', '三坊七巷': 'm', '永定土楼': 'm', '田螺坑土楼': 'm', '湄洲岛': 'm', '平潭岛': 'h', '东山岛': 'h', '霞浦滩涂': 'h' },
  'gd-data.js': { '广州塔': 'm', '长隆野生动物世界': 'm', '丹霞山': 'm', '开平碉楼': 'm', '珠海长隆海洋王国': 'm', '世界之窗': 'm', '潮州古城': 'h', '南澳岛': 'h', '广州永庆坊': 'h' },
  'ha-data.js': { '少林寺': 'm', '龙门石窟': 'm', '云台山': 'm', '老君山': 'm', '清明上河园': 'm', '红旗渠': 'm', '只有河南': 'h', '建业电影小镇': 'h', '郭亮村': 'h' },
  'he-data.js': { '避暑山庄': 'm', '山海关': 'm', '西柏坡': 'm', '白洋淀': 'm', '金山岭长城': 'm', '草原天路': 'h', '白石山': 'h', '野三坡': 'h' },
  'hi-data.js': { '亚龙湾': 'm', '蜈支洲岛': 'm', '天涯海角': 'm', '南山文化旅游区': 'm', '呀诺达': 'm', '分界洲岛': 'm', '亚特兰蒂斯': 'h', '三亚后海村': 'h', '万宁日月湾': 'h' },
  'hk-data.js': { '维多利亚港': 'm', '太平山顶': 'm', '香港迪士尼乐园': 'm', '香港海洋公园': 'm', '天坛大佛': 'm', 'M+博物馆': 'h', '西九文化区': 'h', '兰桂坊': 'h' },
  'hlj-data.js': { '冰雪大世界': 'm', '圣索菲亚教堂': 'm', '中央大街': 'm', '雪乡': 'm', '漠河北极村': 'm', '五大连池': 'm', '亚布力滑雪场': 'm', '漠河舞厅': 'h', '伏尔加庄园': 'h', '哈尔滨大剧院': 'h' },
  'jl-data.js': { '长白山天池': 'm', '吉林雾凇': 'm', '伪满皇宫': 'm', '净月潭': 'm', '查干湖': 'm', '长白山魔界': 'h', '延吉': 'h', '中国朝鲜族民俗园': 'h' },
  'js-data.js': { '中山陵': 'm', '夫子庙': 'm', '拙政园': 'm', '瘦西湖': 'm', '灵山胜境': 'm', '周庄': 'm', '苏州博物馆': 'h', '拈花湾': 'h', '牛首山': 'h' },
  'jx-data.js': { '庐山': 'm', '三清山': 'm', '龙虎山': 'm', '婺源': 'm', '滕王阁': 'm', '井冈山': 'm', '武功山': 'h', '婺源篁岭': 'h', '景德镇陶阳里': 'h' },
  'ln-data.js': { '沈阳故宫': 'm', '老虎滩海洋公园': 'm', '金石滩': 'm', '本溪水洞': 'm', '千山': 'm', '红海滩': 'm', '大连星海广场': 'h', '发现王国': 'h', '冰峪沟': 'h' },
  'mo-data.js': { '大三巴牌坊': 'm', '澳门旅游塔': 'm', '妈阁庙': 'm', '威尼斯人': 'm', '官也街': 'h', '东望洋灯塔': 'h', '新濠影汇': 'h' },
  'sd-data.js': { '泰山': 'm', '趵突泉': 'm', '曲阜三孔': 'm', '崂山': 'm', '蓬莱阁': 'm', '刘公岛': 'm', '尼山圣境': 'h', '青州古城': 'h', '竹泉村': 'h' },
  'sh-data.js': { '外滩': 'm', '东方明珠': 'm', '豫园': 'm', '上海博物馆': 'm', '迪士尼乐园': 'm', '上海中心大厦': 'm', '武康路': 'h', '上海天文馆': 'h', '新天地': 'h' },
  'tj-data.js': { '五大道': 'm', '天津之眼': 'm', '古文化街': 'm', '盘山': 'm', '黄崖关长城': 'm', '国家海洋博物馆': 'h', '瓷房子': 'h', '滨海图书馆': 'h' },
  'tw-data.js': { '台北101': 'm', '故宫博物院': 'm', '日月潭': 'm', '阿里山': 'm', '太鲁阁': 'm', '垦丁': 'm', '九份': 'h', '十分': 'h', '高美湿地': 'h' },
  'zj-data.js': { '西湖': 'm', '灵隐寺': 'm', '千岛湖': 'm', '乌镇': 'm', '普陀山': 'm', '雁荡山': 'm', '横店影视城': 'm', '莫干山': 'h', '东极岛': 'h', '神仙居': 'h' }
};

let totalPatched = 0;
Object.keys(PATCHES).forEach(f => {
  const fp = path.join(dir, f);
  const buf = fs.readFileSync(fp);
  let txt;
  try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('gbk').decode(buf); }
  const enc = (() => { try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return 'utf8'; } catch (e) { return 'gbk'; } })();
  const table = PATCHES[f];
  let fileCount = 0;
  Object.keys(table).forEach(name => {
    const flag = table[name];
    const needle = '"name":"' + name + '"';
    const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    let n = 0;
    txt = txt.replace(re, (m, offset) => {
      // 已带 flag 则跳过
      const after = txt.slice(offset + m.length, offset + m.length + 30);
      if (/^\s*,\s*"flag"\s*:/.test(after)) return m;
      n++;
      return m + ',"flag":"' + flag + '"';
    });
    fileCount += n;
  });
  fs.writeFileSync(fp, txt, 'utf8');
  totalPatched += fileCount;
  console.log(f.padEnd(18), '+flag x' + fileCount, '(' + enc + ')');
});
console.log('共补标注:', totalPatched, '处');
