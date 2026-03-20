#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  loadEloqBootstrapFromDisk,
} from '@audora/writing-awareness-storage';

const hostDirectory = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_OPTIONS = {
  fallbackSnapshotPath: path.resolve(hostDirectory, '..', 'public', 'EloqSnapshot.json'),
  preferFallbackSnapshot: true,
};

let stdinBuffer = Buffer.alloc(0);

process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
    parseMessages();
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

function parseMessages() {
  while (stdinBuffer.length >= 4) {
    const messageLength = stdinBuffer.readUInt32LE(0);
    if (stdinBuffer.length < messageLength + 4) {
      return;
    }

    const messageBuffer = stdinBuffer.subarray(4, messageLength + 4);
    stdinBuffer = stdinBuffer.subarray(messageLength + 4);

    try {
      const message = JSON.parse(messageBuffer.toString('utf8'));
      Promise.resolve(handleMessage(message))
        .then((response) => writeMessage(response))
        .catch((error) =>
          writeMessage({ error: error instanceof Error ? error.message : String(error) })
        );
    } catch (error) {
      writeMessage({
        error: error instanceof Error ? error.message : 'Invalid native host message',
      });
    }
  }
}

function writeMessage(value) {
  const json = Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

async function handleMessage(message) {
  switch (message.type) {
    case 'awareness:get-bootstrap':
      return loadEloqBootstrapFromDisk({
        ...STORAGE_OPTIONS,
        currentSite: message.site ?? '',
      });

    case 'awareness:reload-seed':
      return loadEloqBootstrapFromDisk({
        ...STORAGE_OPTIONS,
        forceFallbackSnapshot: true,
        currentSite: message.site ?? '',
      });

    case 'awareness:request-refresh':
      return { ok: true };

    case 'awareness:save-manual-rule':
    case 'awareness:delete-manual-rule':
    case 'awareness:update-rule-override':
    case 'awareness:toggle-site-mute':
    case 'awareness:toggle-term-mute':
    case 'awareness:record-events':
      return { ok: true };

    default:
      return { error: `Unsupported message type: ${message.type}` };
  }
}
