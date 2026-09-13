// Take 2, the deadline, on the second seller (90-second review window). Buy, wait for the HELD row,
// then keep recording while the countdown runs out and the row flips to RELEASED on its own.
// Markers go to take2.json; Remotion uses only the tail of the countdown plus the flip.
import fs from 'node:fs';
import { launch, record, settled, sleep, smoothScrollTo, OUT } from './lib.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:4098';   // a second seller with a short review window
const QUESTION = process.env.QUESTION || 'Can a Hedera scheduled transaction be cancelled before it executes?';
const name = process.env.NAME || 'take2';
const ROW = '#jobs .row:first-child';

const { browser, page } = await launch();
await page.goto(`${BASE}/ask`, { waitUntil: 'networkidle0' });   // the buy lives on /ask since the rebuild
await settled(page);
await sleep(800);

const marks = {};
const stop = await record(page, name);
const t0 = Date.now();
const mark = (k) => { marks[k] = +((Date.now() - t0) / 1000).toFixed(2); console.log(`[mark] ${k} ${marks[k]}s`); };

mark('top');
await sleep(1000);
const dealY = await page.evaluate(() => document.querySelector('.box').getBoundingClientRect().top + window.scrollY);
await smoothScrollTo(page, Math.max(0, dealY - 180), 1500);
await page.click('#q');
await page.type('#q', QUESTION, { delay: 45 });
await sleep(600);
mark('pay');
await page.click('#go');
await page.waitForFunction((r) => document.querySelector(`${r} .state[data-s="held"]`), { timeout: 120000, polling: 250 }, ROW);
mark('held');
await sleep(800);
const rowY = await page.evaluate((r) => document.querySelector(r).getBoundingClientRect().top + window.scrollY, ROW);
await smoothScrollTo(page, Math.max(0, rowY - 150), 1500);
mark('row');

// Log the clock every 10 s so the JSON says where the last 12 s of the countdown are.
const clockLog = [];
const timer = setInterval(async () => {
  const t = await page.evaluate((r) => document.querySelector(`${r} .clock .t`)?.textContent || '', ROW).catch(() => '');
  clockLog.push({ at: +((Date.now() - t0) / 1000).toFixed(1), t });
}, 5000);
// "releasing" is what the page shows once the deadline has passed and the schedule has not yet been seen executing.
await page.waitForFunction((r) => (document.querySelector(`${r} .clock .t`)?.textContent || '') === 'releasing', { timeout: 180000, polling: 250 }, ROW);
mark('zero');
await page.waitForFunction((r) => document.querySelector(`${r} .state[data-s="released"]`), { timeout: 120000, polling: 250 }, ROW);
mark('released');
clearInterval(timer);
await page.waitForFunction((r) => /0\.0\.\d+[@-]\d+/.test(document.querySelector(`${r} .outcome`)?.textContent || ''), { timeout: 45000, polling: 250 }, ROW).catch(() => console.log('[warn] no tx id in the outcome line'));
mark('txid');
const outcome = await page.evaluate((r) => document.querySelector(`${r} .outcome`)?.textContent || '', ROW);
const byline = await page.evaluate((r) => document.querySelector(`${r} .byline`)?.textContent || '', ROW);
await sleep(6000);
mark('end');
await stop();
fs.writeFileSync(`${OUT}${name}.json`, JSON.stringify({ marks, question: QUESTION, byline, outcome, clockLog }, null, 2));
console.log(JSON.stringify({ byline, outcome }));
await browser.close();
