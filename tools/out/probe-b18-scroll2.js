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
  list.scrollTop=list.scrollHeight;
  const last=grid.lastElementChild, lr=list.getBoundingClientRect(), gr=grid.getBoundingClientRect(), br=last.getBoundingClientRect();
  const cs=getComputedStyle(last);
  return {n:grid.children.length, scrollTop:list.scrollTop, sh:list.scrollHeight,
   listTop:Math.round(lr.top), listBottom:Math.round(lr.bottom),
   gridBottom:Math.round(gr.bottom), lastBottom:Math.round(br.bottom), lastTop:Math.round(br.top),
   lastMB:cs.marginBottom, lastH:Math.round(br.height),
   padList:getComputedStyle(list).paddingBottom, padGrid:getComputedStyle(grid).paddingBottom,
   gridGap:getComputedStyle(grid).rowGap,
   statsTop:Math.round(document.querySelector('.region-stats').getBoundingClientRect().top),
   tabTop:Math.round(document.querySelector('.tabbar').getBoundingClientRect().top)};
 })()`);
 console.log(JSON.stringify(g));
 await b.close();
})();
