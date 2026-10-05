/* 批次18-G：1440 左栏三条带（list / region-stats / tabbar）的实测几何 */
const puppeteer=require('puppeteer-core'),path=require('path'),{pathToFileURL}=require('url');
const R=path.join(__dirname,'..','..');
(async()=>{
 const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--no-sandbox','--disable-gpu']});
 for(const W of [1440,1024,900]){
  const p=await b.newPage();
  await p.setViewport({width:W,height:900});
  await p.goto(pathToFileURL(path.join(R,'topic.html')).href,{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,2500));
  const g=await p.evaluate(()=>{
   const q=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(innerHeight-r.bottom)};};
   const cs=getComputedStyle(document.querySelector('#list'));
   return{list:q('#list'),stats:q('.region-stats'),tab:q('.tabbar'),banner:q('#routeBanner'),
    listPad:cs.paddingBottom,map:q('#map'),view:document.body.dataset.view};});
  console.log(W,JSON.stringify(g));
  await p.close();
 }
 await b.close();
})();
