import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const extensionPath = path.join(root, 'dist');
const manifest = JSON.parse(await readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
const executablePath = process.argv[2];
const browserName = process.argv[3] ?? 'Chromium';

if (!executablePath) throw new Error('Usage: node scripts/smoke-chromium-extension.mjs <browser executable> [name]');

const profile = await mkdtemp(path.join(os.tmpdir(), 'danbooru-viewer-smoke-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extensionId = new URL(worker.url()).hostname;

  for (const entry of [manifest.chrome_url_overrides.newtab, manifest.action.default_popup, manifest.options_ui.page]) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(`chrome-extension://${extensionId}/${entry}`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`${entry} returned ${response?.status() ?? 'no response'}`);
    await page.locator('#root').waitFor({ state: 'attached', timeout: 10_000 });
    if (errors.length) throw new Error(`${entry} reported page errors: ${errors.join('; ')}`);
    await page.close();
  }

  console.log(
    `${browserName} ${context.browser()?.version() ?? 'unknown'} loaded extension ${extensionId}; new tab, popup, options, and service worker passed.`,
  );
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
