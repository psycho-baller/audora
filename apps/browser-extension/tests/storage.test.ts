import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import snapshotFixture from '../public/EloqSnapshot.json';

const { localStore, browserMock } = vi.hoisted(() => {
  const localStore: Record<string, unknown> = {};

  const browserMock = {
    runtime: {
      getURL: vi.fn((value: string) => value),
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: localStore[key] })),
        set: vi.fn(async (value: Record<string, unknown>) => {
          Object.assign(localStore, value);
        }),
      },
    },
  };

  return { localStore, browserMock };
});

vi.mock('../src/shared/browser', () => ({
  browser: browserMock,
}));

import {
  bootstrapPayload,
  getStoredSnapshot,
  setExtensionState,
  setStoredSnapshot,
} from '../src/shared/storage';

describe('Eloq browser storage', () => {
  beforeEach(() => {
    for (const key of Object.keys(localStore)) {
      delete localStore[key];
    }
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(snapshotFixture), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a bootstrap payload from the Eloq snapshot and local extension state', async () => {
    await setStoredSnapshot(snapshotFixture);
    await setExtensionState({
      ruleOverrides: {},
      manualRules: [],
      repairs: [],
      reinforcementEvents: [
        {
          id: 'event-1',
          kind: 'avoid-caught',
          term: 'thing',
          context: 'test',
          createdAt: new Date().toISOString(),
        },
      ],
      mutedSites: ['example.com'],
      mutedTerms: ['thing'],
      lastSeedRunId: 'eloq-v1',
    });

    const payload = await bootstrapPayload('example.com');

    expect(payload.snapshot?.summary.acceptedConnections).toBe(2);
    expect(payload.state.mutedSites).toEqual(['example.com']);
    expect(payload.summary.avoidCaught).toBe(1);
    expect(payload.focusPack.targetWords).toContain('constraint');
    expect(payload.seed.rules.some((rule) => rule.id === 'eloq:avoid:thing')).toBe(true);
    expect(payload.seed.rules.some((rule) => rule.id === 'eloq:target:compelling')).toBe(true);
  });

  it('falls back to the bundled Eloq snapshot when local storage is empty', async () => {
    const snapshot = await getStoredSnapshot();

    expect(snapshot.summary.totalWords).toBe(5);
    expect(browserMock.runtime.getURL).toHaveBeenCalledWith('EloqSnapshot.json');
    expect(localStore['eloq-snapshot']).toBeDefined();
  });
});
