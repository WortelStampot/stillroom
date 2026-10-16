const { chromium } = require('playwright-core'); const fs=require('fs'); const {execFileSync}=require('child_process');
const PAGE = process.env.STILLROOM_PAGE || 'file://' + require('path').resolve(__dirname, '../index.html');
const failTiles = process.argv[2]==='failtiles';
function jpeg(w,h){return execFileSync('python3',['-I','-c',`
import sys,io
from PIL import Image,ImageDraw
w,h=${w},${h}
im=Image.new('RGB',(w,h),(150,90,40));d=ImageDraw.Draw(im)
for i in range(0,w,24): d.line([(i,0),(i,h)],fill=(220,190,90),width=3)
b=io.BytesIO();im.save(b,'JPEG');sys.stdout.buffer.write(b.getvalue())`]);}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--headless=new'],headless:false});
 const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
 p.on('pageerror',e=>console.log('E',e.message));
 const osd=fs.readFileSync(__dirname+'/node_modules/openseadragon/build/openseadragon/openseadragon.min.js');
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.startsWith('file:'))return r.continue();
  if(u.includes('openseadragon'))return r.fulfill({body:osd,contentType:'application/javascript'});
  if(u.includes('api.artic.edu'))return r.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({data:[{id:1,title:'x',image_id:'a',is_public_domain:true,is_zoomable:true,artwork_type_title:'Painting',thumbnail:{width:6000,height:4500}}],pagination:{total:1}})});
  if(u.includes('/iiif/')){ if(failTiles && !u.includes('/full/')) return r.fulfill({status:403,body:''});
    const m=u.match(/\/([^/]+)\/([^/]+)\/0\/default\.jpg/); let w=512,h=384;
    if(m){let rw=6000,rh=4500; if(m[1]!=='full'){const q=m[1].split(',').map(Number);rw=q[2];rh=q[3];} w=parseInt(m[2])||rw; h=Math.max(1,Math.round(rh*w/rw));}
    return r.fulfill({contentType:'image/jpeg',body:jpeg(w,h)});}
  return r.abort();});
 await p.goto(PAGE);
 await p.evaluate(()=>{try{localStorage.setItem('stillroom.v1',JSON.stringify({kept:[],seen:[],types:['painting'],hinted:true,hintedZoom:true}))}catch(e){}});
 await p.reload(); await p.waitForTimeout(failTiles?15000:3500);
 await p.screenshot({path: failTiles?'fallback.png':'home.png'});
 if(!failTiles){ await p.mouse.move(640,400); for(let i=0;i<12;i++){await p.mouse.wheel(0,-120);await p.waitForTimeout(60);} await p.waitForTimeout(2500);
  await p.screenshot({path:'zoomed.png'}); console.log('zoomed class:', await p.evaluate(()=>document.body.classList.contains('zoomed')));
  await p.keyboard.press('g'); await p.mouse.move(100,100); await p.waitForTimeout(400); await p.mouse.move(1200,700,{steps:10}); await p.waitForTimeout(1500);
  await p.screenshot({path:'glide.png'});
  await p.keyboard.press('Escape'); await p.waitForTimeout(1800); console.log('after esc zoomed:', await p.evaluate(()=>document.body.classList.contains('zoomed')));}
 console.log('status:', await p.evaluate(()=>document.getElementById('status').hidden?'(hidden)':document.getElementById('status').textContent));
 await b.close();})();
