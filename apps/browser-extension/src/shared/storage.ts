import {
  emptyWritingAwarenessState,
  resolveFocusPack,
  type WritingAwarenessSeed,
} from '@audora/writing-awareness-core';
import type { EloqSnapshotReadModel } from '@audora/writing-awareness-storage';

import { browser } from './browser';
import type { BootstrapPayload, BrowserExtensionState, WritingSummary } from './types';

const STATE_KEY = 'eloq-browser-state';
const SNAPSHOT_KEY = 'eloq-snapshot';

export async function loadBundledSnapshot(): Promise<EloqSnapshotReadModel> {
  const url = browser.runtime.getURL('EloqSnapshot.json');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load bundled Eloq snapshot: ${response.status}`);
  }
  return response.json() as Promise<EloqSnapshotReadModel>;
}

export async function getStoredSnapshot(): Promise<EloqSnapshotReadModel> {
  const existing = await browser.storage.local.get(SNAPSHOT_KEY);
  if (existing[SNAPSHOT_KEY]) {
    return existing[SNAPSHOT_KEY] as EloqSnapshotReadModel;
  }
  const bundled = await loadBundledSnapshot();
  await browser.storage.local.set({ [SNAPSHOT_KEY]: bundled });
  return bundled;
}

export async function peekStoredSnapshot(): Promise<EloqSnapshotReadModel | null> {
  const existing = await browser.storage.local.get(SNAPSHOT_KEY);
  return (existing[SNAPSHOT_KEY] as EloqSnapshotReadModel | undefined) ?? null;
}

export async function setStoredSnapshot(snapshot: EloqSnapshotReadModel): Promise<void> {
  await browser.storage.local.set({ [SNAPSHOT_KEY]: snapshot });
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
  const [snapshot, state] = await Promise.all([getStoredSnapshot(), getExtensionState()]);
  const seed = deriveSeedFromSnapshot(snapshot);

  return {
    seed,
    state,
    focusPack: resolveFocusPack(seed),
    currentSite: site,
    summary: summarizeEvents(state),
    snapshot,
  };
}

function deriveSeedFromSnapshot(snapshot: EloqSnapshotReadModel): WritingAwarenessSeed {
  const wordsById = new Map(snapshot.words.map((word) => [word.id, word]));
  const acceptedConnections = snapshot.connections.filter((connection) => connection.status === 'accepted');
  const avoidGroups = new Map<string, { term: string; replacements: Array<{ word: string; useWhen: string; caution: string }>; notes: string }>();
  const targetTerms = new Map<string, string>();

  for (const connection of acceptedConnections) {
    const overusedWord = wordsById.get(connection.overusedWordID);
    const underusedWord = wordsById.get(connection.underusedWordID);
    const overusedTerm = (connection.overusedTerm || overusedWord?.displayTerm || '').trim();
    const underusedTerm = (connection.underusedTerm || underusedWord?.displayTerm || '').trim();
    const overusedKey = normalizeComparableTerm(overusedTerm);
    const underusedKey = normalizeComparableTerm(underusedTerm);

    if (!overusedKey || !underusedKey) {
      continue;
    }

    const group = avoidGroups.get(overusedKey) ?? {
      term: overusedTerm,
      replacements: [],
      notes: connection.rationale?.trim() || 'Imported from Eloq.',
    };
    if (!group.replacements.some((entry) => normalizeComparableTerm(entry.word) === underusedKey)) {
      group.replacements.push({
        word: underusedTerm,
        useWhen: connection.useWhen?.trim() || `Use "${underusedTerm}" when it is more precise.`,
        caution: connection.caution?.trim() || 'Skip it if the sentence becomes forced.',
      });
    }
    avoidGroups.set(overusedKey, group);
    targetTerms.set(underusedKey, underusedTerm);
  }

  for (const word of snapshot.words) {
    const key = normalizeComparableTerm(word.displayTerm);
    if (!key) {
      continue;
    }
    if (word.roles.includes('underused') && !targetTerms.has(key)) {
      targetTerms.set(key, word.displayTerm);
    }
    if (word.roles.includes('overused') && !avoidGroups.has(key)) {
      avoidGroups.set(key, {
        term: word.displayTerm,
        replacements: [],
        notes: word.notes?.trim() || 'Imported from Eloq.',
      });
    }
  }

  const rules = [
    ...Array.from(avoidGroups.entries()).map(([key, group]) => ({
      id: `eloq:avoid:${key}`,
      type: 'avoid' as const,
      term: group.term,
      replacementOptions: group.replacements,
      contexts: [],
      source: 'manual' as const,
      active: true,
      priority: 5,
      notes: group.notes,
      family: 'eloq',
      pinned: true,
    })),
    ...Array.from(targetTerms.entries()).map(([key, term]) => ({
      id: `eloq:target:${key}`,
      type: 'target' as const,
      term,
      replacementOptions: [
        {
          word: term,
          useWhen: `Reward "${term}" when it is the sharper choice.`,
          caution: 'Do not force it into a sentence that wants something simpler.',
        },
      ],
      contexts: [],
      source: 'manual' as const,
      active: true,
      priority: 4,
      notes: 'Imported from Eloq.',
      family: 'eloq',
      pinned: true,
    })),
  ];

  const example = acceptedConnections[0];

  return {
    sourceRunId: `eloq-v${snapshot.version}`,
    generatedAt: snapshot.generatedAt,
    rules,
    focusTemplates: [
      {
        family: 'eloq',
        targetWords: Array.from(targetTerms.values()).slice(0, 12),
        bannedTerms: Array.from(avoidGroups.values()).map((group) => group.term).slice(0, 12),
        triggerQuestion: 'What sharper word would make this sentence more exact?',
        exampleRewrite: example ? `${example.overusedTerm} -> ${example.underusedTerm}` : '',
      },
    ],
    contextWordBanks: [],
  };
}

function normalizeComparableTerm(value: string): string {
  return value.trim().toLowerCase();
}
