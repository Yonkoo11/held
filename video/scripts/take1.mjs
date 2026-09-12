// Take 1, the main flow on the live seller (port 4021): top of the sheet, scroll to the box, type a
// question, Pay and ask, wait for the HELD row and its clock, look at the live wire, then approve
// and wait for RELEASED with a transaction id. One continuous recording; markers (seconds since the
// recording started) go to take1.json so the cut points in Remotion are measured, not guessed.
import fs from 'node:fs';
import { launch, record, settled, sleep, smoothScrollTo, OUT } from './lib.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:4021';
const QUESTION = process.env.QUESTION || 'When does a Hedera scheduled transaction execute?';
const name = process.env.NAME || 'take1';

const { browser, page } = await launch();
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
await settled(page);
await sleep(800);

const marks = {};
const stop = await record(page, name);
const t0 = Date.now();
const mark = (k) => { marks[k] = +((Date.now() - t0) / 1000).toFixed(2); console.log(`[mark] ${k} ${marks[k]}s`); };

mark('top');
await sleep(4000);

// The ask box: bring it to a third of the way down the screen.
const dealY = await page.evaluate(() => document.querySelector('.deal').getBoundingClientRect().top + window.scrollY);
await smoothScrollTo(page, Math.max(0, dealY - 160), 1800);
mark('box');
await sleep(700);
await page.click('#q');
await sleep(400);
mark('typing');
await page.type('#q', QUESTION, { delay: 55 });
await sleep(900);
mark('pay');
await page.click('#go');

// The row appears when the seller has verified, done the work and settled into escrow.
await page.waitForFunction(() => document.querySelector('#jobs .row:first-child .state[data-s="held"]'), { timeout: 120000, polling: 250 });
mark('held');
const deliverable = await page.evaluate(() => document.querySelector('#jobs .row:first-child .deliverable')?.textContent || '');
await sleep(1200);

// Land on the row: its top a little below the project mark.
const rowY = await page.evaluate(() => document.querySelector('#jobs .row:first-child').getBoundingClientRect().top + window.scrollY);
await smoothScrollTo(page, Math.max(0, rowY - 150), 1600);
mark('row');
await sleep(6000);

// The wire at the top is live now: the pod carries the same clock.
const wireY = await page.evaluate(() => document.querySelector('.wire').getBoundingClientRect().top + window.scrollY);
await smoothScrollTo(page, Math.max(0, wireY - 330), 1800);
mark('wire');
await sleep(3500);
await smoothScrollTo(page, Math.max(0, rowY - 150), 1800);
mark('row2');
await sleep(1500);

mark('approve');
await page.click('#jobs .row:first-child button[data-act="approve"]');
await page.waitForFunction(() => document.querySelector('#jobs .row:first-child .state[data-s="released"]'), { timeout: 60000, polling: 250 });
mark('released');
// The transaction id is patched onto the job a moment later and the six-second poll repaints it.
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
