// The claim scene: the top of the site, then a slow reveal down to the wire.
//
// The narration lands "Held changes one field. payTo is an escrow account." at 8s, so the wire with
// its escrow pod has to be on screen by then. Nothing is clicked and nothing is waited for; this is
// the one scene that is purely the page.
import { launch, record, settled, sleep, smoothScrollTo } from './lib.mjs';

const BASE = process.env.BASE || 'https://heldprotocol.xyz';
const { browser, page } = await launch();
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
await settled(page);
// The wire only goes live once it has read a held deadline. Give it that chance before rolling,
// so the pod carries a real clock rather than "nothing in flight yet".
await sleep(2500);

// The composition crops HEAD (66px) off the top of every recorded scene to hide the page's own
// nav, so the page has to start scrolled by that much or the crop eats into the headline.
// Measure it rather than guess: put the headline's own top 26px below the crop line, so the first
// line is whole and the page's nav is still hidden underneath the composition's header band.
const h1Top = await page.evaluate(() => document.querySelector('.lede h1').getBoundingClientRect().top + window.scrollY);
await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, h1Top - 66 - 26));
await sleep(500);

const stop = await record(page, 'top');
await sleep(4200);                                   // hold on the headline
const wireY = await page.evaluate(() => document.querySelector('.wire').getBoundingClientRect().top + window.scrollY);
await smoothScrollTo(page, Math.max(0, wireY - 300), 3200);
await sleep(5800);                                   // rest on the wire through the payTo line
await stop();
await browser.close();
