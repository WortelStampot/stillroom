// Soak test: 40 works, some zooming, slow stand-in server. Reports concurrency, requests per work,
const PAGE = process.env.STILLROOM_PAGE || 'file://' + require('path').resolve(__dirname, '../index.html');
// time-to-appear, layers left in the viewer, and JS heap growth.
const { chromium } = require('playwright-core'); const fs = require('fs'); const { execFileSync } = require('child_process');
const W = 6000, H = 4500;
const cache = {};
function jpeg(w, h) {
  const k = w + 'x' + h; if (cache[k]) return cache[k];
  return cache[k] = execFileSync('python3', ['-I', '-c', `
import sys,io
from PIL import Image
im=Image.new('RGB',(${w},${h}),(150,90,40));b=io.BytesIO();im.save(b,'JPEG');sys.stdout.buffer.write(b.getvalue())`]);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--headless=new', '--enable-precise-memory-info', '--js-flags=--expose-gc'], headless: false });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const osd = fs.readFileSync(__dirname + '/node_modules/openseadragon/build/openseadragon/openseadragon.min.js');
  let inflight = 0, maxInflight = 0; const reqs = [];
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.includes('openseadragon')) return r.fulfill({ body: osd, contentType: 'application/javascript' });
    if (u.includes('api.artic.edu')) {
      const data = Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i + Math.floor(Math.random() * 1e6), title: 'w', image_id: 'img' + i + '_' + Math.random().toString(36).slice(2, 6), is_public_domain: true, is_zoomable: true, artwork_type_title: 'Painting', thumbnail: { width: W, height: H } }));
      return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ data, pagination: { total: 5000 } }) });
    }
    if (u.includes('/iiif/')) {
      inflight++; maxInflight = Math.max(maxInflight, inflight);
      const m = u.match(/\/iiif\/2\/([^/]+)\/([^/]+)\/([^/]+)\/0\/default\.jpg/);
      reqs.push({ t: Date.now(), id: m && m[1], region: m && m[2], size: m && m[3] });
      let w = 400, h = 300;
      if (m) { let rw = W, rh = H; if (m[2] !== 'full') { const q = m[2].split(',').map(Number); rw = q[2]; rh = q[3]; } w = parseInt(m[3]) || rw; h = Math.max(1, Math.round(rh * w / rw)); }
      const cached = m && m[2] === 'full' && (m[3] === '843,' || m[3] === '400,');
      await sleep(cached ? 150 : 700);   // uncached sizes and tiles are slower, like the real server
      inflight--;
      try { return await r.fulfill({ contentType: 'image/jpeg', body: jpeg(Math.min(w, 1700), Math.min(h, 1700)) }); } catch (e) { return; }
    }
    return r.abort();
  });
  await p.goto(PAGE);
  await p.evaluate(() => { try { localStorage.setItem('stillroom.v1', JSON.stringify({ kept: [], seen: [], types: ['painting'], hinted: true, hintedZoom: true, hintedEdges: true })); } catch (e) {} });
  await p.reload(); await sleep(2500);
  const heap = async () => p.evaluate(() => { if (window.gc) gc(); return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1; });
  const shownAt = async (t0) => { for (let i = 0; i < 100; i++) { if (await p.evaluate(() => document.getElementById('art').classList.contains('shown'))) return Date.now() - t0; await sleep(50); } return -1; };
  const heap0 = await heap(); const times = []; let stuck = 0;
  for (let i = 0; i < 40; i++) {
    const t0 = Date.now();
    await p.keyboard.press('ArrowRight');
    await sleep(30);
    const ms = await shownAt(t0); times.push(ms); if (ms < 0) stuck++;
    if (i % 5 === 2) { await p.mouse.move(700, 450); for (let k = 0; k < 14; k++) { await p.mouse.wheel(0, -120); await sleep(40); } await sleep(1500); await p.keyboard.press('Escape'); }
    await sleep(i % 7 === 0 ? 200 : 700);   // sometimes skip fast
  }
  await sleep(3000);
  const heap1 = await heap();
  const items = await p.evaluate(() => document.querySelectorAll('#art canvas').length);
  const perWork = {}; reqs.forEach(r => { perWork[r.id] = (perWork[r.id] || 0) + 1; });
  const counts = Object.values(perWork).sort((a, b) => a - b);
  console.log(JSON.stringify({
    errors: errs.slice(0, 3), stuck, maxInflight,
    msToAppear: { median: times.slice().sort((a, b) => a - b)[20], max: Math.max(...times) },
    requestsPerWork: { median: counts[Math.floor(counts.length / 2)], max: counts[counts.length - 1], works: counts.length, total: reqs.length },
    heapMB: { start: heap0, end: heap1 }
  }));
  // how many layers are in the viewer right now
  console.log('layers now:', await p.evaluate(() => { const v = document.querySelector('.openseadragon-container'); return v ? 'ok' : 'none'; }));
  await b.close();
})();
