#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const STORAGE_ROOT = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Audora',
  'WritingAwareness'
);
const STATE_PATH = path.join(STORAGE_ROOT, 'state.json');
const SEED_PATH = path.join(STORAGE_ROOT, 'seed.json');
const FALLBACK_SEED_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  'public',
  'WritingAwarenessSeed.json'
);

const EMPTY_STATE = {
  ruleOverrides: {},
  manualRules: [],
  repairs: [],
  reinforcementEvents: [],
  mutedSites: [],
  mutedTerms: [],
};

let stdinBuffer = Buffer.alloc(0);

process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
    parseMessages();
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

function parseMessages() {
  while (stdinBuffer.length >= 4) {
    const messageLength = stdinBuffer.readUInt32LE(0);
    if (stdinBuffer.length < messageLength + 4) {
      return;
    }

    const messageBuffer = stdinBuffer.subarray(4, messageLength + 4);
    stdinBuffer = stdinBuffer.subarray(messageLength + 4);

    try {
      const message = JSON.parse(messageBuffer.toString('utf8'));
      Promise.resolve(handleMessage(message))
        .then((response) => writeMessage(response))
        .catch((error) => writeMessage({ error: error instanceof Error ? error.message : String(error) }));
    } catch (error) {
      writeMessage({ error: error instanceof Error ? error.message : 'Invalid native host message' });
    }
  }
}

function writeMessage(value) {
  const json = Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

async function handleMessage(message) {
  switch (message.type) {
    case 'awareness:get-bootstrap':
      return bootstrapPayload(message.site ?? '');

    case 'awareness:reload-seed': {
      const seed = await loadSeed({ preferFallback: true });
      const state = await loadState();
      const nextState = {
        ...state,
        lastSeedRunId: seed.sourceRunId,
        lastSeedSyncedAt: new Date().toISOString(),
      };
      await saveState(nextState);
      return bootstrapPayload(message.site ?? '');
    }

    case 'awareness:save-manual-rule': {
      const state = await loadState();
      const manualRules = upsertRule(state.manualRules, message.rule);
      await saveState({ ...state, manualRules });
      return bootstrapPayload(message.site ?? '');
    }

    case 'awareness:delete-manual-rule': {
      const state = await loadState();
      await saveState({
        ...state,
        manualRules: state.manualRules.filter((rule) => rule.id !== message.ruleId),
      });
      return bootstrapPayload(message.site ?? '');
    }

    case 'awareness:update-rule-override': {
      const state = await loadState();
      await saveState({
        ...state,
        ruleOverrides: {
          ...state.ruleOverrides,
          [message.ruleId]: {
            ...(state.ruleOverrides[message.ruleId] ?? {}),
            ...message.patch,
          },
        },
      });
      return bootstrapPayload(message.site ?? '');
    }

    case 'awareness:toggle-site-mute': {
      const state = await loadState();
      const mutedSites = state.mutedSites.includes(message.site)
        ? state.mutedSites.filter((site) => site !== message.site)
        : [...state.mutedSites, message.site];
      await saveState({ ...state, mutedSites });
      return bootstrapPayload(message.site ?? '');
    }

    case 'awareness:toggle-term-mute': {
      const state = await loadState();
      const mutedTerms = state.mutedTerms.includes(message.term)
        ? state.mutedTerms.filter((term) => term !== message.term)
        : [...state.mutedTerms, message.term];
      await saveState({ ...state, mutedTerms });
      return bootstrapPayload(message.site ?? '');
    }

    case 'awareness:record-events': {
      const state = await loadState();
      await saveState({
        ...state,
        reinforcementEvents: [...state.reinforcementEvents, ...(message.events ?? [])],
      });
      return { ok: true };
    }

    case 'awareness:request-refresh':
      return { ok: true };

    default:
      return { error: `Unsupported message type: ${message.type}` };
  }
}

async function bootstrapPayload(site = '') {
  const [seed, state] = await Promise.all([loadSeed(), loadState()]);
  return {
    seed,
    state,
    focusPack: resolveFocusPack(seed),
    currentSite: site,
    summary: summarizeEvents(state),
  };
}

async function loadSeed(options = {}) {
  ensureStorageRoot();
  if (fs.existsSync(SEED_PATH)) {
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  }

  if (options.preferFallback && fs.existsSync(FALLBACK_SEED_PATH)) {
    const seed = JSON.parse(fs.readFileSync(FALLBACK_SEED_PATH, 'utf8'));
    fs.writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }

  if (fs.existsSync(FALLBACK_SEED_PATH)) {
    return JSON.parse(fs.readFileSync(FALLBACK_SEED_PATH, 'utf8'));
  }

  throw new Error(`Missing writing-awareness seed at ${SEED_PATH}`);
}

async function loadState() {
  ensureStorageRoot();
  if (!fs.existsSync(STATE_PATH)) {
    return { ...EMPTY_STATE };
  }

  try {
    return {
      ...EMPTY_STATE,
      ...JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')),
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

async function saveState(state) {
  ensureStorageRoot();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function summarizeEvents(state) {
  const today = new Date().toISOString().slice(0, 10);
  const todaysEvents = (state.reinforcementEvents ?? []).filter((event) =>
    new Date(event.createdAt).toISOString().startsWith(today)
  );

  return {
    avoidCaught: todaysEvents.filter((event) => event.kind === 'avoid-caught').length,
    targetWins: todaysEvents.filter((event) => event.kind === 'target-used-well').length,
    repairsCompleted: todaysEvents.filter((event) => event.kind === 'repair-completed').length,
  };
}

function resolveFocusPack(seed) {
  const templates = seed.focusTemplates ?? [];
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

  const today = new Date();
  const selected = focusTemplateForDate(templates, today);
  return {
    date: today.toISOString(),
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
  return Math.ceil((((working - yearStart) / 86400000) + 1) / 7);
}

function weekYear(date) {
  const working = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = working.getUTCDay() || 7;
  working.setUTCDate(working.getUTCDate() + 4 - dayNumber);
  return working.getUTCFullYear();
}

function upsertRule(rules, rule) {
  const index = rules.findIndex((entry) => entry.id === rule.id);
  if (index === -1) {
    return [...rules, rule];
  }
  return rules.map((entry, entryIndex) => (entryIndex === index ? rule : entry));
}

function ensureStorageRoot() {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

