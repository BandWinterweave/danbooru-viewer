import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const manifestSchema = JSON.parse(await readFile(path.join(root, 'scripts', 'manifest.schema.json'), 'utf8'));
const validateManifest = new Ajv({ allErrors: true, strict: false }).compile(manifestSchema);
const builds = ['dist', 'dist-firefox'];
const allowedPermissions = new Set([
  'storage',
  'downloads',
  'unlimitedStorage',
  'scripting',
  'declarativeNetRequestWithHostAccess',
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
  if (
    manifest.content_security_policy?.extension_pages &&
    !manifest.content_security_policy.extension_pages.includes("script-src 'self'")
  ) {
    throw new Error(`${build}: unsafe extension page CSP`);
  }
  const unexpected = (manifest.permissions ?? []).filter((permission) => !allowedPermissions.has(permission));
  if (unexpected.length) throw new Error(`${build}: unexpected permissions: ${unexpected.join(', ')}`);
  if (build === 'dist-firefox' && !Array.isArray(manifest.background?.scripts))
    throw new Error('Firefox build must use background.scripts');
  if (build === 'dist' && !manifest.background?.service_worker)
    throw new Error('Chromium build must use a service worker');

  const files = await filesIn(directory);
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
