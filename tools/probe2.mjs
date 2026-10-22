// Small probe: run page code against the built game and print the result.
// usage: node tools/probe2.mjs "<async js using N = window.__nomanisan>"
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const code = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[probe]') || m.text().startsWith('[load]')) console.log(`[${m.type()}]`, m.text().slice(0, 400)); });
await page.goto(pathToFileURL(join(root, 'dist', 'nomanisan.html')).href);
await page.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 180000, polling: 500 });
const res = await page.evaluate(`(async () => { const N = window.__nomanisan; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); ${code} })()`);
console.log(JSON.stringify(res, null, 1));
if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
await browser.close();
