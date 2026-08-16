/* oneLineAdd 自动等待索引就绪 */
const fs = require('fs');
let h = fs.readFileSync('node-manager.html', 'utf8');
const crlf = h.includes('\r\n');
if (crlf) h = h.replace(/\r\n/g, '\n');
const from = `  function oneLineAdd(text) {
    var finish = function (parsed) {`;
const to = `  function oneLineAdd(text) {
    var tries = 0;
    function start() {
      if (!(SITES && SITES.length)) {
        if (++tries < 6) { setTimeout(start, 1000); return; }
        tip('本地地点索引加载失败，请刷新页面后重试');
        return;
      }
      doAdd();
    }
    function doAdd() {
    var finish = function (parsed) {`;
if (h.includes(from)) {
  h = h.split(from).join(to);
  /* 收尾：doAdd 的结束括号（原 oneLineAdd 结尾） */
  const tailFrom = `      try { refreshMine(); } catch (e) {}
    };
    /* AI 优先（配置了 Key），失败降级规则 */
    var key = ''; try { key = localStorage.getItem('tn_aiKey') || ''; } catch (e) {}
    if (key && window.Ai && Ai.chat) {
      Ai.chat([
        { role: 'system', content: '你是旅行地点编辑助手。从用户一句话中提取地点信息，只输出 JSON：{"name":"景点名","province":"省","city":"市","category":"分类","desc":"30字内简介"}。分类从：古城/古镇/寺庙/博物馆/纪念馆/故居/遗址/园林/公园/自然风光/湖泊/雪山/草原/峡谷/瀑布/温泉/民俗/美食/街区/其他 中选。无法识别景点名时输出 {"name":""}。' },
        { role: 'user', content: text }
      ]).then(function (t) {
        var j = null;
        try { j = JSON.parse(t.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
        if (j && j.name) finish(j); else finish(parseOneLineRule(text));
      }).catch(function () { finish(parseOneLineRule(text)); });
    } else finish(parseOneLineRule(text));
  }`;
  const tailTo = `      try { refreshMine(); } catch (e) {}
    };
    /* AI 优先（配置了 Key），失败降级规则 */
    var key = ''; try { key = localStorage.getItem('tn_aiKey') || ''; } catch (e) {}
    if (key && window.Ai && Ai.chat) {
      Ai.chat([
        { role: 'system', content: '你是旅行地点编辑助手。从用户一句话中提取地点信息，只输出 JSON：{"name":"景点名","province":"省","city":"市","category":"分类","desc":"30字内简介"}。分类从：古城/古镇/寺庙/博物馆/纪念馆/故居/遗址/园林/公园/自然风光/湖泊/雪山/草原/峡谷/瀑布/温泉/民俗/美食/街区/其他 中选。无法识别景点名时输出 {"name":""}。' },
        { role: 'user', content: text }
      ]).then(function (t) {
        var j = null;
        try { j = JSON.parse(t.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
        if (j && j.name) finish(j); else finish(parseOneLineRule(text));
      }).catch(function () { finish(parseOneLineRule(text)); });
    } else finish(parseOneLineRule(text));
    }
    start();
  }`;
  if (h.includes(tailFrom)) {
    h = h.split(tailFrom).join(tailTo);
    fs.writeFileSync('node-manager.html', crlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
    console.log('oneLineAdd 自动等待完成');
  } else console.log('tail 未匹配');
} else console.log('head 未匹配');
