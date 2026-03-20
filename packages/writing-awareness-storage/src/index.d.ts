import type {
  FocusPack,
  RepairEntry,
  ReinforcementEvent,
  VocabularyRule,
  VocabularyRuleOverride,
  WritingAwarenessSeed,
} from '@audora/writing-awareness-core';

export interface WritingAwarenessStorageOptions {
  storageRoot?: string;
  sandboxStorageRoot?: string;
  storageRootCandidates?: string[];
  fallbackSeedPath?: string | null;
  preferFallbackSeed?: boolean;
  forceFallbackSeed?: boolean;
  fallbackSnapshotPath?: string | null;
  preferFallbackSnapshot?: boolean;
  forceFallbackSnapshot?: boolean;
  localState?: Partial<WritingAwarenessDiskState>;
}

export interface WritingAwarenessDiskState {
  ruleOverrides: Record<string, VocabularyRuleOverride>;
  manualRules: VocabularyRule[];
  repairs: RepairEntry[];
  reinforcementEvents: ReinforcementEvent[];
  mutedSites: string[];
  mutedTerms: string[];
  lastSeedRunId?: string;
  lastSeedSyncedAt?: string;
}

export interface WritingSummary {
  avoidCaught: number;
  targetWins: number;
  repairsCompleted: number;
}

export interface DiskBootstrapPayload {
  seed: WritingAwarenessSeed;
  state: WritingAwarenessDiskState;
  focusPack: FocusPack;
  currentSite: string;
  summary: WritingSummary;
  storageRoot: string;
  snapshot?: EloqSnapshotReadModel;
}

export interface EloqSnapshotSummary {
  totalWords: number;
  overusedWords: number;
  underusedWords: number;
  acceptedConnections: number;
  suggestedConnections: number;
  dismissedConnections: number;
}

export interface EloqSnapshotWord {
  id: string;
  displayTerm: string;
  normalizedTerm: string;
  roles: string[];
  notes: string;
  sourceExcerpt: string;
  exampleUsage: string;
  contexts: string[];
  provenance: string;
}

export interface EloqSnapshotConnection {
  id: string;
  overusedWordID: string;
  overusedTerm: string;
  underusedWordID: string;
  underusedTerm: string;
  origin: string;
  status: string;
  rationale: string;
  useWhen: string;
  caution: string;
  sourceExcerpt: string;
  exampleUsage: string;
  confidence: number;
}

export interface EloqSnapshotReadModel {
  version: number;
  generatedAt: string | Date;
  summary: EloqSnapshotSummary;
  words: EloqSnapshotWord[];
  connections: EloqSnapshotConnection[];
}

export interface LearningTargetSaveResult {
  status: 'saved' | 'alreadyExists' | 'invalid';
  term: string;
  ruleID: string | null;
  message: string;
}

export type LearningTargetNormalizationResult =
  | { ok: true; term: string }
  | { ok: false; message: string; suggestedTerm: string };

export interface SaveLearningTargetInput {
  state: Partial<WritingAwarenessDiskState>;
  text: string;
  sourceApp?: string;
  contextLabel?: string;
  origin?: string;
}

export interface SaveLearningTargetOutput {
  state: WritingAwarenessDiskState;
  result: LearningTargetSaveResult;
}

export interface WritingAwarenessStoragePaths {
  rootDirectory: string;
  statePath: string;
  seedPath: string;
  memoDirectory: string;
}

export interface EloqStoragePaths {
  rootDirectory: string;
  snapshotPath: string;
}

export const WRITING_AWARENESS_STORAGE_ROOT: string;
export const ELOQ_STORAGE_ROOT: string;
export const ELOQ_SANDBOX_STORAGE_ROOT: string;
export const EMPTY_WRITING_AWARENESS_STATE: Readonly<WritingAwarenessDiskState>;

export function getWritingAwarenessStoragePaths(
  options?: WritingAwarenessStorageOptions
): WritingAwarenessStoragePaths;
export function getEloqStoragePaths(
  options?: WritingAwarenessStorageOptions
): EloqStoragePaths;
export function loadWritingAwarenessBootstrapFromDisk(
  options?: WritingAwarenessStorageOptions & { currentSite?: string }
): Promise<DiskBootstrapPayload>;
export function loadEloqBootstrapFromDisk(
  options?: WritingAwarenessStorageOptions & { currentSite?: string }
): Promise<DiskBootstrapPayload>;
export function loadWritingAwarenessSeedFromDisk(
  options?: WritingAwarenessStorageOptions
): Promise<WritingAwarenessSeed>;
export function loadEloqSnapshotFromDisk(
  options?: WritingAwarenessStorageOptions
): Promise<EloqSnapshotReadModel>;
export function deriveWritingAwarenessSeedFromEloqSnapshot(
  snapshot: EloqSnapshotReadModel
): WritingAwarenessSeed;
export function loadWritingAwarenessStateFromDisk(
  options?: WritingAwarenessStorageOptions
): Promise<WritingAwarenessDiskState>;
export function saveWritingAwarenessStateToDisk(
  state: Partial<WritingAwarenessDiskState>,
  options?: WritingAwarenessStorageOptions
): Promise<WritingAwarenessDiskState>;
export function syncWritingAwarenessSeedToDisk(
  seed: WritingAwarenessSeed,
  options?: WritingAwarenessStorageOptions
): Promise<WritingAwarenessSeed>;
export function summarizeWritingAwarenessEvents(state: Partial<WritingAwarenessDiskState>): WritingSummary;
export function emptyWritingAwarenessDiskState(): WritingAwarenessDiskState;
export function mergeWritingAwarenessState(
  state?: Partial<WritingAwarenessDiskState>
): WritingAwarenessDiskState;
export function upsertManualRule(rules: VocabularyRule[], rule: VocabularyRule): VocabularyRule[];
export function toggleListValue(items: string[], value: string): string[];
export function normalizeLearningTargetText(rawText: string): LearningTargetNormalizationResult;
export function makeLearningTargetReplacementOptions(term: string): Array<{
  word: string;
  useWhen: string;
  caution: string;
}>;
export function saveLearningTargetToState(input: SaveLearningTargetInput): SaveLearningTargetOutput;
