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

export const ELOQ_STORAGE_ROOT = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Eloq'
);

export const ELOQ_SANDBOX_STORAGE_ROOT = path.join(
  os.homedir(),
  'Library',
  'Containers',
  'studio.orbitlabs.Eloq',
  'Data',
  'Library',
  'Application Support',
  'Eloq'
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

export function getEloqStoragePaths(options = {}) {
  const rootDirectory = resolveEloqStorageRoot(options);
  return {
    rootDirectory,
    snapshotPath: path.join(rootDirectory, 'snapshot.json'),
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

export async function loadEloqBootstrapFromDisk(options = {}) {
  const currentSite = options.currentSite ?? '';
  const snapshot = await loadEloqSnapshotFromDisk(options);
  const seed = deriveWritingAwarenessSeedFromEloqSnapshot(snapshot);
  const state = mergeWritingAwarenessState(options.localState ?? {});

  return {
    seed,
    state,
    focusPack: resolveFocusPack(seed),
    currentSite,
    summary: summarizeWritingAwarenessEvents(state),
    storageRoot: getEloqStoragePaths(options).rootDirectory,
    snapshot,
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

export async function loadEloqSnapshotFromDisk(options = {}) {
  const { snapshotPath } = getEloqStoragePaths(options);
  await ensureEloqRoot(options);
  const fallbackSnapshotPath = options.fallbackSnapshotPath ?? null;

  if (
    options.forceFallbackSnapshot &&
    fallbackSnapshotPath &&
    (await fileExists(fallbackSnapshotPath))
  ) {
    const snapshot = JSON.parse(await fsp.readFile(fallbackSnapshotPath, 'utf8'));
    if (options.preferFallbackSnapshot) {
      await writeJSONAtomic(snapshotPath, snapshot);
    }
    return snapshot;
  }

  if (await fileExists(snapshotPath)) {
    return JSON.parse(await fsp.readFile(snapshotPath, 'utf8'));
  }

  if (fallbackSnapshotPath && (await fileExists(fallbackSnapshotPath))) {
    const snapshot = JSON.parse(await fsp.readFile(fallbackSnapshotPath, 'utf8'));
    if (options.preferFallbackSnapshot) {
      await writeJSONAtomic(snapshotPath, snapshot);
    }
    return snapshot;
  }

  throw new Error(`Missing Eloq snapshot at ${snapshotPath}`);
}

export function deriveWritingAwarenessSeedFromEloqSnapshot(snapshot) {
  const words = Array.isArray(snapshot?.words) ? snapshot.words : [];
  const connections = Array.isArray(snapshot?.connections) ? snapshot.connections : [];
  const wordsById = new Map(words.map((word) => [String(word.id), word]));
  const acceptedConnections = connections.filter((connection) => connection.status === 'accepted');

  const avoidGroups = new Map();
  const targetTerms = new Map();

  for (const connection of acceptedConnections) {
    const overusedWord = wordsById.get(String(connection.overusedWordID));
    const underusedWord = wordsById.get(String(connection.underusedWordID));
    const overusedTerm = String(connection.overusedTerm ?? overusedWord?.displayTerm ?? '').trim();
    const underusedTerm = String(connection.underusedTerm ?? underusedWord?.displayTerm ?? '').trim();

    if (!overusedTerm || !underusedTerm) {
      continue;
    }

    const overusedKey = normalizeComparableTerm(overusedTerm);
    const underusedKey = normalizeComparableTerm(underusedTerm);
    if (!overusedKey || !underusedKey) {
      continue;
    }

    const existingGroup = avoidGroups.get(overusedKey) ?? {
      term: overusedTerm,
      replacements: [],
      notes: String(connection.rationale ?? '').trim(),
    };

    if (!existingGroup.replacements.some((entry) => normalizeComparableTerm(entry.word) === underusedKey)) {
      existingGroup.replacements.push({
        word: underusedTerm,
        useWhen:
          String(connection.useWhen ?? '').trim() ||
          `Use "${underusedTerm}" when it sharpens the meaning naturally.`,
        caution:
          String(connection.caution ?? '').trim() ||
          'Skip it if the replacement becomes forced.',
      });
    }

    avoidGroups.set(overusedKey, existingGroup);
    targetTerms.set(underusedKey, underusedTerm);
  }

  for (const word of words) {
    const roles = Array.isArray(word.roles) ? word.roles : [];
    const term = String(word.displayTerm ?? '').trim();
    const key = normalizeComparableTerm(term);
    if (!term || !key) {
      continue;
    }

    if (roles.includes('underused') && !targetTerms.has(key)) {
      targetTerms.set(key, term);
    }

    if (roles.includes('overused') && !avoidGroups.has(key)) {
      avoidGroups.set(key, {
        term,
        replacements: [],
        notes: String(word.notes ?? '').trim(),
      });
    }
  }

  const rules = [];
  const bannedTerms = [];
  const focusWords = [];

  for (const [key, group] of avoidGroups.entries()) {
    bannedTerms.push(group.term);
    rules.push({
      id: `eloq:avoid:${key}`,
      type: 'avoid',
      term: group.term,
      replacementOptions: group.replacements,
      contexts: [],
      source: 'manual',
      active: true,
      priority: 5,
      notes: group.notes || 'Imported from Eloq.',
      family: 'eloq',
      pinned: true,
    });
  }

  for (const [key, term] of targetTerms.entries()) {
    focusWords.push(term);
    rules.push({
      id: `eloq:target:${key}`,
      type: 'target',
      term,
      replacementOptions: [
        {
          word: term,
          useWhen: `Reward "${term}" when it is the sharper, more precise choice.`,
          caution: 'Do not force the stronger word into a sentence that wants something simpler.',
        },
      ],
      contexts: [],
      source: 'manual',
      active: true,
      priority: 4,
      notes: 'Imported from Eloq.',
      family: 'eloq',
      pinned: true,
    });
  }

  const exampleConnection = acceptedConnections[0];
  const exampleRewrite = exampleConnection
    ? `${exampleConnection.overusedTerm} -> ${exampleConnection.underusedTerm}`
    : '';

  return {
    sourceRunId: `eloq-v${snapshot?.version ?? 1}`,
    generatedAt: snapshot?.generatedAt ?? new Date().toISOString(),
    rules,
    focusTemplates: [
      {
        family: 'eloq',
        targetWords: focusWords.slice(0, 12),
        bannedTerms: bannedTerms.slice(0, 12),
        triggerQuestion: 'What sharper word would make this sentence more exact?',
        exampleRewrite,
      },
    ],
    contextWordBanks: [],
  };
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

async function ensureEloqRoot(options) {
  const { rootDirectory } = getEloqStoragePaths(options);
  await fsp.mkdir(rootDirectory, { recursive: true });
}

function resolveEloqStorageRoot(options = {}) {
  if (options.storageRoot) {
    return options.storageRoot;
  }

  const candidates = Array.isArray(options.storageRootCandidates) && options.storageRootCandidates.length
    ? options.storageRootCandidates
    : [
        options.sandboxStorageRoot ?? ELOQ_SANDBOX_STORAGE_ROOT,
        ELOQ_STORAGE_ROOT,
      ];

  for (const rootDirectory of candidates) {
    if (fileExistsSync(path.join(rootDirectory, 'snapshot.json'))) {
      return rootDirectory;
    }
  }

  return candidates[0] ?? ELOQ_STORAGE_ROOT;
}

async function fileExists(targetPath) {
  try {
    await fsp.access(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function fileExistsSync(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
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

function normalizeComparableTerm(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}
