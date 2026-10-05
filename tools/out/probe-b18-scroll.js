/* 批次18-G：1440 左栏 #list 是不是滚动容器 + 最后一张卡能否滚出统计条 */
const puppeteer=require('puppeteer-core'),path=require('path'),{pathToFileURL}=require('url');
const R=path.join(__dirname,'..','..');
(async()=>{
 const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--no-sandbox','--disable-gpu']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900});
 await p.goto(pathToFileURL(path.join(R,'topic.html')).href+'?p=sx',{waitUntil:'networkidle2'});
 await new Promise(r=>setTimeout(r,3500));
 const g=await p.evaluate(`(()=>{
  const list=document.getElementById('list'),grid=document.getElementById('grid');
  const st=document.querySelector('.region-stats'),tb=document.querySelector('.tabbar');
  const last=grid.lastElementChild;
  const before=last.getBoundingClientRect();
  list.scrollTop=list.scrollHeight;
  const after=last.getBoundingClientRect();
  return {scroller:list, sh:list.scrollHeight, ch:list.clientHeight, stH:st&&st.clientHeight,
   overflow:getComputedStyle(list).overflowY,
   lastTag:last.tagName, lastCls:last.className,
   beforeBottom:Math.round(before.bottom), afterBottom:Math.round(after.bottom),
   statsTop:st&&Math.round(st.getBoundingClientRect().top), tabTop:tb&&Math.round(tb.getBoundingClientRect().top),
   padBottom:getComputedStyle(list).paddingBottom, listBottom:Math.round(list.getBoundingClientRect().bottom)};
 })()`);
 console.log(JSON.stringify(g,null,1));
 await b.close();
})();
