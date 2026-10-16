// Both museums at once: stand-ins for the Art Institute and the Rijksmuseum (search, records, image server).
const PAGE = process.env.STILLROOM_PAGE || 'file://' + require('path').resolve(__dirname, '../index.html');
// Rijksmuseum records whose id ends in 7 are "in copyright" and must never be shown; ids ending in 3, 4 or 5 have a
// small original (700 px wide) that the image server won't enlarge, so nothing wider may be asked for. Then the Art Institute
// goes down, and the Rijksmuseum alone should keep the works coming.
const { chromium } = require('playwright-core'); const fs = require('fs'); const { execFileSync } = require('child_process');
const cache = {};
const jpeg = (w, h) => cache[w + 'x' + h] || (cache[w + 'x' + h] = execFileSync('python3', ['-I', '-c', `
import sys,io
from PIL import Image
im=Image.new('RGB',(${w},${h}),(90,110,70));b=io.BytesIO();im.save(b,'JPEG');sys.stdout.buffer.write(b.getvalue())`]));
const RW = 5000, RH = 4000, SMALL = 700;
const dimsOf = img => /[345]$/.test(img) ? [SMALL, 900] : [RW, RH];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--headless=new'], headless: false });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const osd = fs.readFileSync(__dirname + '/node_modules/openseadragon/build/openseadragon/openseadragon.min.js');
  let aicDown = false; const asked = { search: [], record: 0, info: 0, tile: 0, image: 0, refused: [] };
  const cors = { 'access-control-allow-origin': '*' };
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.includes('openseadragon')) return r.fulfill({ body: osd, contentType: 'application/javascript' });
    if (u.includes('api.artic.edu')) {
      if (aicDown) return r.abort();
      const data = Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i + Math.floor(Math.random() * 1e6), title: 'aic', image_id: 'aic' + i, is_public_domain: true, is_zoomable: true, artwork_type_title: 'Painting', thumbnail: { width: 3000, height: 2000 } }));
      return r.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ data, pagination: { total: 5000 } }) });
    }
    if (u.includes('/iiif/2/')) return r.fulfill({ contentType: 'image/jpeg', body: jpeg(843, 562) });
    if (u.startsWith('https://data.rijksmuseum.nl/search/collection')) {
      asked.search.push(new URL(u).searchParams);
      const base = 2000000 + Math.floor(Math.random() * 9e6);
      const orderedItems = Array.from({ length: 100 }, (_, i) => ({ id: 'https://id.rijksmuseum.nl/' + (base + i), type: 'HumanMadeObject' }));
      return r.fulfill({ headers: cors, contentType: 'application/ld+json', body: JSON.stringify({ type: 'OrderedCollectionPage', orderedItems }) });
    }
    if (u.startsWith('https://data.rijksmuseum.nl/')) {
      asked.record++;
      const n = new URL(u).pathname.slice(1), img = 'MK' + n;
      const rec = {
        id: `https://id.rijksmuseum.nl/${n}#aggregation`, type: 'Aggregation',
        edmRights: n.endsWith('7') ? 'http://rightsstatements.org/vocab/InC/1.0/' : 'http://creativecommons.org/publicdomain/mark/1.0/',
        isShownAt: { id: `https://www.rijksmuseum.nl/nl/collectie/object/SK-A-${n}--abc` },
        isShownBy: { id: `https://iiif.micr.io/${img}/full/max/0/default.jpg`, 'http://rdfs.org/sioc/services#has_service': { id: `https://iiif.micr.io/${img}` } },
        aggregatedCHO: {
          title: { en: ['Rijks ' + n], nl: ['Rijks ' + n] }, identifier: ['SK-A-' + n],
          created: [{ '@language': 'nl', '@value': 'ca. 1650' }, { '@language': 'en', '@value': 'c. 1650' }],
          creator: [{ 'http://www.w3.org/2004/02/skos/core#prefLabel': { '@language': 'nl', '@value': 'Jan Steen' } }],
          medium: [{ 'http://www.w3.org/2004/02/skos/core#prefLabel': [{ '@language': 'en', '@value': 'oil paint (paint)' }, { '@language': 'nl', '@value': 'olieverf' }] }],
          extent: [{ '@language': 'nl', '@value': 'hoogte 50 cm' }, { '@language': 'en', '@value': 'height 50 cm' }]
        }
      };
      await sleep(150);
      return r.fulfill({ headers: cors, contentType: 'application/ld+json', body: JSON.stringify(rec) });
    }
    if (u.startsWith('https://iiif.micr.io/')) {
      const m = u.match(/micr\.io\/([^/]+)\/(.*)$/);
      if (m[2] === 'info.json') {
        asked.info++;
        return r.fulfill({ headers: cors, contentType: 'application/ld+json', body: JSON.stringify({ '@context': 'http://iiif.io/api/image/3/context.json', id: 'https://iiif.micr.io/' + m[1], type: 'ImageService3', protocol: 'http://iiif.io/api/image', profile: 'level2', width: dimsOf(m[1])[0], height: dimsOf(m[1])[1], tiles: [{ width: 1024, height: 1024, scaleFactors: [1, 2, 4, 8] }] }) });
      }
      const [region, size] = m[2].split('/');
      if (region === 'full') asked.image++; else asked.tile++;
      if (region === 'full' && parseInt(size) > dimsOf(m[1])[0]) { asked.refused.push(m[1] + ' ' + size); return r.fulfill({ headers: cors, status: 400, body: 'upscaling not allowed' }); }
      let w = parseInt(size) || 1024; w = Math.min(w, 1700);
      return r.fulfill({ headers: cors, contentType: 'image/jpeg', body: jpeg(w, Math.round(w * 0.8)) });
    }
    return r.abort();
  });
  await p.goto(PAGE);
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem('stillroom.v1', JSON.stringify({ kept: [], seen: [], types: ['painting'], hinted: true, hintedZoom: true, hintedEdges: true })); } catch (e) {} });
  await p.reload(); await sleep(2500);
  const lines = async () => { await sleep(1100); return p.evaluate(() => JSON.parse(localStorage.getItem('stillroom.v1.log') || '[]')); };
  const lastWork = async () => (await lines()).filter(l => l.includes('  WORK ')).pop() || '';
  const shown = () => p.evaluate(() => document.getElementById('art').classList.contains('shown'));

  // step through 20 works; look at the label and zoom in on the first Rijksmuseum one, and keep it
  let label = '', kept = false, zoomed = false;
  for (let i = 0; i < 20; i++) {
    if (i) { await p.keyboard.press('ArrowRight'); await sleep(700); }
    const w = await lastWork();
    if (!kept && w.includes('Rijksmuseum')) {
      await p.keyboard.press('i'); await sleep(200);
      label = await p.evaluate(() => document.getElementById('label').innerText.replace(/\n/g, ' | ') + ' → ' + document.querySelector('#label a').href);
      await p.keyboard.press('i');
      await p.keyboard.press('k'); kept = true;
      await p.mouse.move(640, 400); for (let k = 0; k < 14; k++) { await p.mouse.wheel(0, -120); await sleep(40); }
      await sleep(1500); zoomed = asked.tile > 0; await p.keyboard.press('Escape'); await sleep(300);
    }
  }
  const log1 = await lines();
  const works = log1.filter(l => l.includes('  WORK '));
  const rk = works.filter(l => l.includes('Rijksmuseum'));
  const inc = rk.filter(l => /WORK rijks:\d*7 /.test(l));
  console.log('works:', works.length, '· from the Rijksmuseum:', rk.length, '· in-copyright ones shown:', inc.length);
  console.log('label:', label);
  console.log('zoom on a Rijksmuseum work loaded tiles:', zoomed, JSON.stringify({ info: asked.info, tiles: asked.tile }));
  const small = rk.filter(l => /WORK rijks:\d*[345] /.test(l));
  console.log('small originals shown:', small.length, '·', (small[0] || '').slice(14, 100), '· requests refused for being too wide:', asked.refused.length);
  console.log('search asks:', asked.search.slice(0, 3).map(s => `type=${s.get('type')} imageAvailable=${s.get('imageAvailable')} token=${(s.get('pageToken') || '').slice(0, 12)}…`).join(' | '));
  console.log('Rijksmuseum searches / records looked up:', asked.search.length, '/', asked.record);

  // the pile: the kept Rijksmuseum work keeps its source, link and a thumbnail
  await p.keyboard.press('p'); await sleep(1200);
  const pile = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('stillroom.v1'));
    const img = document.querySelector('#grid img');
    return { kept: s.kept.map(k => `${k.id} ${k.src} ${k.iiif} ${k.link}`), thumbLoaded: !!(img && img.complete && img.naturalWidth), cardLink: document.querySelector('#grid a') && document.querySelector('#grid a').href };
  });
  console.log('pile:', JSON.stringify(pile));
  await p.keyboard.press('Escape');

  // Art Institute down: works should keep coming from the Rijksmuseum alone
  aicDown = true;
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('stillroom.v1')); s.seen = []; localStorage.setItem('stillroom.v1', JSON.stringify(s)); });
  await p.reload(); await sleep(3000);
  let ok = 0;
  for (let i = 0; i < 6; i++) { if (i) { await p.keyboard.press('ArrowRight'); await sleep(900); } if (await shown()) ok++; }
  const status = await p.evaluate(() => document.getElementById('status').hidden ? '' : document.getElementById('status').textContent);
  console.log('Art Institute down: shown', ok, 'of 6 · status:', status || '(none)', '· last:', (await lastWork()).slice(14, 70));
  console.log('errors:', JSON.stringify(errs.slice(0, 3)));
  await b.close();
})();
