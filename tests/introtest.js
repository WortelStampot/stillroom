// The intro: one short line at a time on a fresh browser; none for someone who already saw the old key box.
const { chromium } = require('playwright-core'); const fs=require('fs'); const {execFileSync}=require('child_process');
const PAGE = process.env.STILLROOM_PAGE || 'file://' + require('path').resolve(__dirname, '../index.html');
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
  if(u.includes('api.artic.edu'))return r.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({data:[1,2,3,4,5,6,7,8].map(id=>({id,title:'x',image_id:'a',is_public_domain:true,is_zoomable:true,artwork_type_title:'Painting',thumbnail:{width:6000,height:4500}})),pagination:{total:1}})});
  if(u.includes('/iiif/')){ const m=u.match(/\/([^/]+)\/([^/]+)\/0\/default\.jpg/); let w=512,h=384;
    if(m){let rw=6000,rh=4500; if(m[1]!=='full'){const q=m[1].split(',').map(Number);rw=q[2];rh=q[3];} w=parseInt(m[2])||rw; h=Math.max(1,Math.round(rh*w/rw));}
    return r.fulfill({contentType:'image/jpeg',body:jpeg(w,h)});}
  return r.abort();});
 await p.goto(PAGE);
 await p.evaluate(()=>localStorage.clear()); await p.reload();
 const cue=()=>p.evaluate(()=>{const c=document.getElementById('cue');return c.classList.contains('on')?c.textContent:'(none)'});
 const hint=()=>p.evaluate(()=>document.getElementById('hint').hidden?'hidden':'open');
 await p.mouse.move(640,400);
 await p.waitForTimeout(800); console.log('first look, key list:', await hint(), '· line:', await cue());
 await p.waitForTimeout(3000); console.log('after a moment:', await cue());
 await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); console.log('right after →:', await cue());
 await p.waitForTimeout(3500); console.log('second work:', await cue());
 const top=()=>p.evaluate(()=>getComputedStyle(document.getElementById('top')).opacity+' · pile button '+(document.getElementById('pileBtn').classList.contains('glow')?'lit':'plain'));
 await p.keyboard.press('k'); await p.waitForTimeout(800); console.log('after K:', await cue(), '· top bar', await top());
 await p.waitForTimeout(2600); console.log('3 s later: top bar', await top());
 await p.keyboard.press('k'); await p.keyboard.press('k'); await p.waitForTimeout(800); console.log('second keep: top bar', await top());
 await p.keyboard.press('ArrowRight'); await p.waitForTimeout(4000); console.log('third work:', await cue());
 for(let i=0;i<12;i++){await p.mouse.wheel(0,-120);await p.waitForTimeout(60);} await p.waitForTimeout(1500); console.log('zoomed in:', await cue());
 await p.keyboard.press('Escape'); await p.waitForTimeout(800); console.log('after Esc:', await cue());
 await p.keyboard.press('ArrowRight'); await p.waitForTimeout(4000); console.log('fourth work:', await cue());
 await p.keyboard.press('?'); await p.waitForTimeout(300); console.log('? key list:', await hint(), '· line:', await cue());
 await p.keyboard.press('?'); await p.waitForTimeout(300); console.log('? again:', await hint());
 await p.keyboard.press('ArrowRight'); await p.waitForTimeout(4000); console.log('fifth work:', await cue());
 console.log('stored:', await p.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('stillroom.v1')).cues)));
 await p.evaluate(()=>localStorage.setItem('stillroom.v1',JSON.stringify({kept:[],seen:[],types:['painting'],hinted:true,hintedZoom:true,hintedEdges:true})));
 await p.reload(); await p.waitForTimeout(4500); console.log('someone who saw the old box:', await hint(), '· line:', await cue());
 await b.close();})();
