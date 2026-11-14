import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = 'http://152.53.199.71:8321/';
const out = 'test-results/screenshots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();

const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await desk.newPage();
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/landing-hero.png` });

const y = await page.evaluate(() => {
  const el = document.querySelector('#features .grid--features');
  return Math.round(el.getBoundingClientRect().top + scrollY);
});
await page.evaluate((yy) => window.scrollTo(0, yy - 140), y);
await page.waitForTimeout(1400);
await page.screenshot({ path: `${out}/landing-features.png` });

const y2 = await page.evaluate(() => Math.round(document.querySelector('#screens').getBoundingClientRect().top + scrollY));
await page.evaluate((yy) => window.scrollTo(0, yy - 60), y2);
await page.waitForTimeout(1600);
await page.screenshot({ path: `${out}/landing-screens.png` });

const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m = await mob.newPage();
await m.goto(url, { waitUntil: 'load', timeout: 60000 });
await m.waitForTimeout(1800);
await m.screenshot({ path: `${out}/landing-mobile.png` });

await browser.close();
console.log('ok');
