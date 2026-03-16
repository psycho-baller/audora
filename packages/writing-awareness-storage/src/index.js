import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

export const WRITING_AWARENESS_STORAGE_ROOT = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Audora',
  'WritingAwareness'
);

export const EMPTY_WRITING_AWARENESS_STATE = Object.freeze({
  ruleOverrides: {},
  manualRules: [],
  repairs: [],
  reinforcementEvents: [],
  mutedSites: [],
  mutedTerms: [],
});

export function getWritingAwarenessStoragePaths(options = {}) {
  const rootDirectory = options.storageRoot ?? WRITING_AWARENESS_STORAGE_ROOT;
  return {
    rootDirectory,
    statePath: path.join(rootDirectory, 'state.json'),
    seedPath: path.join(rootDirectory, 'seed.json'),
    memoDirectory: path.join(rootDirectory, 'VoiceMemos'),
  };
}

export async function loadWritingAwarenessBootstrapFromDisk(options = {}) {
  const currentSite = options.currentSite ?? '';
  const [seed, state] = await Promise.all([
    loadWritingAwarenessSeedFromDisk(options),
    loadWritingAwarenessStateFromDisk(options),
  ]);

  return {
    seed,
    state,
    focusPack: resolveFocusPack(seed),
    currentSite,
    summary: summarizeWritingAwarenessEvents(state),
    storageRoot: getWritingAwarenessStoragePaths(options).rootDirectory,
  };
}

export async function loadWritingAwarenessSeedFromDisk(options = {}) {
  const { seedPath } = getWritingAwarenessStoragePaths(options);
  await ensureStorageRoot(options);
  const fallbackSeedPath = options.fallbackSeedPath ?? null;

  if (options.forceFallbackSeed && fallbackSeedPath && (await fileExists(fallbackSeedPath))) {
    const seed = JSON.parse(await fsp.readFile(fallbackSeedPath, 'utf8'));
    if (options.preferFallbackSeed) {
      await writeJSONAtomic(seedPath, seed);
    }
    return seed;
  }

  if (await fileExists(seedPath)) {
    return JSON.parse(await fsp.readFile(seedPath, 'utf8'));
  }

  if (fallbackSeedPath && (await fileExists(fallbackSeedPath))) {
    const seed = JSON.parse(await fsp.readFile(fallbackSeedPath, 'utf8'));
    if (options.preferFallbackSeed) {
      await writeJSONAtomic(seedPath, seed);
    }
    return seed;
  }

  throw new Error(`Missing writing-awareness seed at ${seedPath}`);
}

export async function loadWritingAwarenessStateFromDisk(options = {}) {
  const { statePath } = getWritingAwarenessStoragePaths(options);
  await ensureStorageRoot(options);

  if (!(await fileExists(statePath))) {
    return emptyWritingAwarenessDiskState();
  }

  try {
    const parsed = JSON.parse(await fsp.readFile(statePath, 'utf8'));
    return mergeWritingAwarenessState(parsed);
  } catch {
    return emptyWritingAwarenessDiskState();
  }
}

export async function saveWritingAwarenessStateToDisk(state, options = {}) {
  const { statePath } = getWritingAwarenessStoragePaths(options);
  await ensureStorageRoot(options);
  const normalizedState = mergeWritingAwarenessState(state);
  await writeJSONAtomic(statePath, normalizedState);
  return normalizedState;
}

export async function syncWritingAwarenessSeedToDisk(seed, options = {}) {
  const { seedPath } = getWritingAwarenessStoragePaths(options);
  await ensureStorageRoot(options);

  try {
    if (await fileExists(seedPath)) {
      const existing = JSON.parse(await fsp.readFile(seedPath, 'utf8'));
      if (existing?.sourceRunId === seed?.sourceRunId) {
        return existing;
      }
    }
  } catch {
    // Ignore malformed files and overwrite below.
  }

  await writeJSONAtomic(seedPath, seed);
  return seed;
}

export function summarizeWritingAwarenessEvents(state) {
  const today = new Date().toISOString().slice(0, 10);
  const todaysEvents = (state?.reinforcementEvents ?? []).filter((event) =>
    new Date(event.createdAt).toISOString().startsWith(today)
  );

  return {
    avoidCaught: todaysEvents.filter((event) => event.kind === 'avoid-caught').length,
    targetWins: todaysEvents.filter((event) => event.kind === 'target-used-well').length,
    repairsCompleted: todaysEvents.filter((event) => event.kind === 'repair-completed').length,
  };
}

export function emptyWritingAwarenessDiskState() {
  return mergeWritingAwarenessState({});
}

export function mergeWritingAwarenessState(state = {}) {
  return {
    ...EMPTY_WRITING_AWARENESS_STATE,
    ...state,
    ruleOverrides: state.ruleOverrides ?? {},
    manualRules: state.manualRules ?? [],
    repairs: state.repairs ?? [],
    reinforcementEvents: state.reinforcementEvents ?? [],
    mutedSites: state.mutedSites ?? [],
    mutedTerms: state.mutedTerms ?? [],
  };
}

export function upsertManualRule(rules, rule) {
  const index = rules.findIndex((entry) => entry.id === rule.id);
  if (index === -1) {
    return [...rules, rule];
  }
  return rules.map((entry, entryIndex) => (entryIndex === index ? rule : entry));
}

export function toggleListValue(items, value) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

export function normalizeLearningTargetText(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed.length) {
    return {
      ok: false,
      message: 'Select a word or short phrase first.',
      suggestedTerm: '',
    };
  }

  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    return {
      ok: false,
      message: 'Only a single line can be added to learning words.',
      suggestedTerm: trimmed,
    };
  }

  const collapsed = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
  const cleaned = stripLearningTargetBoundaryCharacters(collapsed);

  if (!cleaned.length) {
    return {
      ok: false,
      message: 'Select a word or short phrase first.',
      suggestedTerm: '',
    };
  }

  const words = cleaned.split(' ');
  if (words.length > 4) {
    return {
      ok: false,
      message: 'Learning words can be up to four words long.',
      suggestedTerm: cleaned,
    };
  }

  if (cleaned.length > 80) {
    return {
      ok: false,
      message: 'Learning words must stay under 80 characters.',
      suggestedTerm: cleaned,
    };
  }

  return {
    ok: true,
    term: cleaned,
  };
}

export function makeLearningTargetReplacementOptions(term) {
  return [
    {
      word: term,
      useWhen: 'Use this when it makes the sentence more precise and natural.',
      caution: 'Keep it only where it genuinely improves the wording.',
    },
  ];
}

export function saveLearningTargetToState(input) {
  const nextState = mergeWritingAwarenessState(input.state);
  const normalized = normalizeLearningTargetText(input.text);

  if (!normalized.ok) {
    return {
      state: nextState,
      result: {
        status: 'invalid',
        term: normalized.suggestedTerm,
        ruleID: null,
        message: normalized.message,
      },
    };
  }

  const term = normalized.term;
  const normalizedTerm = term.toLowerCase();
  const existingIndex = nextState.manualRules.findIndex(
    (rule) => rule.type === 'target' && String(rule.term ?? '').trim().toLowerCase() === normalizedTerm
  );

  if (existingIndex >= 0) {
    const existingRule = { ...nextState.manualRules[existingIndex] };
    let didChange = false;

    if (!existingRule.active) {
      existingRule.active = true;
      didChange = true;
    }
    if (!existingRule.pinned) {
      existingRule.pinned = true;
      didChange = true;
    }
    if ((existingRule.priority ?? 0) < 5) {
      existingRule.priority = 5;
      didChange = true;
    }
    if (!Array.isArray(existingRule.replacementOptions) || !existingRule.replacementOptions.length) {
      existingRule.replacementOptions = makeLearningTargetReplacementOptions(existingRule.term);
      didChange = true;
    }

    if (didChange) {
      nextState.manualRules = nextState.manualRules.map((rule, index) =>
        index === existingIndex ? existingRule : rule
      );
    }

    return {
      state: nextState,
      result: {
        status: 'alreadyExists',
        term: existingRule.term,
        ruleID: existingRule.id,
        message: `"${existingRule.term}" is already in your learning words.`,
      },
    };
  }

  const sourceApp = input.sourceApp ?? 'Obsidian';
  const contextLabel = input.contextLabel ?? sourceApp;
  const newRule = {
    id: `manual:${randomId()}`,
    type: 'target',
    term,
    replacementOptions: makeLearningTargetReplacementOptions(term),
    contexts: contextLabel === sourceApp ? [] : [contextLabel],
    source: 'manual',
    active: true,
    priority: 5,
    notes: '',
    family: 'manual',
    pinned: true,
  };

  nextState.manualRules = [...nextState.manualRules, newRule];

  return {
    state: nextState,
    result: {
      status: 'saved',
      term,
      ruleID: newRule.id,
      message:
        input.origin === 'service'
          ? `Saved "${term}" to your learning words.`
          : `Saved "${term}" to your learning words from the ${input.origin ?? 'selection'}.`,
    },
  };
}

function resolveFocusPack(seed) {
  const templates = seed?.focusTemplates ?? [];
  if (!templates.length) {
    return {
      date: new Date().toISOString(),
      weeklyFamily: 'manual',
      targetWords: [],
      bannedTerms: [],
      triggerQuestion: 'What exact word would make this more precise?',
      exampleRewrite: '',
    };
  }

  const selected = focusTemplateForDate(templates, new Date());
  return {
    date: new Date().toISOString(),
    weeklyFamily: selected.family,
    targetWords: selected.targetWords,
    bannedTerms: selected.bannedTerms,
    triggerQuestion: selected.triggerQuestion,
    exampleRewrite: selected.exampleRewrite,
  };
}

function focusTemplateForDate(templates, date) {
  const week = isoWeek(date);
  const year = weekYear(date);
  const index = Math.abs((week + year) % templates.length);
  return templates[index];
}

function isoWeek(date) {
  const working = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = working.getUTCDay() || 7;
  working.setUTCDate(working.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(working.getUTCFullYear(), 0, 1));
  return Math.ceil(((working - yearStart) / 86400000 + 1) / 7);
}

function weekYear(date) {
  const working = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = working.getUTCDay() || 7;
  working.setUTCDate(working.getUTCDate() + 4 - dayNumber);
  return working.getUTCFullYear();
}

async function ensureStorageRoot(options) {
  const { rootDirectory, memoDirectory } = getWritingAwarenessStoragePaths(options);
  await fsp.mkdir(rootDirectory, { recursive: true });
  await fsp.mkdir(memoDirectory, { recursive: true });
}

async function fileExists(targetPath) {
  try {
    await fsp.access(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeJSONAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsp.rename(tempPath, filePath);
}

function stripLearningTargetBoundaryCharacters(value) {
  let start = 0;
  let end = value.length;

  while (start < end && isBoundaryCharacter(value.codePointAt(start))) {
    start += codePointLength(value.codePointAt(start));
  }
  while (end > start) {
    const codePoint = value.codePointAt(end - 1);
    const width = codePointLength(codePoint);
    const scalar = value.codePointAt(end - width);
    if (!isBoundaryCharacter(scalar)) {
      break;
    }
    end -= width;
  }

  return value.slice(start, end);
}

function isBoundaryCharacter(codePoint) {
  if (typeof codePoint !== 'number') {
    return false;
  }

  const character = String.fromCodePoint(codePoint);
  return /[\p{White_Space}\p{Punctuation}\p{Symbol}]/u.test(character);
}

function codePointLength(codePoint) {
  return typeof codePoint === 'number' && codePoint > 0xffff ? 2 : 1;
}

function randomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().toLowerCase();
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
