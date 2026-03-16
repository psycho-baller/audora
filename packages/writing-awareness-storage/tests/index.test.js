import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  loadWritingAwarenessStateFromDisk,
  saveLearningTargetToState,
  saveWritingAwarenessStateToDisk,
} from '../src/index.js';

const cleanupPaths = [];

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map((targetPath) =>
      fs.rm(targetPath, { recursive: true, force: true })
    )
  );
});

describe('writing-awareness storage', () => {
  it('saves and reloads disk state', async () => {
    const storageRoot = await makeTempDirectory();
    await saveWritingAwarenessStateToDisk(
      {
        mutedTerms: ['thing'],
      },
      { storageRoot }
    );

    const loaded = await loadWritingAwarenessStateFromDisk({ storageRoot });
    expect(loaded.mutedTerms).toEqual(['thing']);
    expect(loaded.manualRules).toEqual([]);
  });

  it('normalizes and deduplicates learning targets', () => {
    const firstSave = saveLearningTargetToState({
      state: {},
      text: '  "constraint"  ',
      sourceApp: 'Obsidian',
      contextLabel: 'Daily note',
      origin: 'selection',
    });

    expect(firstSave.result.status).toBe('saved');
    expect(firstSave.state.manualRules).toHaveLength(1);
    expect(firstSave.state.manualRules[0]?.term).toBe('constraint');

    const secondSave = saveLearningTargetToState({
      state: firstSave.state,
      text: 'constraint',
      sourceApp: 'Obsidian',
      contextLabel: 'Daily note',
      origin: 'selection',
    });

    expect(secondSave.result.status).toBe('alreadyExists');
    expect(secondSave.state.manualRules).toHaveLength(1);
  });
});

async function makeTempDirectory() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'audora-writing-awareness-storage-')
  );
  cleanupPaths.push(directory);
  return directory;
}
