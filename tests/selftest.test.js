// Proves the site tests actually catch problems: copies the site, breaks one thing at a time and checks that site.test.js fails.
//   node --test tests/selftest.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const here = path.resolve(__dirname, '..');
const SITE = path.resolve(process.env.SITE_DIR || (fs.existsSync(path.join(here, 'public', 'index.html')) ? path.join(here, 'public') : here));
const SUITE = path.join(__dirname, 'site.test.js');

function runOn(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpxsite-'));
  try {
    fs.cpSync(SITE, dir, { recursive: true, filter: s => !/[\\/](tests|\.github|\.git|node_modules)([\\/]|$)/.test(s.slice(SITE.length)) });
    mutate(dir);
    // NODE_TEST_CONTEXT is set by the outer test runner; left in place it would make the inner run report nothing
    const env = { ...process.env, SITE_DIR: dir, OFFLINE: '1' };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, ['--test', SUITE], { env, encoding: 'utf8' });
    return r.status;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const edit = (dir, f, fn) => { const p = path.join(dir, f); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };

test('an untouched copy of the site passes (baseline)', () => assert.equal(runOn(() => { }), 0));

const BREAKS = {
  'a missing stylesheet': d => fs.rmSync(path.join(d, 'assets/site.css')),
  'a broken internal link': d => edit(d, 'index.html', h => h.replace('href="pricing.html"', 'href="no-such-page.html"')),
  'a missing image': d => edit(d, 'index.html', h => h.replace('assets/img/hero.webp', 'assets/img/gone.webp')),
  'a footer showing another version': d => edit(d, 'index.html', h => h.replace(/(class="copy">[\s\S]*?v)\d+\.\d+\.\d+/, '$19.9.9')),
  'a download link for another version': d => edit(d, 'download.html', h => h.replace(/\/download\/v\d+\.\d+\.\d+\//, '/download/v1.0.0/')),
  'a page without the viewport tag': d => edit(d, 'contact.html', h => h.replace(/<meta name="viewport"[^>]*>/, '')),
  'a page without a title': d => edit(d, 'features.html', h => h.replace(/<title>[\s\S]*?<\/title>/, '<title></title>')),
  'two h1 headings': d => edit(d, 'pricing.html', h => h.replace('</main>', '<h1>Extra</h1></main>')),
  'a syntax error in app.js': d => edit(d, 'assets/app.js', j => j + '\n}}}'),
  'an image without alt text': d => edit(d, 'features.html', h => h.replace('</main>', '<img src="assets/img/logo.png"></main>')),
  'a missing page': d => fs.rmSync(path.join(d, 'terms.html')),
  'debug text left on a page': d => edit(d, 'privacy.html', h => h.replace('</main>', '<p>undefined</p></main>'))
};

for (const [name, mutate] of Object.entries(BREAKS)) {
  test(`the tests fail on ${name}`, () => assert.notEqual(runOn(mutate), 0, `site.test.js did not notice: ${name}`));
}
