#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOST_NAME = 'studio.orbitlabs.audora.writing';
const HOST_SCRIPT = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'index.mjs');
const HOST_LAUNCHER = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'launcher.sh');
const NODE_BINARY = process.execPath;
const HOME = os.homedir();
const args = process.argv.slice(2);

const chromiumIds = args
  .filter((value) => value.startsWith('--chrome-id='))
  .map((value) => value.split('=')[1])
  .filter(Boolean);
const firefoxIds = args
  .filter((value) => value.startsWith('--firefox-id='))
  .map((value) => value.split('=')[1])
  .filter(Boolean);

const MANIFEST_TARGETS = [
  path.join(HOME, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
  path.join(HOME, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'),
  path.join(HOME, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
  path.join(HOME, 'Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts'),
  path.join(HOME, 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts'),
  path.join(HOME, 'Library', 'Application Support', 'zen', 'NativeMessagingHosts'),
];

const FIREFOX_ALLOWED_EXTENSIONS = firefoxIds.length
  ? firefoxIds
  : ['writing-awareness@audora.local'];

fs.chmodSync(HOST_SCRIPT, 0o755);
fs.writeFileSync(
  HOST_LAUNCHER,
  `#!/bin/sh\nexec "${NODE_BINARY}" "${HOST_SCRIPT}" "$@"\n`,
  { mode: 0o755 }
);
fs.chmodSync(HOST_LAUNCHER, 0o755);

for (const directory of MANIFEST_TARGETS) {
  const isFirefoxFamily = directory.includes('Mozilla') || directory.includes(`${path.sep}zen${path.sep}`);
  if (!isFirefoxFamily && !chromiumIds.length) {
    continue;
  }

  fs.mkdirSync(directory, { recursive: true });
  const manifestPath = path.join(directory, `${HOST_NAME}.json`);
  const manifest = isFirefoxFamily
    ? {
        name: HOST_NAME,
        description: 'Eloq Writing native host',
        path: HOST_LAUNCHER,
        type: 'stdio',
        allowed_extensions: FIREFOX_ALLOWED_EXTENSIONS,
      }
    : {
        name: HOST_NAME,
        description: 'Eloq Writing native host',
        path: HOST_LAUNCHER,
        type: 'stdio',
        allowed_origins: chromiumIds.map((id) => `chrome-extension://${id}/`),
      };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${manifestPath}`);
}

if (!chromiumIds.length) {
  console.log('Skipped Chromium manifests. Pass one or more --chrome-id=<extension-id> values to install them.');
}
