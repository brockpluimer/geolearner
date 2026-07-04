// Headless end-to-end smoke test of the running dev server using system Chrome.
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5173/';
const errors = [];
const log = (m) => console.log(m);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1200,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 900 });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text());
});

function assert(cond, msg) {
  log(`${cond ? '✓' : '✗ FAIL'} ${msg}`);
  if (!cond) process.exitCode = 1;
}

await page.goto(URL, { waitUntil: 'networkidle0' });

// --- Menu ---
await page.waitForSelector('.brand', { timeout: 10000 });
const brand = await page.$eval('.brand', (el) => el.textContent);
assert(/geolearner/i.test(brand), `menu renders brand ("${brand.trim()}")`);
const modeCards = await page.$$('.mode-card');
assert(modeCards.length === 5, `5 mode cards present (got ${modeCards.length})`);
await page.screenshot({ path: '/tmp/geo-menu.png' });

// --- Start Map → Name mode ---
await modeCards[0].click();
await page.waitForSelector('.worldmap-svg', { timeout: 5000 });
const paths = await page.$$eval('.worldmap-svg .country', (els) => els.length);
assert(paths > 150, `world map rendered ${paths} country shapes`);
const highlighted = await page.$$('.country--highlight');
assert(highlighted.length === 1, `exactly one country highlighted (got ${highlighted.length})`);
const choices = await page.$$('.choice');
assert(choices.length === 4, `4 multiple-choice options (got ${choices.length})`);
await page.screenshot({ path: '/tmp/geo-quiz-map.png' });

// --- Answer the question ---
await choices[0].click();
await page.waitForSelector('.feedback--right, .feedback--wrong', { timeout: 3000 });
const fb = (await page.$('.feedback--right')) ? 'right' : 'wrong';
assert(true, `answered a question, feedback shown (${fb})`);
const revealed = await page.$$eval('.choice--correct', (e) => e.length);
assert(revealed === 1, `correct choice revealed after answer (got ${revealed})`);

// --- Next question advances ---
const q1 = await page.$eval('.prompt-question, .prompt-big', (el) => el.textContent);
await page.click('.btn--next');
await page.waitForSelector('.worldmap-svg', { timeout: 3000 });
const progressed = await page.$eval('.quiz-progress', (el) => el.textContent);
assert(/\/10/.test(progressed), `progress indicator works ("${progressed}")`);

// --- Flag mode: go back, start flag-name, wait for flag image ---
await page.click('.link-btn'); // ← Menu
await page.waitForSelector('.mode-card');
const cards2 = await page.$$('.mode-card');
await cards2[1].click(); // Flag → Country
await page.waitForSelector('.flag--hero', { timeout: 5000 });
const flagSrc = await page.$eval('.flag--hero', (el) => el.src);
assert(/flagcdn\.com/.test(flagSrc), `flag mode loads a flag image (${flagSrc})`);
await page.screenshot({ path: '/tmp/geo-quiz-flag.png' });

// --- Spatial (find-map) mode: clicking the map answers ---
await page.click('.link-btn');
await page.waitForSelector('.mode-card');
const cards3 = await page.$$('.mode-card');
await cards3[4].click(); // Find on Map
await page.waitForSelector('.answer-map .worldmap-svg', { timeout: 5000 });
const interactivePaths = await page.$$eval('.answer-map .country', (e) => e.length);
assert(interactivePaths > 150, `spatial mode shows interactive map (${interactivePaths} shapes)`);
await page.$eval('.answer-map .country', (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
await page.waitForSelector('.feedback--right, .feedback--wrong', { timeout: 3000 });
const revealShape = await page.$$eval('.country--correct', (e) => e.length);
assert(revealShape >= 1, `spatial answer reveals correct shape on map`);

log('\n' + (errors.length ? `Console/page errors:\n  ${errors.join('\n  ')}` : 'No console/page errors 🎉'));
if (errors.length) process.exitCode = 1;

await browser.close();
