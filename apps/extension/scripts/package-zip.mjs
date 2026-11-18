import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const extensionRoot = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(extensionRoot, 'dist');

try {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'));
  } catch (cause) {
    throw new Error('Cannot read dist/manifest.json. Run pnpm build first and check the manifest.', { cause });
  }
  if (typeof manifest.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(manifest.version)) {
    throw new Error('dist/manifest.json has an invalid extension version.');
  }
  const probe = spawnSync('zip', ['-v'], { encoding: 'utf8' });
  if (probe.error?.code === 'ENOENT') throw new Error('The zip CLI is not installed. Install zip before packaging.');
  if (probe.error || probe.status !== 0) throw new Error(`Cannot run zip: ${probe.error?.message ?? probe.stderr}`);
  const release = path.join(extensionRoot, 'release');
  await mkdir(release, { recursive: true });
  const output = path.join(release, `hubris-extension-${manifest.version}.zip`);
  await rm(output, { force: true });
  const result = spawnSync('zip', ['-r', '-X', output, '.'], { cwd: dist, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    await rm(output, { force: true });
    throw new Error(`zip failed: ${result.error?.message ?? result.stderr}`);
  }
  console.log(`${output} (${(await stat(output)).size} bytes)`);
} catch (error) {
  console.error(`Packaging failed: ${error.message}`);
  process.exitCode = 1;
}
