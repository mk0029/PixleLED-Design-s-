import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'src');
const output = path.join(root, 'dist');
const bundle = path.join(output, 'js', 'app.js');

await rm(output, { recursive: true, force: true });
await mkdir(path.dirname(bundle), { recursive: true });
await build({
  entryPoints: [path.join(source, 'js', 'app.js')],
  outfile: bundle,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  legalComments: 'none',
});

const bundled = await readFile(bundle, 'utf8');
const protectedBundle = JavaScriptObfuscator.obfuscate(bundled, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 0.8,
  renameGlobals: true,
  selfDefending: true,
  disableConsoleOutput: true,
  sourceMap: false,
}).getObfuscatedCode();
await writeFile(bundle, protectedBundle);
await mkdir(path.join(output, 'css'), { recursive: true });
for (const file of ['index.html', 'manifest.json', 'sw.js']) {
  await copyFile(path.join(source, file), path.join(output, file));
}
const workerPath = path.join(output, 'sw.js');
const worker = await readFile(workerPath, 'utf8');
await writeFile(workerPath, worker.replace(
  /const FILES = \[[\s\S]*?\];/,
  "const FILES = ['./', './index.html', './manifest.json', './css/style.css', './js/app.js'];",
));
await copyFile(path.join(source, 'css', 'style.css'), path.join(output, 'css', 'style.css'));
console.log(`Built offline deployment to ${output}`);
