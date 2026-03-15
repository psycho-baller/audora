import { resolveFocusPack, type VocabularyRule } from '@audora/writing-awareness-core';

import { browser } from '../shared/browser';
import { sendNativeHostMessage } from '../shared/native-host';
import { bootstrapPayload, getExtensionState, getStoredSeed, loadBundledSeed, setExtensionState, setStoredSeed } from '../shared/storage';
import type { BackgroundMessage, BrowserExtensionState } from '../shared/types';

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
      return (
        (await sendNativeHostMessage(message)) ??
        bootstrapPayload(message.site ?? (await currentSite()))
      );

    case 'awareness:reload-seed': {
      const nativePayload = await sendNativeHostMessage(message);
      if (nativePayload) {
        await broadcastRefresh();
        return nativePayload;
      }
      const seed = await loadBundledSeed();
      await setStoredSeed(seed);
      const state = await getExtensionState();
      const nextState: BrowserExtensionState = {
        ...state,
        lastSeedRunId: seed.sourceRunId,
        lastSeedSyncedAt: new Date().toISOString(),
      };
      await setExtensionState(nextState);
      await broadcastRefresh();
      return {
        seed,
        state: nextState,
        focusPack: resolveFocusPack(seed),
        currentSite: await currentSite(),
        summary: {
          avoidCaught: 0,
          targetWins: 0,
          repairsCompleted: 0,
        },
      };
    }

    case 'awareness:open-options':
      await browser.runtime.openOptionsPage();
      return { ok: true };

    case 'awareness:save-manual-rule': {
      const nativePayload = await sendNativeHostMessage(message);
      if (nativePayload) {
        await broadcastRefresh();
        return nativePayload;
      }
      const state = await getExtensionState();
      const nextRules = upsertRule(state.manualRules, message.rule);
      const nextState: BrowserExtensionState = {
        ...state,
        manualRules: nextRules,
      };
      await setExtensionState(nextState);
      await broadcastRefresh();
      return bootstrapPayload(await currentSite());
    }

    case 'awareness:delete-manual-rule': {
      const nativePayload = await sendNativeHostMessage(message);
      if (nativePayload) {
        await broadcastRefresh();
        return nativePayload;
      }
      const state = await getExtensionState();
      const nextState: BrowserExtensionState = {
        ...state,
        manualRules: state.manualRules.filter((rule) => rule.id !== message.ruleId),
      };
      await setExtensionState(nextState);
      await broadcastRefresh();
      return bootstrapPayload(await currentSite());
    }

    case 'awareness:update-rule-override': {
      const nativePayload = await sendNativeHostMessage(message);
      if (nativePayload) {
        await broadcastRefresh();
        return nativePayload;
      }
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
      const nativePayload = await sendNativeHostMessage(message);
      if (nativePayload) {
        await broadcastRefresh();
        return nativePayload;
      }
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
      const nativePayload = await sendNativeHostMessage(message);
      if (nativePayload) {
        await broadcastRefresh();
        return nativePayload;
      }
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
      const nativeResponse = await sendNativeHostMessage(message);
      if (nativeResponse) {
        return nativeResponse;
      }
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
  const seed = await getStoredSeed();
  const state = await getExtensionState();
  if (state.lastSeedRunId === seed.sourceRunId) {
    return;
  }
  await setExtensionState({
    ...state,
    lastSeedRunId: seed.sourceRunId,
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

function upsertRule(rules: VocabularyRule[], rule: VocabularyRule): VocabularyRule[] {
  const index = rules.findIndex((entry) => entry.id === rule.id);
  if (index === -1) {
    return [...rules, rule];
  }
  return rules.map((entry, entryIndex) => (entryIndex === index ? rule : entry));
}
