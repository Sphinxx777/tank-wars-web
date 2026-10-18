import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await checkDirectory(url);
    else if (/\.(mjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', fileURLToPath(url)], {
        stdio: 'inherit',
      });
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}
for (const directory of ['dist', 'tools', 'tests']) {
  await checkDirectory(new URL(`../${directory}/`, import.meta.url));
}
console.log('JavaScript syntax checks passed.');
