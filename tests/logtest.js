// Work 1: small original (600px wide); server refuses any request wider than that, like real IIIF.
const PAGE = process.env.STILLROOM_PAGE || 'file://' + require('path').resolve(__dirname, '../index.html');
// Work 2: always fails. Work 3: normal.
const { chromium } = require('playwright-core'); const fs = require('fs'); const { execFileSync } = require('child_process');
const img = (w, h) => execFileSync('python3', ['-I', '-c', `
import sys,io
from PIL import Image
im=Image.new('RGB',(${w},${h}),(120,140,160));b=io.BytesIO();im.save(b,'JPEG');sys.stdout.buffer.write(b.getvalue())`]);
const dims = { small: [600, 800], broken: [3000, 2000], fine: [3000, 2000] };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--headless=new'], headless: false });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })).newPage();
  p.on('pageerror', e => console.log('pageerror', e.message));
  const osd = fs.readFileSync(__dirname + '/node_modules/openseadragon/build/openseadragon/openseadragon.min.js');
  const asked = [];
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.includes('openseadragon')) return r.fulfill({ body: osd, contentType: 'application/javascript' });
    if (u.includes('api.artic.edu')) {
      const data = ['small', 'broken', 'fine'].map((k, i) => ({ id: 100 + i, title: k, image_id: k, is_public_domain: true, is_zoomable: true, artwork_type_title: 'Painting', thumbnail: { width: dims[k][0], height: dims[k][1] } }));
      return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ data, pagination: { total: 3 } }) });
    }
    if (u.includes('/iiif/')) {
      const m = u.match(/\/iiif\/2\/([^/]+)\/([^/]+)\/([^/]+)\/0\/default\.jpg/); asked.push(m[1] + ' ' + m[3]);
      const [W, H] = dims[m[1]];
      if (m[1] === 'broken') return r.fulfill({ status: 500, body: '' });
      const w = m[3] === 'full' ? W : parseInt(m[3]);
      if (w > W) return r.fulfill({ status: 400, body: 'upscaling not allowed' });
      return r.fulfill({ contentType: 'image/jpeg', body: img(w, Math.round(H * w / W)) });
    }
    return r.abort();
  });
  await p.goto(PAGE);
  await p.evaluate(() => { try { localStorage.setItem('stillroom.v1', JSON.stringify({ kept: [], seen: [], types: ['painting'], hinted: true, hintedZoom: true, hintedEdges: true })); } catch (e) {} });
  await p.reload();
  // the queue is shuffled, so step through until all three have been tried
  const seen = [];
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(i === 0 ? 2500 : 1200);
    const s = await p.evaluate(() => ({
      shown: document.getElementById('art').classList.contains('shown'),
      status: document.getElementById('status').hidden ? '' : document.getElementById('status').textContent,
      osdMsgVisible: [...document.querySelectorAll('.openseadragon-message')].some(e => e.offsetParent !== null)
    }));
    seen.push(s);
  }
  // wait out a failure, if one is pending
  await p.waitForTimeout(7000);
  seen.push(await p.evaluate(() => ({ shown: document.getElementById('art').classList.contains('shown'), status: document.getElementById('status').hidden ? '' : document.getElementById('status').textContent })));
  await p.mouse.move(640, 400); for (let k = 0; k < 14; k++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(40); }
  await p.waitForTimeout(2500);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.keyboard.press('d')]);
  const path = __dirname + '/' + dl.suggestedFilename(); await dl.saveAs(path);
  console.log('saved as', dl.suggestedFilename()); console.log(require('fs').readFileSync(path, 'utf8'));
  await b.close();
})();
