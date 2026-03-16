#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  loadWritingAwarenessBootstrapFromDisk,
  loadWritingAwarenessSeedFromDisk,
  loadWritingAwarenessStateFromDisk,
  saveWritingAwarenessStateToDisk,
  toggleListValue,
  upsertManualRule,
} from '@audora/writing-awareness-storage';

const hostDirectory = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_OPTIONS = {
  fallbackSeedPath: path.resolve(hostDirectory, '..', 'public', 'WritingAwarenessSeed.json'),
  preferFallbackSeed: true,
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
      return loadWritingAwarenessBootstrapFromDisk({
        ...STORAGE_OPTIONS,
        currentSite: message.site ?? '',
      });

    case 'awareness:reload-seed': {
      const seed = await loadWritingAwarenessSeedFromDisk({
        ...STORAGE_OPTIONS,
        forceFallbackSeed: true,
      });
      const state = await loadWritingAwarenessStateFromDisk(STORAGE_OPTIONS);
      await saveWritingAwarenessStateToDisk(
        {
          ...state,
          lastSeedRunId: seed.sourceRunId,
          lastSeedSyncedAt: new Date().toISOString(),
        },
        STORAGE_OPTIONS
      );
      return loadWritingAwarenessBootstrapFromDisk({
        ...STORAGE_OPTIONS,
        currentSite: message.site ?? '',
      });
    }

    case 'awareness:save-manual-rule': {
      const state = await loadWritingAwarenessStateFromDisk(STORAGE_OPTIONS);
      await saveWritingAwarenessStateToDisk(
        {
          ...state,
          manualRules: upsertManualRule(state.manualRules, message.rule),
        },
        STORAGE_OPTIONS
      );
      return loadWritingAwarenessBootstrapFromDisk({
        ...STORAGE_OPTIONS,
        currentSite: message.site ?? '',
      });
    }

    case 'awareness:delete-manual-rule': {
      const state = await loadWritingAwarenessStateFromDisk(STORAGE_OPTIONS);
      await saveWritingAwarenessStateToDisk(
        {
          ...state,
          manualRules: state.manualRules.filter((rule) => rule.id !== message.ruleId),
        },
        STORAGE_OPTIONS
      );
      return loadWritingAwarenessBootstrapFromDisk({
        ...STORAGE_OPTIONS,
        currentSite: message.site ?? '',
      });
    }

    case 'awareness:update-rule-override': {
      const state = await loadWritingAwarenessStateFromDisk(STORAGE_OPTIONS);
      await saveWritingAwarenessStateToDisk(
        {
          ...state,
          ruleOverrides: {
            ...state.ruleOverrides,
            [message.ruleId]: {
              ...(state.ruleOverrides[message.ruleId] ?? {}),
              ...message.patch,
            },
          },
        },
        STORAGE_OPTIONS
      );
      return loadWritingAwarenessBootstrapFromDisk({
        ...STORAGE_OPTIONS,
        currentSite: message.site ?? '',
      });
    }

    case 'awareness:toggle-site-mute': {
      const state = await loadWritingAwarenessStateFromDisk(STORAGE_OPTIONS);
      await saveWritingAwarenessStateToDisk(
        {
          ...state,
          mutedSites: toggleListValue(state.mutedSites, message.site),
        },
        STORAGE_OPTIONS
      );
      return loadWritingAwarenessBootstrapFromDisk({
        ...STORAGE_OPTIONS,
        currentSite: message.site ?? '',
      });
    }

    case 'awareness:toggle-term-mute': {
      const state = await loadWritingAwarenessStateFromDisk(STORAGE_OPTIONS);
      await saveWritingAwarenessStateToDisk(
        {
          ...state,
          mutedTerms: toggleListValue(state.mutedTerms, message.term),
        },
        STORAGE_OPTIONS
      );
      return loadWritingAwarenessBootstrapFromDisk({
        ...STORAGE_OPTIONS,
        currentSite: message.site ?? '',
      });
    }

    case 'awareness:record-events': {
      if (!message.events?.length) {
        return { ok: true };
      }
      const state = await loadWritingAwarenessStateFromDisk(STORAGE_OPTIONS);
      await saveWritingAwarenessStateToDisk(
        {
          ...state,
          reinforcementEvents: [...state.reinforcementEvents, ...message.events],
        },
        STORAGE_OPTIONS
      );
      return { ok: true };
    }

    case 'awareness:request-refresh':
      return { ok: true };

    default:
      return { error: `Unsupported message type: ${message.type}` };
  }
}
