import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadEloqBootstrapFromDisk } from '@audora/writing-awareness-storage';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const fallbackSnapshotPath = path.resolve(
  rootDirectory,
  '..',
  '..',
  'browser-extension',
  'public',
  'EloqSnapshot.json'
);

describe('Eloq Obsidian bootstrap', () => {
  it('loads the shared Eloq snapshot contract for the plugin consumer', async () => {
    const bootstrap = await loadEloqBootstrapFromDisk({
      currentSite: 'obsidian',
      fallbackSnapshotPath,
      forceFallbackSnapshot: true,
      localState: {
        mutedTerms: ['good'],
      },
    });

    expect(bootstrap.snapshot?.summary.totalWords).toBe(5);
    expect(bootstrap.snapshot?.summary.acceptedConnections).toBe(2);
    expect(bootstrap.state.mutedTerms).toEqual(['good']);
    expect(bootstrap.focusPack.bannedTerms).toContain('thing');
    expect(bootstrap.seed.rules.some((rule: { id: string }) => rule.id === 'eloq:avoid:good')).toBe(true);
    expect(bootstrap.seed.rules.some((rule: { id: string }) => rule.id === 'eloq:target:constraint')).toBe(true);
  });
});
