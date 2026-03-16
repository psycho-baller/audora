export interface ObsidianAudoraPluginSettings {
  automaticChecking: boolean;
  showRewardUnderlines: boolean;
  debounceMs: number;
}

export interface ProjectedLintSpan {
  originalFrom: number;
  originalTo: number;
  projectedFrom: number;
  projectedTo: number;
  text: string;
}

export interface ProjectedDocument {
  sourceText: string;
  projectedText: string;
  spans: ProjectedLintSpan[];
}

export interface ObsidianWritingDiagnostic {
  id: string;
  kind: 'avoid' | 'reward';
  ruleId: string;
  term: string;
  from: number;
  to: number;
  message: string;
  snippet: string;
  replacements: string[];
}
