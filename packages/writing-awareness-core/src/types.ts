export type VocabularyRuleType = 'avoid' | 'target';
export type VocabularyRuleSource = 'corpus-derived' | 'exercise-derived' | 'manual';

export interface VocabularyReplacementOption {
  word: string;
  useWhen: string;
  caution: string;
}

export interface VocabularyRule {
  id: string;
  type: VocabularyRuleType;
  term: string;
  replacementOptions: VocabularyReplacementOption[];
  contexts: string[];
  source: VocabularyRuleSource;
  active: boolean;
  priority: number;
  notes: string;
  family: string;
  pinned: boolean;
}

export interface FocusPack {
  date: string | Date;
  weeklyFamily: string;
  targetWords: string[];
  bannedTerms: string[];
  triggerQuestion: string;
  exampleRewrite: string;
}

export interface WritingMatch {
  id: string;
  ruleId: string;
  term: string;
  family: string;
  rangeLower: number;
  rangeUpper: number;
  snippet: string;
  replacement?: string;
}

export interface WritingSuggestion {
  id: string;
  ruleId: string;
  term: string;
  replacements: string[];
  message: string;
}

export interface WritingCheckResult {
  inputText: string;
  flaggedTerms: WritingMatch[];
  suggestedReplacements: WritingSuggestion[];
  rewardedTerms: WritingMatch[];
  confidence: number;
  rewrittenText?: string | null;
}

export interface RepairEntry {
  id: string;
  capturedAt: string | Date;
  sourceApp: string;
  rawSentence: string;
  improvedSentence: string;
  ruleIds: string[];
  replacementWord: string;
  reusedSameDay: boolean;
  audioMemoPath?: string | null;
}

export type ReinforcementKind = 'avoid-caught' | 'target-used-well' | 'repair-completed';

export interface ReinforcementEvent {
  id: string;
  term: string;
  kind: ReinforcementKind;
  context: string;
  createdAt: string | Date;
}

export interface FocusTemplate {
  family: string;
  targetWords: string[];
  bannedTerms: string[];
  triggerQuestion: string;
  exampleRewrite: string;
}

export interface ContextWordBankEntry {
  word: string;
  useWhen: string;
  example: string;
}

export interface ContextWordBank {
  context: string;
  noteCount: number;
  words: ContextWordBankEntry[];
}

export interface WritingAwarenessSeed {
  sourceRunId: string;
  generatedAt: string | Date;
  rules: VocabularyRule[];
  focusTemplates: FocusTemplate[];
  contextWordBanks: ContextWordBank[];
}

export interface VocabularyRuleOverride {
  active?: boolean;
  priority?: number;
  notes?: string;
  pinned?: boolean;
}

export interface WritingAwarenessState {
  ruleOverrides: Record<string, VocabularyRuleOverride>;
  manualRules: VocabularyRule[];
  repairs: RepairEntry[];
  reinforcementEvents: ReinforcementEvent[];
  mutedSites: string[];
  mutedTerms: string[];
}

export interface AnalyzeWritingInput {
  text: string;
  seed: WritingAwarenessSeed;
  state?: Partial<WritingAwarenessState>;
  focusPack?: FocusPack;
  subtleRewards?: boolean;
  currentSite?: string;
}

export interface AnalyzeWritingOutput {
  focusPack: FocusPack;
  rules: VocabularyRule[];
  result: WritingCheckResult;
}
