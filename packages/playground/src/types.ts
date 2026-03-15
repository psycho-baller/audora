export type Scope = 'note' | 'context' | 'corpus';

export interface NoteIndexItem {
  id: string;
  title: string;
  language: string;
  contextTags: string[];
  contextClusterId: string;
  contextClusterLabel: string;
  wordCount: number;
}

export interface NoteDetail extends NoteIndexItem {
  word_count: number;
  context_tags: string[];
  context_cluster_id: string;
  context_cluster_label: string;
  raw_text: string;
  clean_text: string;
  segments: Array<{
    id: string;
    index: number;
    start: number;
    end: number;
    text: string;
    token_count: number;
    artifact_span_ids: string[];
  }>;
  artifact_spans: Array<{
    id: string;
    kind: string;
    start: number;
    end: number;
    text: string;
  }>;
  created_at?: string | null;
  updated_at?: string | null;
  source_file: string;
}

export interface NoteAnalysis {
  id: string;
  title: string;
  contextTags: string[];
  contextClusterId: string;
  contextClusterLabel: string;
  language: string;
  scores: Record<string, number>;
  detectors: Record<
    string,
    {
      score: number;
      confidence: number;
      rationale: string;
      metrics: Record<string, number>;
      segmentIndex: number | null;
      counterStrength: number;
      languageEligible: boolean;
    }
  >;
}

export interface Finding {
  id: string;
  dimension: string;
  label: string;
  scope: Scope;
  severity: number;
  confidence: number;
  explanation: string;
  why_it_matters: string;
  hypothesis?: string | null;
  metrics: Record<string, number | string>;
  evidence_span_ids: string[];
  counterexample_span_ids: string[];
  linked_drill_ids: string[];
  affected_note_ids: string[];
  context_cluster_id?: string | null;
}

export interface EvidenceSpan {
  id: string;
  note_id: string;
  note_title: string;
  detector: string;
  segment_id?: string | null;
  start: number;
  end: number;
  text: string;
  label: string;
  score: number;
  confidence: number;
  rationale: string;
  metrics: Record<string, number | string>;
}

export interface DrillCard {
  id: string;
  weakness_target: string;
  title: string;
  scenario_prompt: string;
  rubric: string[];
  success_criteria: string[];
  source_evidence_ids: string[];
}

export interface RunSummary {
  id: string;
  createdAt: string;
  configHash?: string;
  name?: string;
  metrics: {
    coverage: number;
    actionability: number;
    novelty: number;
    stability: number;
    overallQuality: number;
  };
  archiveStatus?: {
    archived: boolean;
    archivedAt?: string | null;
    reason?: string | null;
  };
  topDimension?: string | null;
}

export interface VocabularyReplacementOption {
  word: string;
  useWhen: string;
  caution: string;
}

export interface VocabularyRewrite {
  noteId?: string | null;
  noteTitle?: string | null;
  original: string;
  rewritten: string;
  replacement: string;
}

export interface VocabularyContextCount {
  label: string;
  count: number;
}

export interface VocabularyTarget {
  id: string;
  source: string;
  label: string;
  kind: 'word' | 'phrase';
  category: string;
  overuseScore: number;
  confidence: number;
  totalOccurrences: number;
  occurrenceRatePerThousand: number;
  noteCoverage: number;
  clusterSpread: number;
  notesImpacted: number;
  contexts: VocabularyContextCount[];
  why_it_limits_you: string;
  replacementOptions: VocabularyReplacementOption[];
  evidenceSpanIds: string[];
  sampleRewrites: VocabularyRewrite[];
  learningSystem: string[];
  evidenceSamples?: string[];
}

export interface VocabularyWordBankEntry {
  word: string;
  useWhen: string;
  example: string;
}

export interface VocabularyWordBank {
  context: string;
  noteCount: number;
  words: VocabularyWordBankEntry[];
}

export interface VocabularyExperiment {
  id: string;
  label: string;
  description: string;
  status: string;
}

export interface VocabularyPayload {
  overview: {
    eligibleNoteCount: number;
    trackedTargetCount: number;
    lexicalDiversity: number;
    genericWordLoad: number;
    phraseHabitLoad: number;
    focusTargets: string[];
  };
  targets: VocabularyTarget[];
  banks: VocabularyWordBank[];
  experiments: VocabularyExperiment[];
}

export interface FindingsPayload {
  runId: string;
  findings: Finding[];
  evidence: EvidenceSpan[];
  drills: DrillCard[];
  notes: NoteIndexItem[];
  vocabulary: VocabularyPayload;
  llm: {
    enabled: boolean;
    requested: boolean;
    configured: boolean;
    model: string;
    reasoningEffort: string;
    disabledReason?: string | null;
  };
  metrics: RunSummary['metrics'];
  comparisons: {
    previousRunId?: string | null;
    sameConfigRunId?: string | null;
    stability?: number;
    severityShift?: Record<string, number>;
  };
  corpus: {
    noteCount: number;
    wordCount: number;
    averageWords: number;
    contexts: Array<[string, number]>;
    clusters: Array<[string, number]>;
  };
}

export interface CorpusPayload {
  index: {
    noteCount: number;
    sourceFiles: string[];
    languageCounts: Record<string, number>;
    topContexts: Array<[string, number]>;
  };
  notes: NoteDetail[];
}
