// Builds the static version (GitHub Pages, Vercel) into dist/, or --out <dir>.
// BASE_PATH is the path the site is served under, e.g. /contoso-order-entry/ (default /).

import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const outFlag = process.argv.indexOf('--out');
const out = outFlag > 0 ? process.argv[outFlag + 1] : 'dist';

let base = process.env.BASE_PATH || '/';
if (!base.startsWith('/')) base = '/' + base;
if (!base.endsWith('/')) base += '/';

await rm(out, { recursive: true, force: true });
await mkdir(out);
await build({ entryPoints: ['web/sw.js'], bundle: true, format: 'iife', target: 'es2020', outfile: `${out}/sw.js`, logLevel: 'warning' });
await cp('public', out, { recursive: true });
const index = (await readFile('web/index.html', 'utf8')).replaceAll('__BASE__', base);
await writeFile(`${out}/index.html`, index);
await writeFile(`${out}/404.html`, index);
await writeFile(`${out}/.nojekyll`, '');
console.log(`Built ${out}/ for ${base}`);
