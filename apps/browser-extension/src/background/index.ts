import { browser } from '../shared/browser';
import { sendNativeHostMessage } from '../shared/native-host';
import { bootstrapPayload, getExtensionState, getStoredSnapshot, loadBundledSnapshot, setExtensionState, setStoredSnapshot, summarizeEvents } from '../shared/storage';
import type { BackgroundMessage, BootstrapPayload, BrowserExtensionState } from '../shared/types';

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

async function handleMessage(message: BackgroundMessage) {
  switch (message.type) {
    case 'awareness:get-bootstrap':
      return loadMergedBootstrap(message.site ?? (await currentSite()));

    case 'awareness:reload-seed': {
      const nativePayload = await sendNativeHostMessage<BootstrapPayload>(message);
      if (nativePayload) {
        if (nativePayload.snapshot) {
          await setStoredSnapshot(nativePayload.snapshot);
        }
        await broadcastRefresh();
        return mergeNativeBootstrap(nativePayload);
      }
      const snapshot = await loadBundledSnapshot();
      await setStoredSnapshot(snapshot);
      const state = await getExtensionState();
      const nextState: BrowserExtensionState = {
        ...state,
        lastSeedRunId: `eloq-v${snapshot.version}`,
        lastSeedSyncedAt: new Date().toISOString(),
      };
      await setExtensionState(nextState);
      await broadcastRefresh();
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
      await sendNativeHostMessage(message);
      await broadcastRefresh();
      return { ok: true };
  }
}

async function ensureSeedLoaded(): Promise<void> {
  const snapshot = await getStoredSnapshot();
  const state = await getExtensionState();
  const nextRunId = `eloq-v${snapshot.version}`;
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
  const nativePayload = await sendNativeHostMessage<BootstrapPayload>({
    type: 'awareness:get-bootstrap',
    site,
  });
  if (nativePayload) {
    if (nativePayload.snapshot) {
      await setStoredSnapshot(nativePayload.snapshot);
    }
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
