import { beforeEach, describe, expect, it, vi } from 'vitest';

  const {
    browserMock,
    sendNativeHostMessageMock,
    bootstrapPayloadMock,
    fetchMock,
    getExtensionStateMock,
    getStoredSnapshotMock,
    loadBundledSnapshotMock,
    peekStoredSnapshotMock,
  setExtensionStateMock,
  setStoredSnapshotMock,
  summarizeEventsMock,
} = vi.hoisted(() => {
  const browserMock = {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
      openOptionsPage: vi.fn(async () => undefined),
    },
    commands: {
      onCommand: { addListener: vi.fn() },
    },
    tabs: {
      query: vi.fn(async (query?: { active?: boolean; currentWindow?: boolean }) => {
        if (query?.active) {
          return [{ id: 99, url: 'https://example.com/editor' }];
        }
        return [{ id: 11 }, { id: 12 }];
      }),
      sendMessage: vi.fn(async () => undefined),
    },
  };

  return {
    browserMock,
    sendNativeHostMessageMock: vi.fn(),
    bootstrapPayloadMock: vi.fn(),
    fetchMock: vi.fn(),
    getExtensionStateMock: vi.fn(),
    getStoredSnapshotMock: vi.fn(),
    loadBundledSnapshotMock: vi.fn(),
    peekStoredSnapshotMock: vi.fn(),
    setExtensionStateMock: vi.fn(async () => undefined),
    setStoredSnapshotMock: vi.fn(async () => undefined),
    summarizeEventsMock: vi.fn(() => ({
      avoidCaught: 0,
      targetWins: 0,
      repairsCompleted: 0,
    })),
  };
});

vi.mock('../src/shared/browser', () => ({
  browser: browserMock,
}));

vi.mock('../src/shared/native-host', () => ({
  sendNativeHostMessage: sendNativeHostMessageMock,
}));

vi.mock('../src/shared/storage', () => ({
  bootstrapPayload: bootstrapPayloadMock,
  getExtensionState: getExtensionStateMock,
  getStoredSnapshot: getStoredSnapshotMock,
  loadBundledSnapshot: loadBundledSnapshotMock,
  peekStoredSnapshot: peekStoredSnapshotMock,
  setExtensionState: setExtensionStateMock,
  setStoredSnapshot: setStoredSnapshotMock,
  summarizeEvents: summarizeEventsMock,
}));

import {
  __resetBackgroundSyncStateForTests,
  handleMessage,
} from '../src/background/index';

const oldSnapshot = {
  version: 1,
  generatedAt: '2026-03-20T00:00:00.000Z',
  summary: {
    totalWords: 5,
    overusedWords: 3,
    underusedWords: 2,
    acceptedConnections: 2,
    suggestedConnections: 1,
    dismissedConnections: 0,
  },
  words: [],
  connections: [],
};

const liveSnapshot = {
  version: 1,
  generatedAt: '2026-03-30T12:00:00.000Z',
  summary: {
    totalWords: 16,
    overusedWords: 8,
    underusedWords: 8,
    acceptedConnections: 13,
    suggestedConnections: 0,
    dismissedConnections: 0,
  },
  words: [{ id: 'w1', displayTerm: 'interesting', normalizedTerm: 'interesting', roles: ['overused'], notes: '', sourceExcerpt: '', exampleUsage: '', contexts: [], provenance: 'user' }],
  connections: [],
};

const liveBootstrapPayload = {
  seed: { sourceRunId: 'eloq-v1', generatedAt: liveSnapshot.generatedAt, rules: [], focusTemplates: [], contextWordBanks: [] },
  state: {
    ruleOverrides: {},
    manualRules: [],
    repairs: [],
    reinforcementEvents: [],
    mutedSites: [],
    mutedTerms: [],
  },
  focusPack: { date: liveSnapshot.generatedAt, weeklyFamily: 'eloq', targetWords: [], bannedTerms: [], triggerQuestion: '', exampleRewrite: '' },
  currentSite: 'example.com',
  summary: { avoidCaught: 0, targetWins: 0, repairsCompleted: 0 },
  snapshot: liveSnapshot,
};

describe('browser extension background sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetBackgroundSyncStateForTests();
    vi.stubGlobal('fetch', fetchMock);

    peekStoredSnapshotMock.mockResolvedValue(oldSnapshot);
    getStoredSnapshotMock.mockResolvedValue(oldSnapshot);
    loadBundledSnapshotMock.mockResolvedValue(oldSnapshot);
    fetchMock.mockRejectedValue(new Error('offline'));
    getExtensionStateMock.mockResolvedValue({
      ruleOverrides: {},
      manualRules: [],
      repairs: [],
      reinforcementEvents: [],
      mutedSites: [],
      mutedTerms: [],
    });
    bootstrapPayloadMock.mockResolvedValue({
      seed: { sourceRunId: 'eloq-v1', generatedAt: oldSnapshot.generatedAt, rules: [], focusTemplates: [], contextWordBanks: [] },
      state: {
        ruleOverrides: {},
        manualRules: [],
        repairs: [],
        reinforcementEvents: [],
        mutedSites: [],
        mutedTerms: [],
      },
      focusPack: { date: oldSnapshot.generatedAt, weeklyFamily: 'eloq', targetWords: [], bannedTerms: [], triggerQuestion: '', exampleRewrite: '' },
      currentSite: 'example.com',
      summary: { avoidCaught: 0, targetWins: 0, repairsCompleted: 0 },
      snapshot: oldSnapshot,
    });
  });

  it('pulls the newest Eloq snapshot from native host and refreshes open tabs', async () => {
    sendNativeHostMessageMock.mockResolvedValue({
      seed: { sourceRunId: 'eloq-v1', generatedAt: liveSnapshot.generatedAt, rules: [], focusTemplates: [], contextWordBanks: [] },
      state: {
        ruleOverrides: {},
        manualRules: [],
        repairs: [],
        reinforcementEvents: [],
        mutedSites: [],
        mutedTerms: [],
      },
      focusPack: { date: liveSnapshot.generatedAt, weeklyFamily: 'eloq', targetWords: [], bannedTerms: [], triggerQuestion: '', exampleRewrite: '' },
      currentSite: 'example.com',
      summary: { avoidCaught: 0, targetWins: 0, repairsCompleted: 0 },
      snapshot: liveSnapshot,
    });

    await handleMessage({ type: 'awareness:request-refresh' });

    expect(sendNativeHostMessageMock).toHaveBeenCalledWith({
      type: 'awareness:get-bootstrap',
      site: 'example.com',
    });
    expect(setStoredSnapshotMock).toHaveBeenCalledWith(liveSnapshot);
    expect(setExtensionStateMock).toHaveBeenCalled();
    expect(browserMock.tabs.sendMessage).toHaveBeenCalledWith(11, { type: 'awareness:refresh' });
    expect(browserMock.tabs.sendMessage).toHaveBeenCalledWith(12, { type: 'awareness:refresh' });
  });

  it('prefers the Eloq localhost bridge when it is available', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn(async () => liveSnapshot),
    });
    bootstrapPayloadMock.mockResolvedValue(liveBootstrapPayload);

    const payload = await handleMessage({ type: 'awareness:get-bootstrap' });

    expect(sendNativeHostMessageMock).not.toHaveBeenCalled();
    expect(setStoredSnapshotMock).toHaveBeenCalledWith(liveSnapshot);
    expect(payload?.snapshot).toEqual(liveSnapshot);
  });

  it('forces a native sync when the cached snapshot is still the bundled fallback', async () => {
    bootstrapPayloadMock.mockResolvedValue(liveBootstrapPayload);
    sendNativeHostMessageMock.mockResolvedValue({
      seed: { sourceRunId: 'eloq-v1', generatedAt: liveSnapshot.generatedAt, rules: [], focusTemplates: [], contextWordBanks: [] },
      state: {
        ruleOverrides: {},
        manualRules: [],
        repairs: [],
        reinforcementEvents: [],
        mutedSites: [],
        mutedTerms: [],
      },
      focusPack: { date: liveSnapshot.generatedAt, weeklyFamily: 'eloq', targetWords: [], bannedTerms: [], triggerQuestion: '', exampleRewrite: '' },
      currentSite: 'example.com',
      summary: { avoidCaught: 0, targetWins: 0, repairsCompleted: 0 },
      snapshot: liveSnapshot,
    });

    const payload = await handleMessage({ type: 'awareness:get-bootstrap' });

    expect(sendNativeHostMessageMock).toHaveBeenCalledWith({
      type: 'awareness:get-bootstrap',
      site: 'example.com',
    });
    expect(setStoredSnapshotMock).toHaveBeenCalledWith(liveSnapshot);
    expect(payload?.snapshot).toEqual(liveSnapshot);
  });
});
