// Checks the finished site before it goes live. No dependencies: runs with Node's built-in test runner.
//   node --test tests/                 (site folder defaults to ../public, or the folder this tests/ sits in)
//   SITE_DIR=path node --test tests/   (check another folder)
//   OFFLINE=1 node --test tests/       (skip the check that the installer download link really exists)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const vm = require('node:vm');

const here = path.resolve(__dirname, '..');
const SITE = path.resolve(process.env.SITE_DIR || (fs.existsSync(path.join(here, 'public', 'index.html')) ? path.join(here, 'public') : here));
const OFFLINE = !!process.env.OFFLINE;

const REQUIRED_PAGES = ['index', 'features', 'pricing', 'tutorials', 'docs', 'videos', 'download', 'contact', 'releases', 'privacy', 'terms', '404'];
const MIN_INSTALLER_BYTES = 50 * 1024 * 1024;

const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');
const exists = f => fs.existsSync(path.join(SITE, f));
const htmlFiles = fs.readdirSync(SITE).filter(f => f.endsWith('.html')).sort();
const strip = h => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
const ids = h => new Set([...h.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

function request(url, method = 'HEAD', redirects = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method, headers: { 'user-agent': 'mpxhr-site-tests' }, timeout: 20000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(request(new URL(res.headers.location, url).toString(), method, redirects - 1));
      }
      res.resume();
      resolve({ status: res.statusCode, length: parseInt(res.headers['content-length'] || '0', 10) });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

describe(`site files (${SITE})`, () => {
  for (const p of REQUIRED_PAGES) test(`page ${p}.html exists`, () => assert.ok(exists(p + '.html'), `${p}.html is missing`));
  for (const f of ['assets/site.css', 'assets/app.js', 'assets/i18n.js', 'assets/img/logo.png', 'assets/img/favicon.png', 'robots.txt'])
    test(`${f} exists`, () => assert.ok(exists(f), `${f} is missing`));

  test('app.js and i18n.js are valid JavaScript', () => {
    for (const f of ['assets/app.js', 'assets/i18n.js']) assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), `${f} has a syntax error`);
  });

  test('site.css has balanced braces and is not empty', () => {
    const css = read('assets/site.css');
    assert.ok(css.length > 5000, 'site.css looks empty');
    assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'unbalanced { } in site.css');
  });
});

describe('every page', () => {
  for (const f of htmlFiles) {
    const raw = read(f);
    const body = strip(raw);

    describe(f, () => {
      test('basic document structure', () => {
        assert.match(raw, /^\s*<!doctype html>/i, 'missing <!doctype html>');
        assert.match(raw, /<html[^>]*\slang="[a-z-]+"/i, 'missing lang on <html>');
        assert.match(raw, /<meta[^>]+name="viewport"/i, 'missing viewport meta (needed for phones)');
        assert.match(raw, /<meta[^>]+charset/i, 'missing charset');
        const title = (raw.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
        assert.ok(title.trim().length >= 3, 'empty <title>');
        assert.match(raw, /<meta[^>]+name="description"[^>]+content="[^"]{10,}/i, 'missing or too short meta description');
      });

      test('has a single h1 (the documentation page holds one per guide section)', () => {
        const n = (body.match(/<h1[\s>]/gi) || []).length;
        if (f === 'docs.html') assert.ok(n >= 1, 'docs page has no <h1>');
        else assert.equal(n, 1, 'a page needs exactly one <h1>');
      });

      test('has the shared header, main area and footer', () => {
        assert.match(raw, /<header class="hdr"/, 'header missing');
        assert.match(raw, /<main id="main"/, 'main missing');
        assert.match(raw, /<footer class="ftr"/, 'footer missing');
      });

      test('internal links and assets all exist', () => {
        const bad = [];
        for (const m of raw.matchAll(/\s(?:href|src)="([^"#][^"]*|#[^"]*)"/g)) {
          const u = m[1];
          if (/^(https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(u) || u.startsWith('#')) continue;
          const file = decodeURIComponent(u.split('#')[0].split('?')[0]);
          if (!file) continue;
          if (!exists(file)) bad.push(u);
        }
        assert.deepEqual([...new Set(bad)], [], 'broken links / missing files');
      });

      test('anchor links point to an id that exists', () => {
        const bad = [];
        for (const m of raw.matchAll(/\shref="([^"]*#[^"]+)"/g)) {
          const u = m[1];
          if (/^(https?:|mailto:|tel:|\/\/)/i.test(u)) continue;
          const [file, hash] = u.split('#');
          const target = file ? file : f;
          if (!target.endsWith('.html') || !exists(target)) continue;
          if (!ids(read(target)).has(hash)) bad.push(u);
        }
        assert.deepEqual([...new Set(bad)], [], 'links to a missing #anchor');
      });

      test('images have alt text', () => {
        const missing = [...raw.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]).filter(t => !/\salt=/.test(t));
        assert.deepEqual(missing, [], 'img without alt');
      });

      test('external links that open a new tab use rel="noopener"', () => {
        const bad = [...raw.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)].map(m => m[0]).filter(t => !/rel="[^"]*noopener/.test(t));
        assert.deepEqual(bad, []);
      });

      test('no placeholder or debug text', () => {
        const text = body.replace(/<[^>]+>/g, ' ');
        for (const bad of ['undefined', '[object Object]', 'lorem ipsum', 'TODO', 'FIXME']) assert.ok(!text.toLowerCase().includes(bad.toLowerCase()), `page text contains "${bad}"`);
      });

      test('no hard-coded colours that become invisible text (white text on white)', () => {
        assert.ok(!/style="[^"]*color:\s*(#fff|#ffffff|white)[^"]*background(-color)?:\s*(#fff|#ffffff|white)/i.test(raw), 'white text on a white background');
      });
    });
  }
});

describe('version and download', () => {
  const dl = exists('download.html') ? read('download.html') : '';
  const versionOnDownload = (dl.match(/Version (\d+\.\d+\.\d+) for/) || [])[1];

  test('download page states a version', () => assert.ok(versionOnDownload, 'could not find "Version x.y.z for ..." on download.html'));

  test('every page footer shows the same version as the download page', () => {
    const wrong = [];
    for (const f of htmlFiles) {
      const v = (read(f).match(/class="copy">[\s\S]*?v(\d+\.\d+\.\d+)/) || [])[1];
      if (v !== versionOnDownload) wrong.push(`${f}: ${v}`);
    }
    assert.deepEqual(wrong, [], `footers differ from ${versionOnDownload}`);
  });

  test('latest release note matches the version', () => {
    const first = (read('releases.html').match(/<h3>Version (\d+\.\d+\.\d+)/) || [])[1];
    assert.equal(first, versionOnDownload, 'releases.html first entry is not the current version');
  });

  const link = (dl.match(/href="(https:\/\/github\.com\/[^"]*\/releases\/download\/[^"]+)"/) || [])[1];
  test('download button points to a release asset of the same version', () => {
    assert.ok(link, 'download.html has no installer link');
    assert.ok(link.includes('v' + versionOnDownload), `link ${link} is not for v${versionOnDownload}`);
    assert.ok(link.includes(versionOnDownload + '.exe'), `link ${link} does not end with ${versionOnDownload}.exe`);
  });

  test('the installer link really exists (200, full size)', { skip: OFFLINE ? 'OFFLINE=1' : false }, async () => {
    const r = await request(link);
    assert.equal(r.status, 200, `installer link answered ${r.status}: ${link}`);
    assert.ok(r.length > MIN_INSTALLER_BYTES, `installer is only ${r.length} bytes`);
  });

  const zip = (dl.match(/href="(https:\/\/github\.com\/[^"]*\.zip)"/) || [])[1];
  test('ZIP link, if shown, really exists', { skip: (OFFLINE || !zip) ? (zip ? 'OFFLINE=1' : 'no ZIP link on the page') : false }, async () => {
    const r = await request(zip);
    assert.equal(r.status, 200, `ZIP link answered ${r.status}: ${zip}`);
  });
});

describe('translations', () => {
  test('every data-i18n key used in a page has a Hindi text', () => {
    const dict = vm.runInNewContext(read('assets/i18n.js') + ';window.__I18N', { window: {} });
    const missing = new Set();
    for (const f of htmlFiles) for (const m of read(f).matchAll(/data-i18n="([^"]+)"/g)) if (!dict[m[1]]) missing.add(m[1]);
    assert.deepEqual([...missing], [], 'keys with no Hindi text (the page would stay in English)');
  });
});
