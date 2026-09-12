// Take 3, the proof: HashScan on the escrow account (transactions tab, scrolled slowly) and on the
// evidence topic. The cookie dialog is dismissed before recording starts.
import { launch, record, sleep, smoothScrollTo } from './lib.mjs';

const ESCROW = 'https://hashscan.io/testnet/account/0.0.10495061';
const TOPIC = 'https://hashscan.io/testnet/topic/0.0.10495064';

async function dismissCookies(page) {
  await sleep(1500);
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /reject|accept/i.test(x.textContent));
    if (b) { b.click(); return b.textContent.trim(); }
    return null;
  });
  console.log('[cookies]', clicked);
  await sleep(600);
}

const { browser, page } = await launch();
await page.goto(ESCROW, { waitUntil: 'networkidle2', timeout: 90000 });
await dismissCookies(page);
// The transactions tab is where the settlements and releases are listed.
await page.evaluate(() => { const t = [...document.querySelectorAll('a,button,[role=tab]')].find((x) => x.textContent.trim() === 'Transactions'); if (t) t.click(); });
await sleep(3500);
let stop = await record(page, 'take3-account');
await sleep(2500);
await smoothScrollTo(page, 700, 5000);
await sleep(1500);
await stop();

await page.goto(TOPIC, { waitUntil: 'networkidle2', timeout: 90000 });
await dismissCookies(page);
await sleep(2500);
stop = await record(page, 'take3-topic');
await sleep(2000);
await smoothScrollTo(page, 500, 3500);
await sleep(1500);
await stop();
await browser.close();
