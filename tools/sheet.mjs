// Contact sheet: puts many screenshots into one image so they can be reviewed at a glance.
// usage: node tools/sheet.mjs <dir> <regex> <out.png> [cols]
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [dir, pattern, out, colsArg] = process.argv.slice(2);
const re = new RegExp(pattern);
const files = readdirSync(dir).filter((f) => re.test(f)).sort();
const cols = +colsArg || 3;
const w = 1800, cw = Math.floor(w / cols), ch = Math.round(cw * 9 / 16);
const rows = Math.ceil(files.length / cols);
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${cw}px);font:14px sans-serif;color:#fff">` +
  files.map((f) => `<div style="position:relative;width:${cw}px;height:${ch}px"><img src="data:image/png;base64,${readFileSync(join(dir, f)).toString('base64')}" style="width:100%;height:100%;object-fit:cover"><span style="position:absolute;left:4px;top:2px;background:#000a;padding:1px 4px">${f}</span></div>`).join('') + '</body>';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: cols * cw, height: rows * ch } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: out });
await browser.close();
console.log(`${files.length} images -> ${out}`);
