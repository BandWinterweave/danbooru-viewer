import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const manifestSchema = JSON.parse(await readFile(path.join(root, 'scripts', 'manifest.schema.json'), 'utf8'));
const validateManifest = new Ajv({ allErrors: true, strict: false }).compile(manifestSchema);
const builds = ['dist', 'dist-firefox'];
const requiredLocales = ['en', 'zh_CN'];
const allowedPermissions = new Set([
  'storage',
  'downloads',
  'unlimitedStorage',
  'scripting',
  'declarativeNetRequestWithHostAccess',
]);
const requiredHostPermissions = new Set([
  'https://*.donmai.us/*',
  'https://gelbooru.com/*',
  'https://*.gelbooru.com/*',
  'https://*.safebooru.org/*',
  'https://*.yande.re/*',
  'https://*.rule34.xxx/*',
  'http://127.0.0.1/*',
  'https://127.0.0.1/*',
]);

async function filesIn(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(path.join(directory, entry.name), relative)));
    else files.push(relative);
  }
  return files.sort();
}

const report = { version: packageJson.version, generatedAt: new Date().toISOString(), builds: {} };
for (const build of builds) {
  const directory = path.join(root, build);
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (!validateManifest(manifest)) {
    throw new Error(`${build}: invalid Manifest schema: ${JSON.stringify(validateManifest.errors)}`);
  }
  if (manifest.manifest_version !== 3) throw new Error(`${build}: manifest_version must be 3`);
  if (manifest.version !== packageJson.version) throw new Error(`${build}: version does not match package.json`);
  if (manifest.content_security_policy?.extension_pages !== "script-src 'self'; object-src 'self'")
    throw new Error(`${build}: extension page CSP must allow only local scripts and objects`);
  const unexpected = (manifest.permissions ?? []).filter((permission) => !allowedPermissions.has(permission));
  if (unexpected.length) throw new Error(`${build}: unexpected permissions: ${unexpected.join(', ')}`);
  const missingHosts = [...requiredHostPermissions].filter(
    (permission) => !manifest.host_permissions?.includes(permission),
  );
  const unexpectedHosts = (manifest.host_permissions ?? []).filter(
    (permission) => !requiredHostPermissions.has(permission),
  );
  if (missingHosts.length || unexpectedHosts.length)
    throw new Error(`${build}: host permissions differ from the reviewed allowlist`);
  if (build === 'dist-firefox' && !Array.isArray(manifest.background?.scripts))
    throw new Error('Firefox build must use background.scripts');
  if (build === 'dist' && !manifest.background?.service_worker)
    throw new Error('Chromium build must use a service worker');

  const messageKeys = [...JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map((match) => match[1]);
  for (const locale of requiredLocales) {
    const messages = JSON.parse(await readFile(path.join(directory, '_locales', locale, 'messages.json'), 'utf8'));
    const missing = messageKeys.filter((key) => !messages[key] || typeof messages[key].message !== 'string');
    if (missing.length)
      throw new Error(`${build}: _locales/${locale} is missing manifest messages: ${missing.join(', ')}`);
  }

  const files = await filesIn(directory);
  const referencedFiles = [
    manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
    ...Object.values(manifest.chrome_url_overrides ?? {}),
    manifest.options_ui?.page,
    ...(manifest.background?.scripts ?? []),
    manifest.background?.service_worker,
    ...(manifest.content_scripts ?? []).flatMap((script) => [...(script.js ?? []), ...(script.css ?? [])]),
    ...(manifest.declarative_net_request?.rule_resources ?? []).map((rule) => rule.path),
  ].filter(Boolean);
  const missingFiles = referencedFiles.filter((file) => !files.includes(file.replace(/^\.\//, '')));
  if (missingFiles.length) throw new Error(`${build}: manifest references missing files: ${missingFiles.join(', ')}`);
  if (build === 'dist-firefox' && manifest.browser_specific_settings?.gecko?.strict_min_version !== '140.0')
    throw new Error('Firefox build must retain the reviewed minimum version');
  if (
    build === 'dist-firefox' &&
    !manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required?.includes('none')
  )
    throw new Error('Firefox build must declare that it requires no data collection');
  report.builds[build] = await Promise.all(
    files.map(async (file) => {
      const absolute = path.join(directory, file);
      const contents = await readFile(absolute);
      return { file, bytes: (await stat(absolute)).size, sha256: createHash('sha256').update(contents).digest('hex') };
    }),
  );
}

const outputDirectory = path.join(root, 'artifacts');
await import('node:fs/promises').then(({ mkdir }) => mkdir(outputDirectory, { recursive: true }));
await writeFile(path.join(outputDirectory, 'build-manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Validated ${Object.values(report.builds).flat().length} files across Chromium and Firefox builds.`);
