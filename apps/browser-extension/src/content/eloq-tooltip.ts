import type { WritingSuggestion } from '@audora/writing-awareness-core';
import type { EloqSnapshotReadModel } from '@audora/writing-awareness-storage';

export interface InlineSuggestion {
  message: string;
  replacements: string[];
  sourceExcerpt: string;
  replacementDetails: InlineReplacementDetail[];
}

export interface InlineReplacementDetail {
  term: string;
  rationale: string;
  useWhen: string;
  caution: string;
  sourceExcerpt: string;
  exampleUsage: string;
}

export function buildInlineSuggestion(
  term: string,
  suggestion: Pick<WritingSuggestion, 'message' | 'replacements'> | undefined,
  snapshot: EloqSnapshotReadModel | undefined
): InlineSuggestion | undefined {
  const acceptedDetails = lookupAcceptedReplacementDetails(term, snapshot);
  const orderedDetails = uniqueReplacementDetails([
    ...(suggestion?.replacements ?? []).map((replacement) =>
      acceptedDetails.byTerm.get(normalizeComparableTerm(replacement))
    ),
    ...acceptedDetails.details,
  ]);
  const replacements = orderedDetails.length
    ? orderedDetails.map((detail) => detail.term)
    : (suggestion?.replacements ?? []).filter(Boolean);

  if (!suggestion?.message && !replacements.length && !acceptedDetails.sourceExcerpt) {
    return undefined;
  }

  return {
    message: suggestion?.message?.trim() || 'Use a more precise word here.',
    replacements,
    sourceExcerpt: acceptedDetails.sourceExcerpt,
    replacementDetails: orderedDetails,
  };
}

function lookupAcceptedReplacementDetails(
  term: string,
  snapshot: EloqSnapshotReadModel | undefined
): {
  sourceExcerpt: string;
  details: InlineReplacementDetail[];
  byTerm: Map<string, InlineReplacementDetail>;
} {
  const wordsById = new Map((snapshot?.words ?? []).map((word) => [String(word.id), word]));
  const normalizedTerm = normalizeComparableTerm(term);
  const details: InlineReplacementDetail[] = [];
  const byTerm = new Map<string, InlineReplacementDetail>();
  let sourceExcerpt = '';

  for (const connection of snapshot?.connections ?? []) {
    if (connection.status !== 'accepted') {
      continue;
    }

    const overusedWord = wordsById.get(String(connection.overusedWordID));
    const underusedWord = wordsById.get(String(connection.underusedWordID));
    const overusedKey = normalizeComparableTerm(connection.overusedTerm ?? overusedWord?.displayTerm ?? '');
    const underusedTerm = String(connection.underusedTerm ?? underusedWord?.displayTerm ?? '').trim();
    const underusedKey = normalizeComparableTerm(underusedTerm);
    if (!overusedKey || !underusedKey || overusedKey !== normalizedTerm) {
      continue;
    }

    const detail: InlineReplacementDetail = {
      term: underusedTerm,
      rationale: normalizeTooltipText(connection.rationale),
      useWhen: normalizeTooltipText(connection.useWhen),
      caution: normalizeTooltipText(connection.caution),
      sourceExcerpt: normalizeTooltipText(connection.sourceExcerpt ?? overusedWord?.sourceExcerpt ?? ''),
      exampleUsage: normalizeTooltipText(connection.exampleUsage ?? underusedWord?.exampleUsage ?? ''),
    };

    if (!sourceExcerpt && detail.sourceExcerpt) {
      sourceExcerpt = detail.sourceExcerpt;
    }

    if (!byTerm.has(underusedKey)) {
      byTerm.set(underusedKey, detail);
      details.push(detail);
    }
  }

  return { sourceExcerpt, details, byTerm };
}

function uniqueReplacementDetails(
  details: readonly (InlineReplacementDetail | undefined)[]
): InlineReplacementDetail[] {
  const seen = new Set<string>();
  const output: InlineReplacementDetail[] = [];

  for (const detail of details) {
    if (!detail) {
      continue;
    }
    const key = normalizeComparableTerm(detail.term);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(detail);
  }

  return output;
}

function normalizeTooltipText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeComparableTerm(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}
