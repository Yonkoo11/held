// The top of the sheet, still, for the claim scene: no payment, nothing to wait for.
import { launch, record, settled, sleep } from './lib.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:4021';
const { browser, page } = await launch();
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
await settled(page);
await sleep(800);
const stop = await record(page, 'top');
await sleep(13000);
await stop();
await browser.close();
