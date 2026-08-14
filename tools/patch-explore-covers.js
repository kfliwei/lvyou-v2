/* 一次性：explore-map.html 文字章卡片 → img+字（与 8 张原图卡片统一） */
const fs = require('fs');
const fp = 'F:/MyAi/trace/lvyou-v2/explore-map.html';
let txt = fs.readFileSync(fp, 'utf8');
const MAP = { '青': 'qh', '藏': 'xz', '蒙': 'nmg', '秦': 'sx2', '渝': 'cq', '宁': 'nx', '京': 'bj', '津': 'tj', '鲁': 'sd', '辽': 'ln', '吉': 'jl', '黑': 'hlj', '冀': 'he', '豫': 'ha', '沪': 'sh', '苏': 'js', '浙': 'zj', '皖': 'ah', '闽': 'fj', '赣': 'jx', '粤': 'gd', '琼': 'hi', '港': 'hk', '澳': 'mo', '台': 'tw' };
let count = 0;
txt = txt.replace(/(<span class="story-item__stamp" style="box-shadow:inset 0 0 0 1\.5px[^"]*">)(<span>)([^<]+)(<\/span>)(<\/span>)/g, (m, pre, _o, ch, _c, post) => {
  const f = MAP[ch.trim()];
  if (!f) return m;
  count++;
  return pre + '<img src="art/topic-' + f + '.svg" alt=""><span>' + ch.trim() + '</span>' + post;
});
// 兜底：直接文本形式
txt = txt.replace(/(<span class="story-item__stamp" style="box-shadow:inset 0 0 0 1\.5px[^"]*">)([^<]+)(<\/span>)/g, (m, pre, ch, post) => {
  const f = MAP[ch.trim()];
  if (!f) return m;
  count++;
  return pre + '<img src="art/topic-' + f + '.svg" alt=""><span>' + ch.trim() + '</span>' + post;
});
fs.writeFileSync(fp, txt, 'utf8');
console.log('替换卡片:', count);
