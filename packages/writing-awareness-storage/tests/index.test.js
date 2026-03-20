import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  deriveWritingAwarenessSeedFromEloqSnapshot,
  getEloqStoragePaths,
  loadEloqBootstrapFromDisk,
  loadEloqSnapshotFromDisk,
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

  it('loads an Eloq snapshot and persists the preferred fallback copy', async () => {
    const storageRoot = await makeTempDirectory();
    const bootstrap = await loadEloqBootstrapFromDisk({
      storageRoot,
      currentSite: 'obsidian',
      localState: {
        mutedTerms: ['thing'],
      },
      fallbackSnapshotPath: fixturePath('eloq-snapshot.v1.json'),
      preferFallbackSnapshot: true,
      forceFallbackSnapshot: true,
    });

    expect(bootstrap.snapshot?.summary.acceptedConnections).toBe(2);
    expect(bootstrap.seed.sourceRunId).toBe('eloq-v1');
    expect(bootstrap.seed.rules.some((rule) => rule.id === 'eloq:avoid:thing')).toBe(true);
    expect(bootstrap.seed.rules.some((rule) => rule.id === 'eloq:target:constraint')).toBe(true);
    expect(bootstrap.state.mutedTerms).toEqual(['thing']);
    expect(bootstrap.focusPack.targetWords).toContain('constraint');

    const persistedSnapshot = await loadEloqSnapshotFromDisk({ storageRoot });
    expect(persistedSnapshot.summary.totalWords).toBe(5);
  });

  it('derives accepted links and standalone targets from an Eloq snapshot', async () => {
    const snapshot = JSON.parse(
      await fs.readFile(fixturePath('eloq-snapshot.v1.json'), 'utf8')
    );

    const seed = deriveWritingAwarenessSeedFromEloqSnapshot(snapshot);
    const avoidThing = seed.rules.find((rule) => rule.id === 'eloq:avoid:thing');
    const avoidInteresting = seed.rules.find((rule) => rule.id === 'eloq:avoid:interesting');
    const targetConstraint = seed.rules.find((rule) => rule.id === 'eloq:target:constraint');
    const targetCompelling = seed.rules.find((rule) => rule.id === 'eloq:target:compelling');

    expect(avoidThing?.replacementOptions.map((option) => option.word)).toEqual(['constraint']);
    expect(avoidInteresting?.replacementOptions).toEqual([]);
    expect(targetConstraint?.term).toBe('constraint');
    expect(targetCompelling?.term).toBe('compelling');
    expect(seed.focusTemplates[0]?.exampleRewrite).toBe('thing -> constraint');
  });

  it('prefers the newer sandbox Eloq snapshot when both locations exist', async () => {
    const standardRoot = await makeTempDirectory();
    const sandboxRoot = await makeTempDirectory();

    const staleSnapshot = JSON.parse(
      await fs.readFile(fixturePath('eloq-snapshot.v1.json'), 'utf8')
    );
    const liveSnapshot = {
      version: 1,
      generatedAt: '2026-03-20T10:46:44Z',
      summary: {
        totalWords: 4,
        overusedWords: 1,
        underusedWords: 3,
        acceptedConnections: 3,
        suggestedConnections: 0,
        dismissedConnections: 0,
      },
      words: [
        {
          id: 'word-interesting',
          displayTerm: 'interesting',
          normalizedTerm: 'interesting',
          roles: ['overused'],
          notes: '',
          contexts: ['Quick Add'],
          provenance: 'user',
        },
        {
          id: 'word-intriguing',
          displayTerm: 'intriguing',
          normalizedTerm: 'intriguing',
          roles: ['underused'],
          notes: '',
          contexts: [],
          provenance: 'ai',
        },
        {
          id: 'word-revealing',
          displayTerm: 'revealing',
          normalizedTerm: 'revealing',
          roles: ['underused'],
          notes: '',
          contexts: [],
          provenance: 'ai',
        },
        {
          id: 'word-compelling',
          displayTerm: 'compelling',
          normalizedTerm: 'compelling',
          roles: ['underused'],
          notes: '',
          contexts: [],
          provenance: 'ai',
        },
      ],
      connections: [
        {
          id: 'connection-1',
          overusedWordID: 'word-interesting',
          overusedTerm: 'interesting',
          underusedWordID: 'word-intriguing',
          underusedTerm: 'intriguing',
          origin: 'ai',
          status: 'accepted',
          rationale: 'Curiosity and suspense.',
          useWhen: 'You mean it provokes curiosity.',
          caution: 'Can be dramatic.',
          confidence: 0.85,
        },
        {
          id: 'connection-2',
          overusedWordID: 'word-interesting',
          overusedTerm: 'interesting',
          underusedWordID: 'word-revealing',
          underusedTerm: 'revealing',
          origin: 'ai',
          status: 'accepted',
          rationale: 'It reveals insight.',
          useWhen: 'You want to stress explanation.',
          caution: 'May imply novelty.',
          confidence: 0.88,
        },
        {
          id: 'connection-3',
          overusedWordID: 'word-interesting',
          overusedTerm: 'interesting',
          underusedWordID: 'word-compelling',
          underusedTerm: 'compelling',
          origin: 'ai',
          status: 'accepted',
          rationale: 'It strongly engages.',
          useWhen: 'You want to stress force or pull.',
          caution: 'Not ideal for neutral description.',
          confidence: 0.9,
        },
      ],
    };

    await fs.mkdir(standardRoot, { recursive: true });
    await fs.mkdir(sandboxRoot, { recursive: true });
    await fs.writeFile(
      path.join(standardRoot, 'snapshot.json'),
      `${JSON.stringify(staleSnapshot, null, 2)}\n`
    );
    await fs.writeFile(
      path.join(sandboxRoot, 'snapshot.json'),
      `${JSON.stringify(liveSnapshot, null, 2)}\n`
    );

    const storagePaths = getEloqStoragePaths({
      storageRootCandidates: [sandboxRoot, standardRoot],
    });
    const bootstrap = await loadEloqBootstrapFromDisk({
      storageRootCandidates: [sandboxRoot, standardRoot],
      currentSite: 'obsidian',
    });

    const avoidInteresting = bootstrap.seed.rules.find((rule) => rule.id === 'eloq:avoid:interesting');

    expect(storagePaths.rootDirectory).toBe(sandboxRoot);
    expect(bootstrap.storageRoot).toBe(sandboxRoot);
    expect(bootstrap.snapshot?.summary.acceptedConnections).toBe(3);
    expect(avoidInteresting?.replacementOptions.map((option) => option.word)).toEqual([
      'intriguing',
      'revealing',
      'compelling',
    ]);
  });
});

async function makeTempDirectory() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'audora-writing-awareness-storage-')
  );
  cleanupPaths.push(directory);
  return directory;
}

function fixturePath(fileName) {
  return path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'fixtures',
    fileName
  );
}
