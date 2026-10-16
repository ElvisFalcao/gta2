// Builds a single self-contained HTML file (CSS, game code and Three.js all inlined).
// Usage: node tools/build-single.mjs [out.html] [--fragment]
//   --fragment  omit <!doctype>/<html>/<head>/<body> (for hosts that add their own skeleton)
//   --cdn       load Three.js from jsDelivr instead of inlining it
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { dirname } from 'path';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist/mother-city.html';
const fragment = process.argv.includes('--fragment');

const cdn = process.argv.includes('--cdn');
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
const esb = (extra) => execSync(`npx --yes esbuild@0.24.0 src/main.js --bundle --format=esm ${extra} --minify --legal-comments=none --log-level=warning`, { maxBuffer: 64 * 1024 * 1024 }).toString();
const js = cdn
  ? esb('--external:three').replace(/from\s*"three"/g, `from"${THREE_URL}"`)
  : '/* Three.js r160 (c) 2010-2023 Three.js Authors, MIT licence */\n' + esb('--alias:three=./vendor/three.module.min.js');
const css = readFileSync('css/style.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const fonts = [...html.matchAll(/<link[^>]+fonts\.g[^>]+>/g)].map((m) => m[0]).join('\n');
const desc = (html.match(/<meta name="description"[^>]*>/) || [''])[0];
let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
body = body.replace(/<script type="module" src="src\/main\.js"><\/script>/, '');
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const head = `${title}\n${desc}\n${fonts}\n<style>:root{color-scheme:dark}\n${css}</style>`;
const content = `${head}\n${body}\n<script type="module">\n${safeJs}\n</script>\n`;
const doc = fragment
  ? content
  : `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />\n${head}\n</head>\n<body>\n${body}\n<script type="module">\n${safeJs}\n</script>\n</body>\n</html>\n`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, doc);
console.log(`wrote ${out} (${(doc.length / 1024).toFixed(0)} KB)`);
