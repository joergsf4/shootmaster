// UI-Screenshots über lokal installiertes Edge/Chrome (playwright-core).
// Aufruf: node tools/screenshot-ui.mjs <url> <ausgabeordner>
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'tmp-shots/ui';
fs.mkdirSync(out, { recursive: true });

let browser;
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel }); break; } catch { /* nächster */ }
}
if (!browser) throw new Error('Kein Edge/Chrome gefunden');
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => localStorage.setItem('sms-shmup-tour-done', '1')); // Tour überspringen
await page.goto(url);
await page.waitForTimeout(800);

const tabs = [['levels', 'Level'], ['formations', 'Formationen'], ['objects', 'Spieler'], ['sprites', 'Sprites'], ['tiles', 'Pinsel'], ['palette', 'Paletten'], ['sound', 'Sound']];
for (const [name, label] of tabs) {
  await page.locator('nav button', { hasText: label }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png` });
}
// Musik abspielen (Abspielkopf) + Effekte-Ansicht
await page.locator('nav button', { hasText: 'Sound' }).first().click();
await page.locator('button', { hasText: 'Abspielen' }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/sound-music.png` });
await page.locator('button', { hasText: 'Stopp' }).first().click();
await page.locator('button', { hasText: 'Soundeffekte' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/sound-sfx.png` });

// Ereignis im Level-Editor anwählen (Pfad-Overlay)
await page.locator('nav button', { hasText: 'Level' }).first().click();
await page.locator('[data-tour="events"]').click();
await page.waitForTimeout(200);
const cv = page.locator('.level-scroll canvas');
const box = await cv.boundingBox();
// erstes Ereignis liegt bei pos 40 → Weltlinie 296, Zoom 2
await page.mouse.click(box.x + 296 * 2, box.y + 60);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/levels-event.png` });

// Vertikales Level
await page.locator('[data-tour="brush"]').click();
await page.locator('.list li', { hasText: 'Asteroidenfeld' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/levels-v.png` });
await page.locator('.list li', { hasText: 'Orbit' }).click();

// Spielen
await page.locator('header button', { hasText: 'Spielen' }).click();
await page.waitForTimeout(500);
await page.keyboard.down('KeyZ');
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/play.png` });
await page.keyboard.up('KeyZ');
console.log(errors.length ? 'Fehler:\n' + errors.join('\n') : 'keine Konsolenfehler');
await browser.close();
