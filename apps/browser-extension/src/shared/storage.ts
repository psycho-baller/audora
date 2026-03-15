import {
  emptyWritingAwarenessState,
  resolveFocusPack,
  type WritingAwarenessSeed,
} from '@audora/writing-awareness-core';

import { browser } from './browser';
import type { BootstrapPayload, BrowserExtensionState, WritingSummary } from './types';

const STATE_KEY = 'audora-writing-awareness-state';
const SEED_KEY = 'audora-writing-awareness-seed';

export async function loadBundledSeed(): Promise<WritingAwarenessSeed> {
  const url = browser.runtime.getURL('WritingAwarenessSeed.json');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load bundled seed: ${response.status}`);
  }
  return response.json() as Promise<WritingAwarenessSeed>;
}

export async function getStoredSeed(): Promise<WritingAwarenessSeed> {
  const existing = await browser.storage.local.get(SEED_KEY);
  if (existing[SEED_KEY]) {
    return existing[SEED_KEY] as WritingAwarenessSeed;
  }
  const bundled = await loadBundledSeed();
  await browser.storage.local.set({ [SEED_KEY]: bundled });
  return bundled;
}

export async function setStoredSeed(seed: WritingAwarenessSeed): Promise<void> {
  await browser.storage.local.set({ [SEED_KEY]: seed });
}

export async function getExtensionState(): Promise<BrowserExtensionState> {
  const existing = await browser.storage.local.get(STATE_KEY);
  if (existing[STATE_KEY]) {
    const state = existing[STATE_KEY] as BrowserExtensionState;
    return {
      ...emptyWritingAwarenessState(),
      ...state,
      ruleOverrides: state.ruleOverrides ?? {},
      manualRules: state.manualRules ?? [],
      repairs: state.repairs ?? [],
      reinforcementEvents: state.reinforcementEvents ?? [],
      mutedSites: state.mutedSites ?? [],
      mutedTerms: state.mutedTerms ?? [],
    };
  }

  return {
    ...emptyWritingAwarenessState(),
  };
}

export async function setExtensionState(state: BrowserExtensionState): Promise<void> {
  await browser.storage.local.set({ [STATE_KEY]: state });
}

export function summarizeEvents(state: BrowserExtensionState): WritingSummary {
  const today = new Date().toISOString().slice(0, 10);
  const todaysEvents = state.reinforcementEvents.filter((event) =>
    new Date(event.createdAt).toISOString().startsWith(today)
  );

  return {
    avoidCaught: todaysEvents.filter((event) => event.kind === 'avoid-caught').length,
    targetWins: todaysEvents.filter((event) => event.kind === 'target-used-well').length,
    repairsCompleted: todaysEvents.filter((event) => event.kind === 'repair-completed').length,
  };
}

export async function bootstrapPayload(site = ''): Promise<BootstrapPayload> {
  const [seed, state] = await Promise.all([getStoredSeed(), getExtensionState()]);
  return {
    seed,
    state,
    focusPack: resolveFocusPack(seed),
    currentSite: site,
    summary: summarizeEvents(state),
  };
}
