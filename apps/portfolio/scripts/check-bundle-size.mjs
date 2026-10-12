/**
 * Fails the build when the public site's JavaScript or CSS grows past its budget
 * (gzip sizes of dist/site after `npm run build`). Fonts are not counted: they are
 * cached separately and only the subsets a page uses are downloaded.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = { js: 110 * 1024, css: 16 * 1024 };
const dir = new URL('../dist/site/', import.meta.url).pathname;
const totals = { js: 0, css: 0 };
for (const file of readdirSync(dir)) {
  const kind = file.endsWith('.js') ? 'js' : file.endsWith('.css') ? 'css' : null;
  if (kind) totals[kind] += gzipSync(readFileSync(join(dir, file))).length;
}
let failed = false;
for (const kind of ['js', 'css']) {
  const kib = (totals[kind] / 1024).toFixed(1);
  const budget = (BUDGET[kind] / 1024).toFixed(0);
  console.log(`${kind.toUpperCase()}: ${kib} KiB gzip (budget ${budget} KiB)`);
  if (totals[kind] > BUDGET[kind]) failed = true;
}
if (failed) {
  console.error('Over budget.');
  process.exit(1);
}
