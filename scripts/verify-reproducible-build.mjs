import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const builds = ['dist', 'dist-firefox'];
const npm = process.platform === 'win32' ? process.env.ComSpec : 'npm';

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

async function snapshot() {
  const hashes = {};
  for (const build of builds) {
    for (const file of await filesIn(path.join(root, build))) {
      const contents = await readFile(path.join(root, build, file));
      hashes[`${build}/${file}`] = createHash('sha256').update(contents).digest('hex');
    }
  }
  return hashes;
}

function build() {
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build:all'] : ['run', 'build:all'];
  const result = spawnSync(npm, args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(
      `Build failed with exit code ${result.status ?? 'unknown'}${result.error ? `: ${result.error.message}` : ''}`,
    );
  }
}

build();
const first = await snapshot();
build();
const second = await snapshot();
const allFiles = [...new Set([...Object.keys(first), ...Object.keys(second)])].sort();
const differences = allFiles.filter((file) => first[file] !== second[file]);

if (differences.length) {
  throw new Error(
    `Builds are not reproducible. Different files:\n${differences.map((file) => `- ${file}`).join('\n')}`,
  );
}

const outputDirectory = path.join(root, 'artifacts');
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, 'reproducibility.json'),
  `${JSON.stringify({ reproducible: true, files: second }, null, 2)}\n`,
);
console.log(`Verified reproducible output for ${allFiles.length} Chromium and Firefox files.`);
