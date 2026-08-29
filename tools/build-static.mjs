import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('../', import.meta.url);
const output = new URL('../.build/', import.meta.url);
const storefront = new URL('storefront/', output);
const admin = new URL('admin/', output);
const allowedExtensions = new Set(['.html', '.css', '.js']);
const excludedProductionFiles = new Set(['payment-mock.html', 'payment-mock.js']);

await rm(output, { recursive: true, force: true });
await mkdir(storefront, { recursive: true });
await mkdir(admin, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (
    entry.isFile() &&
    allowedExtensions.has(extname(entry.name)) &&
    !excludedProductionFiles.has(entry.name)
  ) {
    await cp(new URL(entry.name, root), new URL(entry.name, storefront));
  }
}

await cp(new URL('../assets/', import.meta.url), new URL('assets/', storefront), {
  recursive: true,
});

for (const name of ['index.html', 'admin.css', 'admin.js']) {
  await cp(new URL(`../apps/admin/${name}`, import.meta.url), new URL(name, admin));
}

console.log(`Production static assets built at ${join('.build', 'storefront')} and ${join('.build', 'admin')}.`);
