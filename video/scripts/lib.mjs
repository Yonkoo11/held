// Shared filming helpers. Every clip is the live product in headless Chrome, recorded with
// puppeteer's screencast (CDP Page.startScreencast under the hood, frames duplicated to wall-clock
// time), then re-encoded to 1920x1080 30fps H.264 by ffmpeg.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire('/Users/yonko/node_modules/');
export const puppeteer = require('puppeteer');

export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const OUT = new URL('../public/video/', import.meta.url).pathname;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ['--window-size=1920,1080', '--hide-scrollbars', '--force-device-scale-factor=1', '--font-render-hinting=none'],
  });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  return { browser, page };
}

/**
 * Start recording; returns a stop() that assembles the frames into a 30 fps mp4.
 * puppeteer's own page.screencast() rounds each frame gap to whole frames and the rounding
 * accumulates (a 55 s recording came out 66 s long), so this uses the CDP screencast directly and
 * gives every frame its measured wall-clock duration through an ffmpeg concat list.
 */
export async function record(page, name) {
  const dir = `${OUT}${name}-frames/`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const client = await page.createCDPSession();
  const frames = [];
  client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = `${dir}${String(frames.length).padStart(6, '0')}.jpg`;
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    // Arrival time on this process's clock, the same clock the filming marks use. The CDP
    // metadata.timestamp is the compositor's clock and drifted ~1.5 s over a minute against it.
    frames.push({ file, ts: Date.now() / 1000, swap: metadata.timestamp });
    await client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const started = Date.now();
  return async () => {
    const endTs = Date.now() / 1000;
    await client.send('Page.stopScreencast');
    await sleep(300);
    await client.detach().catch(() => {});
    const secs = (endTs - started / 1000).toFixed(2);
    console.log(`[rec] first frame ${(frames[0].ts - started / 1000).toFixed(2)}s after start; ${frames.length} frames`);
    // Concat demuxer: each frame lasts until the next one arrived; the last one until stop().
    const lines = ['ffconcat version 1.0'];
    for (let i = 0; i < frames.length; i++) {
      const next = i + 1 < frames.length ? frames[i + 1].ts : endTs;
      const d = Math.max(0.001, next - frames[i].ts);
      lines.push(`file '${frames[i].file}'`, `duration ${d.toFixed(4)}`);
    }
    // The concat demuxer needs a trailing entry, and without its own duration it repeats the
    // previous one (a 7 s single-frame clip came out 14 s). One frame long, and -t caps the total.
    lines.push(`file '${frames[frames.length - 1].file}'`, 'duration 0.0334');
    const total = (endTs - frames[0].ts).toFixed(3);
    const list = `${dir}list.txt`;
    fs.writeFileSync(list, lines.join('\n') + '\n');
    const mp4 = `${OUT}${name}.mp4`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-t', total,
      '-vf', 'scale=1920:1080:flags=lanczos,fps=30', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    fs.rmSync(dir, { recursive: true, force: true });
    const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
      'stream=width,height,r_frame_rate:format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
    console.log(`[rec] ${name}.mp4 frames=${frames.length} wall=${secs}s probe=${probe.replace(/\n/g, ' ')}`);
    return mp4;
  };
}

/** Smooth scroll over ms milliseconds, easing in and out. */
export async function smoothScrollTo(page, y, ms = 1600) {
  await page.evaluate(async (y, ms) => {
    const y0 = window.scrollY; const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    await new Promise((done) => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        window.scrollTo(0, y0 + (y - y0) * ease(t));
        if (t < 1) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
  }, y, ms);
}

/** Wait until the page's fonts are ready and the health strip has filled in. */
export async function settled(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getElementById('escrow')?.textContent?.startsWith('0.0.'), { timeout: 20000 }).catch(() => {});
}
