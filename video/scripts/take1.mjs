// Take 1, the main flow. The site is seven surfaces now, so the buy lives on /ask and the wire on /.
// One continuous recording; markers (seconds since the recording started) go to take1.json and every
// cut point in Remotion is derived from them, so the scene code needs no edits after a re-film.
//
// The narration for scene 4 says "The wire up top shows the same clock", so this navigates to / at
// the wire mark to show it carrying the same live countdown, then comes back to decide.
import fs from 'node:fs';
import { launch, record, settled, sleep, smoothScrollTo, OUT } from './lib.mjs';

const BASE = process.env.BASE || 'https://heldprotocol.xyz';
const QUESTION = process.env.QUESTION || 'When does a Hedera scheduled transaction execute?';
const name = process.env.NAME || 'take1';

const { browser, page } = await launch();
await page.goto(`${BASE}/ask`, { waitUntil: 'networkidle0' });
await settled(page);
await sleep(900);

const marks = {};
const stop = await record(page, name);
const t0 = Date.now();
const mark = (k) => { marks[k] = +((Date.now() - t0) / 1000).toFixed(2); console.log(`[mark] ${k} ${marks[k]}s`); };

mark('top');
await sleep(3600);                                   // the figures band: price, window, escrow account

// The ask box now sits inside the band, under the rail.
const boxY = await page.evaluate(() => document.querySelector('.box').getBoundingClientRect().top + window.scrollY);
await smoothScrollTo(page, Math.max(0, boxY - 180), 1700);
mark('box');
await sleep(700);
await page.click('#q');
await sleep(400);
mark('typing');
await page.type('#q', QUESTION, { delay: 55 });
await sleep(900);
mark('pay');
await page.click('#go');

// Appears once the seller has verified the payment, done the work and settled into escrow.
await page.waitForFunction(() => document.querySelector('#jobs .row:first-child .state[data-s="held"]'), { timeout: 150000, polling: 250 });
mark('held');
const deliverable = await page.evaluate(() => document.querySelector('#jobs .row:first-child .deliverable')?.textContent || '');
await sleep(1200);

const rowY = await page.evaluate(() => document.querySelector('#jobs .row:first-child').getBoundingClientRect().top + window.scrollY);
await smoothScrollTo(page, Math.max(0, rowY - 150), 1600);
mark('row');
await sleep(5200);

// "The wire up top shows the same clock." It is on / now, so go and look at it. The countdown there
// is driven by the same held deadline this job just created.
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await sleep(2600);
const wireY = await page.evaluate(() => document.querySelector('.wire').getBoundingClientRect().top + window.scrollY);
await smoothScrollTo(page, Math.max(0, wireY - 300), 1400);
mark('wire');
await sleep(3600);

await page.goto(`${BASE}/ask`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('#jobs .row:first-child .state'), { timeout: 30000, polling: 200 });
await sleep(900);
const rowY2 = await page.evaluate(() => document.querySelector('#jobs .row:first-child').getBoundingClientRect().top + window.scrollY);
await smoothScrollTo(page, Math.max(0, rowY2 - 150), 1200);
mark('row2');
await sleep(1600);

mark('approve');
await page.click('#jobs .row:first-child button[data-act="approve"]');
await page.waitForFunction(() => document.querySelector('#jobs .row:first-child .state[data-s="released"]'), { timeout: 90000, polling: 250 });
mark('released');
await page.waitForFunction(() => /0\.0\.\d+[@-]\d+/.test(document.querySelector('#jobs .row:first-child .outcome')?.textContent || ''), { timeout: 45000, polling: 250 }).catch(() => console.log('[warn] no tx id appeared in the outcome line'));
mark('txid');
const outcome = await page.evaluate(() => document.querySelector('#jobs .row:first-child .outcome')?.textContent || '');
const byline = await page.evaluate(() => document.querySelector('#jobs .row:first-child .byline')?.textContent || '');
await sleep(5000);
mark('end');

await stop();
fs.writeFileSync(`${OUT}${name}.json`, JSON.stringify({ marks, question: QUESTION, byline, outcome, deliverableHead: deliverable.slice(0, 160) }, null, 2));
console.log(JSON.stringify({ byline, outcome, deliverableHead: deliverable.slice(0, 120) }));
await browser.close();
