import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.join(rootDirectory, 'dist');
const bundledSeedSource = path.resolve(
  rootDirectory,
  '..',
  'browser-extension',
  'public',
  'WritingAwarenessSeed.json'
);

const watchMode = process.argv.includes('--watch');

async function copyStaticAssets() {
  await fs.mkdir(distDirectory, { recursive: true });
  await Promise.all([
    fs.copyFile(path.join(rootDirectory, 'manifest.json'), path.join(distDirectory, 'manifest.json')),
    fs.copyFile(path.join(rootDirectory, 'styles.css'), path.join(distDirectory, 'styles.css')),
    fs.copyFile(bundledSeedSource, path.join(distDirectory, 'WritingAwarenessSeed.json')),
  ]);
}

const context = await esbuild.context({
  entryPoints: [path.join(rootDirectory, 'src', 'main.ts')],
  bundle: true,
  outfile: path.join(distDirectory, 'main.js'),
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: watchMode,
  logLevel: 'info',
  external: [
    'obsidian',
    'electron',
    '@codemirror/state',
    '@codemirror/view',
    '@codemirror/language',
  ],
});

await copyStaticAssets();

if (watchMode) {
  await context.watch();
  console.log('[audora-obsidian-plugin] watching');
} else {
  await context.rebuild();
  await context.dispose();
}
