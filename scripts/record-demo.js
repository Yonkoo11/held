// Records the buyer flow as a 1920x1080 screen capture, driving a real purchase on Hedera testnet.
//
// Why Puppeteer rather than a desktop screen recorder: a desktop recorder captures whatever window
// is frontmost, and twice before it grabbed the wrong one and put an unrelated project on tape.
// This captures the page and nothing else, so there is no way for anything off-screen to leak in.
//
// The wait after "Pay and ask" is real and is left in. It is x402 verifying, the agent working, and
// settlement landing in escrow, and it is the honest length of the thing being demonstrated.
//
// Usage: node scripts/record-demo.js [url] [outfile]

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.argv[2] || 'http://localhost:4021/';
const OUT = process.argv[3] || 'video/public/video/flow.webm';
const CHROME = process.env.CHROME_PATH
  || '/Users/yonko/.cache/puppeteer/chrome/mac_arm-146.0.7680.153/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const QUESTION = process.env.DEMO_QUESTION
  || 'What is a Hedera scheduled transaction and when does it execute?';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'shell' === process.env.HEADLESS ? 'shell' : true,
    args: ['--window-size=1920,1080', '--hide-scrollbars', '--force-device-scale-factor=1'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1500);                                   // let the fonts settle before rolling

  const recorder = await page.screencast({ path: OUT, fps: 30 });
  const mark = (label) => console.log(`[rec] ${new Date().toISOString().slice(11, 19)} ${label}`);

  mark('holding on the page');
  await sleep(4000);                                   // the wire, the escrow, the resting clock

  mark('typing the question');
  await page.click('#q');
  await page.type('#q', QUESTION, { delay: 42 });      // human typing speed, not instant
  await sleep(1200);

  mark('paying');
  await page.click('#go');

  // The button reads "Settling on Hedera…" for as long as this genuinely takes.
  await page.waitForFunction(
    () => document.querySelectorAll('.row').length > 0
      && !document.getElementById('go').disabled,
    { timeout: 120000, polling: 500 },
  );
  mark('deliverable landed');
  await sleep(1200);

  mark('scrolling to the new entry');
  await page.evaluate(() => document.querySelector('.register').scrollIntoView({ behavior: 'smooth' }));
  await sleep(3500);                                   // read the answer and the clock

  const canDecide = await page.$('button[data-act="approve"]');
  if (canDecide) {
    mark('approving');
    await canDecide.click();
    await page.waitForFunction(
      () => [...document.querySelectorAll('.state')].some((e) => e.dataset.s === 'released'),
      { timeout: 90000, polling: 500 },
    );
    mark('released, transaction id on screen');
    await sleep(4000);                                 // hold on the real transaction id
  } else {
    mark('WARNING: no approve button — the claim token did not reach this browser');
    await sleep(2000);
  }

  await recorder.stop();
  await browser.close();

  const bytes = fs.statSync(OUT).size;
  console.log(`[rec] wrote ${OUT} (${(bytes / 1e6).toFixed(1)} MB)`);
}

main().catch((e) => { console.error('[rec] failed:', e.message); process.exit(1); });
