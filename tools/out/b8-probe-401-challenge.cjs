/* 一次性取证：401 带/不带 WWW-Authenticate 时 Chromium fetch 的行为差异 */
const http=require('http');
const puppeteer=require('puppeteer-core');
function mk(challenge, cb){
  const s=http.createServer(function(req,res){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','OPTIONS,GET,PUT,PROPFIND,MKCOL');
    res.setHeader('Access-Control-Allow-Headers','authorization,content-type,depth');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const h={};
    if(challenge) h['WWW-Authenticate']='Basic realm="x"';
    res.writeHead(401,h); res.end('nope');
  });
  s.listen(0,"127.0.0.1",function(){cb([s, s.address().port]);});
}
(async function(){
  const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--disable-web-security']});
  const p=await b.newPage();
  await p.goto('data:text/html,<title>probe</title>');
  for(const ch of [false,true]){
    const [s,port]=await new Promise(r=>mk(ch,r));
    const t0=Date.now();
    const out=await p.evaluate(async function(port,ch){
      try{
        const ctl=new AbortController();
        const t=setTimeout(()=>ctl.abort(),8000);
        const r=await fetch('http://127.0.0.1:'+port+'/x',{headers:{Authorization:'Basic Zm9vOmJhcg'},signal:ctl.signal});
        clearTimeout(t);
        return {status:r.status, ms:0};
      }catch(e){return {err:String(e&&e.message||e)};}
    },port,ch);
    clearTimeout();
    s.close();
    console.log('challenge='+ch+' -> '+(Date.now()-t0)+'ms  '+JSON.stringify(out));
  }
  await b.close();
  process.exit(0);
})();
