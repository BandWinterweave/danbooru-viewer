import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../dist-firefox/manifest.json', import.meta.url);
const manifest = JSON.parse(readFileSync(path, 'utf8'));
const loaderPath = new URL(`../dist-firefox/${manifest.background.service_worker}`, import.meta.url);
const backgroundModule = readFileSync(loaderPath, 'utf8').match(/import\s+["']\/?([^"']+)["']/)?.[1];
if (!backgroundModule) throw new Error('Could not locate the bundled Firefox background script');
manifest.background = { scripts: [backgroundModule] };
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
