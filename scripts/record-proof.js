// Records the public-ledger proof: the escrow account on HashScan, then the consensus topic that
// carries the evidence trail. This is the part of the demo that does not ask anyone to trust the
// service, so it is captured from the public explorer rather than from our own UI.
//
// Usage: node scripts/record-proof.js

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'video/public/video/proof.webm';
const CHROME = process.env.CHROME_PATH
  || '/Users/yonko/.cache/puppeteer/chrome/mac_arm-146.0.7680.153/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const ESCROW = process.env.HEDERA_ESCROW_ID || '0.0.10495061';
const TOPIC = process.env.EVIDENCE_TOPIC || '0.0.10495064';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--window-size=1920,1080', '--hide-scrollbars', '--force-device-scale-factor=1'],
    defaultViewport: { width: 1920, height: 1080 },
  });
  const page = await browser.newPage();

  // Load the first page before rolling so the recording never opens on a spinner.
  await page.goto(`https://hashscan.io/testnet/account/${ESCROW}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(4000);

  // HashScan puts a cookie consent modal over the whole page on a first visit, and it dims
  // everything behind it. Dismissed before rolling, or the proof shot is a picture of a dialog.
  const dismissed = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => /^(reject|accept)$/i.test((b.textContent || '').trim()));
    if (btn) { btn.click(); return btn.textContent.trim(); }
    return null;
  });
  console.log(dismissed ? `[proof] cookie dialog dismissed via "${dismissed}"` : '[proof] no cookie dialog');
  await sleep(2500);

  // Click a tab by its visible label. HashScan renders tabs as buttons, not links.
  const tab = async (label) => {
    const hit = await page.evaluate((l) => {
      const el = [...document.querySelectorAll('button, a, [role="tab"]')]
        .find((b) => (b.textContent || '').trim().toLowerCase() === l.toLowerCase());
      if (el) { el.click(); return true; }
      return false;
    }, label);
    console.log(`[proof] ${hit ? 'opened' : 'could not find'} the ${label} tab`);
    return hit;
  };

  const rec = await page.screencast({ path: OUT, fps: 30 });

  // Shot 1: every payment into and out of escrow, on the public explorer.
  console.log('[proof] escrow account, transactions');
  await tab('Transactions');
  await sleep(8000);

  // Shot 2: the evidence trail itself. The Messages tab is the substance; Summary is just metadata,
  // and its memo still carries the pre-rename name because a topic memo is written once, on chain.
  console.log('[proof] evidence topic, messages');
  await page.goto(`https://hashscan.io/testnet/topic/${TOPIC}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3500);
  await tab('Messages');
  await sleep(9000);

  await rec.stop();
  await browser.close();
  console.log(`[proof] wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
}

main().catch((e) => { console.error('[proof] failed:', e.message); process.exit(1); });
