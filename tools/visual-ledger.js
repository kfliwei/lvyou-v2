/* ============================================================
   tools/visual-ledger.js — 像素闸门的「有账态」夹具（批次 24-F）
   只给 tools/visual-check.js 用：它 addScriptTag 注入后调 window.loadTestLedger()。

   为什么不塞进 test-data.js：那份是**产品文件**（设置页「载入示例数据」在用它，
   而且它进了离线壳 SHELL、每个 APK 都带着）。记账夹具只有闸门要，塞进去等于把
   闸门的读数口径打进手机。

   日期一律写死，不跟 Date.now() 走：visual-check 的 CLOCK 桩把「今天」钉在
   2026-10-03T10:00+08:00，夹具要是跟着真实时钟动，基线每天是一张新图。
   下面每笔钱都注明它守的是哪条分支，改数据前先读注释别删分支。
   ============================================================ */
(function () {
  /* ---------- 行程：三趟，分别落在 trip.html / me.html 的三条读数分支上 ---------- */
  function day(stops) { return { stops: stops }; }
  function stop(name, city, done) { return { name: name, city: city, done: !!done }; }
  var TRIPS = [
    /* ① 行中：计划 9-28 出发 5 天 / 实际 9-29 出发走了 6 天。
       钉在「今天是第 5 天」这一格：CLOCK 的 2026-10-03 距 logStart 恰 5 天，
       所以「按实际出发日算」+「计划里今天走这几站」两条文案同时出现；
       realDays(6) ≠ days.length(5) 才点得亮「比计划多走 1 天」那一格，别把两个数写成一样。 */
    {
      id: 'vc-cx', name: '川西小环线', startDate: '2026-09-28', logStart: '2026-09-29', realDays: 6,
      days: [
        day([stop('新南门车站', '成都', 1), stop('雅安服务区', '雅安', 1)]),
        day([stop('泸定桥', '甘孜', 1)]),
        day([stop('海螺沟冰川森林公园', '甘孜', 1), stop('磨西古镇', '甘孜', 1)]),
        day([stop('康定情歌广场', '甘孜', 1)]),
        day([stop('折多山垭口', '甘孜', 0), stop('新都桥', '甘孜', 0)])
      ]
    },
    /* ② 行前：还没出发，走「距 2026-11-14 还有 N 天」那条；计划口径（没有 logStart） */
    {
      id: 'vc-yu', name: '云南过冬', startDate: '2026-11-14',
      days: [day([stop('翠湖公园', '昆明', 0)]), day([stop('滇池海埂大坝', '昆明', 0)]), day([])]
    },
    /* ③ 没填出发日期：这一趟专门守「说不出今天是第几天」那一格 */
    { id: 'vc-xj', name: '周末周边', days: [day([stop('莫干山', '湖州', 0)])] }
  ];

  /* ---------- 账目：cents 是整数分（浮点只许在录入那一步进账本） ---------- */
  function e(id, tripId, d, date, cents, cat, who, note, ts) {
    return { id: id, tripId: tripId, day: d, date: date, cents: cents, cat: cat, who: who, note: note, ts: ts };
  }
  var EXPENSES = [
    /* vc-cx：按真实日期铺开，其中 e6 没有 date（走 startDate/logStart 反推），
       e5 是实际多走出来的第 6 天（计划表里没有这一天） */
    e('e1', 'vc-cx', 1, '2026-09-29', 52500, '交通', '我', '成都→雅安 车票', 1790000000000),
    e('e2', 'vc-cx', 2, '2026-09-30', 38800, '住宿', '我', '泸定民宿', 1790000001000),
    e('e3', 'vc-cx', 3, '2026-10-01', 12000, '门票', '同行的人', '海螺沟', 1790000002000),
    e('e4', 'vc-cx', 4, '2026-10-02', 8600, '餐饮', '', '', 1790000003000),
    e('e5', 'vc-cx', 6, '2026-10-03', 15000, '其他', '我', '计划外多走的一天', 1790000004000),
    e('e6', 'vc-cx', 2, '', 9900, '购物', '我', '没填日期的老账（靠排期反推）', 1790000005000),
    /* 行前付的定金：账挂在还没出发的行程上，日卡视图里它属于第 1 天 */
    e('e7', 'vc-yu', 1, '2026-11-14', 120000, '住宿', '我', '昆明酒店定金', 1790000006000),
    /* free 桶：完全不用规划功能的人记的两笔 */
    e('e8', 'free', 1, '2026-09-21', 4300, '餐饮', '我', '楼下面馆', 1790000007000),
    e('e9', 'free', 1, '2026-09-22', 1800, '交通', '我', '地铁充值', 1790000008000),
    /* 孤儿账：行程已经删了，钱还在。「今年合计」认它，行程列表里没有它——
       24-E 的并集逻辑（Expense.tripIds()）就是为这一笔补的，删了它那条分支就没像素覆盖 */
    e('e10', 'vc-gone', 1, '2026-08-11', 6600, '门票', '我', '已经删掉的那趟', 1790000009000),
    /* 去年的账：必须**不进**今年合计，也不出现在分类行（catTotals 不分年，直接用就错了） */
    e('e11', 'vc-gone', 1, '2025-10-01', 99999, '购物', '我', '去年的账，不该进今年', 1790000010000)
  ];

  /* 预算单独一个键（隐私数据不塞进 trip，trip 是分享载荷的来源） */
  var BUDGET = { 'vc-cx': 300000, 'vc-yu': 500000 };

  window.loadTestLedger = function () {
    try {
      /* 先把游记种子抹掉：这一态要的是「只有账、没有游记」，
         否则 me.html 的足迹读数跟着前一个状态跑没跑过 loadTestData 变，基线就成了顺序的函数。 */
      localStorage.removeItem('travelNotes');
      localStorage.setItem('tn_trips', JSON.stringify(TRIPS));
      localStorage.setItem('tn_expense', JSON.stringify(EXPENSES));
      localStorage.setItem('tn_budget', JSON.stringify(BUDGET));
      return { trips: TRIPS.length, records: EXPENSES.length };
    } catch (err) { return { err: String(err) }; }
  };

  window.clearTestLedger = function () {
    try {
      ['tn_trips', 'tn_expense', 'tn_budget'].forEach(function (k) { localStorage.removeItem(k); });
      return { ok: 1 };
    } catch (err) { return { err: String(err) }; }
  };
})();
