// Builds the static GitHub Pages version into dist/.
// BASE_PATH is the path the site is served under, e.g. /contoso-order-entry/ (default /).

import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

let base = process.env.BASE_PATH || '/';
if (!base.startsWith('/')) base = '/' + base;
if (!base.endsWith('/')) base += '/';

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await build({ entryPoints: ['web/sw.js'], bundle: true, format: 'iife', target: 'es2020', outfile: 'dist/sw.js', logLevel: 'warning' });
await cp('public', 'dist', { recursive: true });
const index = (await readFile('web/index.html', 'utf8')).replaceAll('__BASE__', base);
await writeFile('dist/index.html', index);
await writeFile('dist/404.html', index);
await writeFile('dist/.nojekyll', '');
console.log(`Built dist/ for ${base}`);
