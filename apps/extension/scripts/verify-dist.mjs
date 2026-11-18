import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const required = ['manifest.json', 'popup.html', 'sidepanel.html', 'background.js'];
for (const name of required) assert((await stat(root + name)).isFile(), name);

const manifest = JSON.parse(await readFile(root + 'manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['sidePanel', 'alarms']);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.content_scripts, undefined);
assert.deepEqual(manifest.background, { service_worker: 'background.js', type: 'module' });
assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");

const files = await readdir(root, { recursive: true });
const javascript = files.filter((file) => file.endsWith('.js'));
for (const file of javascript) {
  const source = await readFile(root + file, 'utf8');
  assert(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/.test(source), `Network API in ${file}`);
  assert(!/\bimport\s*\(\s*['"]https?:\/\//.test(source), `Remote import in ${file}`);
}
for (const file of files.filter((file) => /\.(css|html)$/.test(file))) {
  const source = await readFile(root + file, 'utf8');
  assert(!/(?:src\s*=\s*['"]|url\(\s*['"]?|@import\s*['"])https?:\/\//.test(source), `Remote asset in ${file}`);
}
assert(files.some((file) => file.endsWith('.woff2')), 'Missing bundled fonts');
console.log(`Verified ${required.length} required files, manifest constraints, bundled fonts, and ${javascript.length} JavaScript files without network API calls.`);
