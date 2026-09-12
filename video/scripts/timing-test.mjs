// Verifies the recorder keeps wall-clock time: a page shows elapsed seconds, we record 12s, and the
// mp4 must be ~12s long with the counter reading ~12 at the end.
import { launch, record, sleep } from './lib.mjs';
const { browser, page } = await launch();
await page.setContent(`<body style="margin:0;background:#faf8f4;font:400 120px monospace;padding:200px" id="b"><div id="t">0.0</div><script>const s=performance.now();setInterval(()=>{document.getElementById('t').textContent=((performance.now()-s)/1000).toFixed(1)},50)</script></body>`);
const stop = await record(page, 'timing-test');
await sleep(12000);
await stop();
await browser.close();
