// Syntax-checks the built page's module script (node --check on the extracted code).
// usage: node tools/check.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'dist', 'nomanisan.html'), 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
const dir = mkdtempSync(join(tmpdir(), 'nomcheck-'));
const f = join(dir, 'game.mjs');
writeFileSync(f, m[1]);
try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); console.log('syntax ok'); }
catch (e) { console.log(String(e.stderr || e.message).slice(0, 1500)); process.exit(1); }
// duplicate top-level declarations are a SyntaxError in modules; node --check catches those too
