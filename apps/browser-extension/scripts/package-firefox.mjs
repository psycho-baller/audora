#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const distRoot = path.join(appRoot, 'dist');
const firefoxDist = path.join(distRoot, 'firefox');
const manifestPath = path.join(firefoxDist, 'manifest.json');

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const extensionName = String(manifest.name ?? 'eloq-writing')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
const version = String(manifest.version ?? '0.0.0').trim() || '0.0.0';
const xpiName = `${extensionName}-firefox-${version}.xpi`;
const xpiPath = path.join(distRoot, xpiName);

await fs.rm(xpiPath, { force: true });

execFileSync('zip', ['-r', xpiPath, '.'], {
  cwd: firefoxDist,
  stdio: 'inherit',
});

console.log(`Created ${xpiPath}`);
