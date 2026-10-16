// The session log survives closing the tab: two sessions, then D saves both; a second D saves only what came after.
const PAGE = process.env.STILLROOM_PAGE || 'file://' + require('path').resolve(__dirname, '../index.html');
const { chromium } = require('playwright-core'); const fs = require('fs'); const { execFileSync } = require('child_process');
const jpg = execFileSync('python3', ['-I', '-c', `
import sys,io
from PIL import Image
im=Image.new('RGB',(843,562),(120,140,160));b=io.BytesIO();im.save(b,'JPEG');sys.stdout.buffer.write(b.getvalue())`]);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--headless=new'], headless: false });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const osd = fs.readFileSync(__dirname + '/node_modules/openseadragon/build/openseadragon/openseadragon.min.js');
  await ctx.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.includes('openseadragon')) return r.fulfill({ body: osd, contentType: 'application/javascript' });
    if (u.includes('api.artic.edu')) {
      const data = [0, 1, 2, 3].map(i => ({ id: 200 + i, title: 'w' + i, image_id: 'w' + i, is_public_domain: true, is_zoomable: true, artwork_type_title: 'Painting', thumbnail: { width: 3000, height: 2000 } }));
      return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ data, pagination: { total: 4 } }) });
    }
    if (u.includes('/iiif/')) return r.fulfill({ contentType: 'image/jpeg', body: jpg });
    return r.abort();
  });
  const save = async p => {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.keyboard.press('d')]);
    const path = __dirname + '/' + dl.suggestedFilename(); await dl.saveAs(path);
    const text = fs.readFileSync(path, 'utf8'); fs.unlinkSync(path); return text;
  };
  const count = (t, s) => t.split('\n').filter(l => l.includes(s)).length;
  const results = [];
  const check = (what, ok) => { results.push(ok); console.log(ok ? 'ok  ' : 'FAIL', what); };

  // session 1: two works, then close the tab without pressing D
  let p = await ctx.newPage();
  await p.goto(PAGE);
  await p.evaluate(() => localStorage.setItem('stillroom.v1', JSON.stringify({ kept: [], seen: [], types: ['painting'], hinted: true, hintedZoom: true, hintedEdges: true })));
  await p.waitForTimeout(1500); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1500);
  await p.close({ runBeforeUnload: true });

  // session 2: one work, then D
  p = await ctx.newPage();
  await p.goto(PAGE); await p.waitForTimeout(1500);
  const first = await save(p);
  check('first save holds both sessions', count(first, '  session start · ') === 2);
  check('first save holds works from both sessions', count(first, 'WORK ') >= 3);
  check('session lines carry the date', /session start · \d{4}-\d\d-\d\d · /.test(first));
  const toast = await p.evaluate(() => document.body.innerText);
  check('toast counts the sessions', toast.includes('Log saved (2 sessions)'));

  // still in session 2: one more work, close, reopen, D again
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1500);
  await p.close({ runBeforeUnload: true });
  p = await ctx.newPage(); await p.goto(PAGE); await p.waitForTimeout(1500);
  const second = await save(p);
  check('second save starts where the first left off', second.split('\n')[0].includes('session continues · '));
  const firstLines = new Set(first.split('\n').filter(Boolean));
  check('second save repeats nothing from the first', second.split('\n').filter(Boolean).every(l => !firstLines.has(l)));
  check('second save holds the new session', count(second, '  session start · ') === 1);

  console.log('\n--- second save ---\n' + second);
  await b.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
