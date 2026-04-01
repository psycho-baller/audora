import { browser } from '../shared/browser';
import { sendNativeHostMessage } from '../shared/native-host';
import { bootstrapPayload, getExtensionState, getStoredSnapshot, loadBundledSnapshot, peekStoredSnapshot, setExtensionState, setStoredSnapshot, summarizeEvents } from '../shared/storage';
import type { BackgroundMessage, BootstrapPayload, BrowserExtensionState } from '../shared/types';

const NATIVE_SYNC_THROTTLE_MS = 5_000;
const LOCAL_BRIDGE_SNAPSHOT_URL = 'http://127.0.0.1:43827/snapshot';
const LOCAL_BRIDGE_TIMEOUT_MS = 1_500;

let lastNativeSyncAt = 0;
let nativeSyncInFlight: Promise<BootstrapPayload | null> | null = null;
let bundledSnapshotFingerprintPromise: Promise<string> | null = null;

browser.runtime.onInstalled.addListener(async () => {
  await ensureSeedLoaded();
});

browser.runtime.onStartup.addListener(async () => {
  await ensureSeedLoaded();
});

browser.runtime.onMessage.addListener((message: unknown) => {
  return handleMessage(message as BackgroundMessage);
});

browser.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-writing-awareness') {
    return;
  }
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }
  await browser.tabs.sendMessage(tab.id, { type: 'awareness:toggle-popover' }).catch(() => undefined);
});

export async function handleMessage(message: BackgroundMessage) {
  switch (message.type) {
    case 'awareness:get-bootstrap':
      return loadMergedBootstrap(message.site ?? (await currentSite()));

    case 'awareness:reload-seed': {
      const nativePayload = await syncSnapshotFromNative({
        force: true,
        broadcast: true,
        site: await currentSite(),
      });
      if (nativePayload) {
        return mergeNativeBootstrap(nativePayload);
      }
      return bootstrapPayload(await currentSite());
    }

    case 'awareness:open-options':
      await browser.runtime.openOptionsPage();
      return { ok: true };

    case 'awareness:save-manual-rule': {
      return { ok: true };
    }

    case 'awareness:delete-manual-rule': {
      return { ok: true };
    }

    case 'awareness:update-rule-override': {
      const state = await getExtensionState();
      const nextState: BrowserExtensionState = {
        ...state,
        ruleOverrides: {
          ...state.ruleOverrides,
          [message.ruleId]: {
            ...state.ruleOverrides[message.ruleId],
            ...message.patch,
          },
        },
      };
      await setExtensionState(nextState);
      await broadcastRefresh();
      return bootstrapPayload(await currentSite());
    }

    case 'awareness:toggle-site-mute': {
      const state = await getExtensionState();
      const mutedSites = state.mutedSites.includes(message.site)
        ? state.mutedSites.filter((site) => site !== message.site)
        : [...state.mutedSites, message.site];
      const nextState: BrowserExtensionState = {
        ...state,
        mutedSites,
      };
      await setExtensionState(nextState);
      await broadcastRefresh();
      return bootstrapPayload(await currentSite());
    }

    case 'awareness:toggle-term-mute': {
      const state = await getExtensionState();
      const mutedTerms = state.mutedTerms.includes(message.term)
        ? state.mutedTerms.filter((term) => term !== message.term)
        : [...state.mutedTerms, message.term];
      const nextState: BrowserExtensionState = {
        ...state,
        mutedTerms,
      };
      await setExtensionState(nextState);
      await broadcastRefresh();
      return bootstrapPayload(await currentSite());
    }

    case 'awareness:record-events': {
      if (!message.events.length) {
        return { ok: true };
      }
      const state = await getExtensionState();
      const nextState: BrowserExtensionState = {
        ...state,
        reinforcementEvents: [...state.reinforcementEvents, ...message.events],
      };
      await setExtensionState(nextState);
      return { ok: true };
    }

    case 'awareness:request-refresh':
      await syncSnapshotFromNative({
        broadcast: true,
        site: await currentSite(),
      });
      return { ok: true };
  }
}

async function ensureSeedLoaded(): Promise<void> {
  await syncSnapshotFromNative({ force: true });

  const snapshot = await getStoredSnapshot();
  const state = await getExtensionState();
  const nextRunId = snapshotFingerprint(snapshot);
  if (state.lastSeedRunId === nextRunId) {
    return;
  }
  await setExtensionState({
    ...state,
    lastSeedRunId: nextRunId,
    lastSeedSyncedAt: new Date().toISOString(),
  });
}

async function currentSite(): Promise<string> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return '';
  }
  try {
    return new URL(tab.url).hostname;
  } catch {
    return '';
  }
}

async function broadcastRefresh(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => typeof tab.id === 'number')
      .map((tab) =>
        browser.tabs.sendMessage(tab.id!, { type: 'awareness:refresh' }).catch(() => undefined)
      )
  );
}

async function loadMergedBootstrap(site: string) {
  const existingSnapshot = await peekStoredSnapshot();
  const nativePayload = await syncSnapshotFromNative({
    force: existingSnapshot ? await isBundledFallbackSnapshot(existingSnapshot) : false,
    site,
  });
  if (nativePayload) {
    return mergeNativeBootstrap(nativePayload);
  }
  return bootstrapPayload(site);
}

async function mergeNativeBootstrap(nativePayload: BootstrapPayload) {
  const state = await getExtensionState();
  return {
    ...nativePayload,
    state: {
      ...state,
      manualRules: [],
      ruleOverrides: state.ruleOverrides ?? {},
      mutedSites: state.mutedSites ?? [],
      mutedTerms: state.mutedTerms ?? [],
      reinforcementEvents: state.reinforcementEvents ?? [],
    },
    summary: summarizeEvents(state),
  };
}

async function syncSnapshotFromNative(
  options: {
    force?: boolean;
    broadcast?: boolean;
    site?: string;
  } = {}
): Promise<BootstrapPayload | null> {
  if (nativeSyncInFlight) {
    return nativeSyncInFlight;
  }

  const force = options.force === true;
  if (!force && Date.now() - lastNativeSyncAt < NATIVE_SYNC_THROTTLE_MS) {
    return null;
  }

  const run = (async () => {
    lastNativeSyncAt = Date.now();

    const site = options.site ?? '';
    const bridgeSnapshot = await fetchSnapshotFromLocalBridge();
    if (bridgeSnapshot) {
      return await storeSnapshotAndBuildBootstrap({
        snapshot: bridgeSnapshot,
        site,
        broadcast: options.broadcast === true,
      });
    }

    const nativePayload = await sendNativeHostMessage<BootstrapPayload>({
      type: 'awareness:get-bootstrap',
      site,
    });

    if (!nativePayload?.snapshot) {
      return null;
    }

    return await storeSnapshotAndBuildBootstrap({
      snapshot: nativePayload.snapshot,
      site,
      broadcast: options.broadcast === true,
    });
  })();

  nativeSyncInFlight = run;

  try {
    return await run;
  } finally {
    if (nativeSyncInFlight === run) {
      nativeSyncInFlight = null;
    }
  }
}

async function fetchSnapshotFromLocalBridge(): Promise<BootstrapPayload['snapshot'] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_BRIDGE_TIMEOUT_MS);

  try {
    const response = await fetch(LOCAL_BRIDGE_SNAPSHOT_URL, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const snapshot = (await response.json()) as BootstrapPayload['snapshot'];
    if (!snapshot?.words || !snapshot?.connections || !snapshot?.summary) {
      return null;
    }

    return snapshot;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function storeSnapshotAndBuildBootstrap({
  snapshot,
  site,
  broadcast,
}: {
  snapshot: NonNullable<BootstrapPayload['snapshot']>;
  site: string;
  broadcast: boolean;
}): Promise<BootstrapPayload> {
  const existingSnapshot = await peekStoredSnapshot();
  const changed = snapshotFingerprint(existingSnapshot) !== snapshotFingerprint(snapshot);

  await setStoredSnapshot(snapshot);
  await markSnapshotSynced(snapshot);

  if (broadcast && changed) {
    await broadcastRefresh();
  }

  return bootstrapPayload(site);
}

async function markSnapshotSynced(snapshot: NonNullable<BootstrapPayload['snapshot']>): Promise<void> {
  const state = await getExtensionState();
  await setExtensionState({
    ...state,
    lastSeedRunId: snapshotFingerprint(snapshot),
    lastSeedSyncedAt: new Date().toISOString(),
  });
}

function snapshotFingerprint(snapshot: BootstrapPayload['snapshot'] | null | undefined): string {
  if (!snapshot) {
    return 'missing';
  }

  return [
    snapshot.version,
    snapshot.generatedAt ?? '',
    snapshot.summary?.totalWords ?? 0,
    snapshot.summary?.acceptedConnections ?? 0,
    snapshot.summary?.suggestedConnections ?? 0,
    snapshot.summary?.dismissedConnections ?? 0,
    snapshot.words?.length ?? 0,
    snapshot.connections?.length ?? 0,
  ].join('|');
}

async function bundledSnapshotFingerprint(): Promise<string> {
  bundledSnapshotFingerprintPromise ??= loadBundledSnapshot().then((snapshot) => snapshotFingerprint(snapshot));
  return bundledSnapshotFingerprintPromise;
}

async function isBundledFallbackSnapshot(
  snapshot: BootstrapPayload['snapshot'] | null | undefined
): Promise<boolean> {
  if (!snapshot) {
    return false;
  }

  return snapshotFingerprint(snapshot) === (await bundledSnapshotFingerprint());
}

export function __resetBackgroundSyncStateForTests(): void {
  lastNativeSyncAt = 0;
  nativeSyncInFlight = null;
  bundledSnapshotFingerprintPromise = null;
}
