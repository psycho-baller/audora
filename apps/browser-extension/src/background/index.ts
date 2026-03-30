import { browser } from '../shared/browser';
import { sendNativeHostMessage } from '../shared/native-host';
import { bootstrapPayload, getExtensionState, getStoredSnapshot, peekStoredSnapshot, setExtensionState, setStoredSnapshot, summarizeEvents } from '../shared/storage';
import type { BackgroundMessage, BootstrapPayload, BrowserExtensionState } from '../shared/types';

const NATIVE_SYNC_THROTTLE_MS = 5_000;

let lastNativeSyncAt = 0;
let nativeSyncInFlight: Promise<BootstrapPayload | null> | null = null;

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
  const nativePayload = await syncSnapshotFromNative({ site });
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

    const nativePayload = await sendNativeHostMessage<BootstrapPayload>({
      type: 'awareness:get-bootstrap',
      site: options.site ?? '',
    });

    if (!nativePayload?.snapshot) {
      return null;
    }

    const existingSnapshot = await peekStoredSnapshot();
    const changed = snapshotFingerprint(existingSnapshot) !== snapshotFingerprint(nativePayload.snapshot);

    await setStoredSnapshot(nativePayload.snapshot);
    await markSnapshotSynced(nativePayload.snapshot);

    if (options.broadcast && changed) {
      await broadcastRefresh();
    }

    return nativePayload;
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

export function __resetBackgroundSyncStateForTests(): void {
  lastNativeSyncAt = 0;
  nativeSyncInFlight = null;
}
