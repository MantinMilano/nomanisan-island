// Builds dist/nomanisan.html: page.html with every src/js/*.js file pasted (in name order)
// into its single module script, plus every recorded voice line (src/voice/*.opus) as base64.
// The result opens straight from disk or publishes as an Artifact.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const jsDir = join(root, 'src', 'js'), voiceDir = join(root, 'src', 'voice');
const noVoice = process.argv.includes('--no-voice');
const files = readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();
const voices = !noVoice && existsSync(voiceDir) ? readdirSync(voiceDir).filter((f) => f.endsWith('.opus')).sort() : [];
const voiceJs = 'const VOICE_DATA = {\n' + voices.map((f) => `${JSON.stringify(f.slice(0, -5))}: "${readFileSync(join(voiceDir, f)).toString('base64')}",`).join('\n') + '\n};\n';
const js = voiceJs + files.map((f) => `// ---- ${f} ----\n` + readFileSync(join(jsDir, f), 'utf8')).join('\n');
const page = readFileSync(join(root, 'src', 'page.html'), 'utf8');
if (!page.includes('/*__GAME__*/')) throw new Error('page.html lost its /*__GAME__*/ marker');
const out = page.replace('/*__GAME__*/', () => js);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'nomanisan.html'), out);
console.log(`built dist/nomanisan.html  (${files.length} js files, ${voices.length} voice lines, ${(out.length / 1024 / 1024).toFixed(2)} MB)`);
