import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

async function readJson(file) {
  return JSON.parse(await readFile(path.join(root, file), 'utf8'));
}

const [packageJson, packageLock, manifest] = await Promise.all([
  readJson('package.json'),
  readJson('package-lock.json'),
  readJson('src/manifest.json'),
]);

const versions = {
  'package.json': packageJson.version,
  'package-lock.json': packageLock.version,
  'package-lock.json root package': packageLock.packages?.['']?.version,
  'src/manifest.json': manifest.version,
};
const uniqueVersions = new Set(Object.values(versions));

if (uniqueVersions.size !== 1 || [...uniqueVersions].some((version) => typeof version !== 'string')) {
  throw new Error(
    `Version mismatch:\n${Object.entries(versions)
      .map(([file, version]) => `- ${file}: ${String(version)}`)
      .join('\n')}`,
  );
}

const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
if (tag && tag !== `v${packageJson.version}`) {
  throw new Error(`Release tag ${tag} does not match package version v${packageJson.version}`);
}

console.log(`Validated release version ${packageJson.version}${tag ? ` against tag ${tag}` : ''}.`);
