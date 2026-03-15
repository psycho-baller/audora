import type {
  FocusPack,
  ReinforcementEvent,
  VocabularyRule,
  VocabularyRuleOverride,
  WritingAwarenessSeed,
  WritingAwarenessState,
} from '@audora/writing-awareness-core';

export interface BrowserExtensionState extends WritingAwarenessState {
  lastSeedRunId?: string;
  lastSeedSyncedAt?: string;
}

export interface WritingSummary {
  avoidCaught: number;
  targetWins: number;
  repairsCompleted: number;
}

export interface BootstrapPayload {
  seed: WritingAwarenessSeed;
  state: BrowserExtensionState;
  focusPack: FocusPack;
  currentSite: string;
  summary: WritingSummary;
}

export type BackgroundMessage =
  | { type: 'awareness:get-bootstrap'; site?: string }
  | { type: 'awareness:reload-seed' }
  | { type: 'awareness:open-options' }
  | { type: 'awareness:save-manual-rule'; rule: VocabularyRule }
  | { type: 'awareness:delete-manual-rule'; ruleId: string }
  | { type: 'awareness:update-rule-override'; ruleId: string; patch: VocabularyRuleOverride }
  | { type: 'awareness:toggle-site-mute'; site: string }
  | { type: 'awareness:toggle-term-mute'; term: string }
  | { type: 'awareness:record-events'; events: ReinforcementEvent[] }
  | { type: 'awareness:request-refresh' };

export type ContentMessage =
  | { type: 'awareness:refresh' }
  | { type: 'awareness:toggle-popover' };
