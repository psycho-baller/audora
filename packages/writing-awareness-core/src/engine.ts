import type {
  AnalyzeWritingInput,
  AnalyzeWritingOutput,
  FocusPack,
  FocusTemplate,
  VocabularyRule,
  VocabularyRuleOverride,
  WritingAwarenessSeed,
  WritingAwarenessState,
  WritingCheckResult,
  WritingMatch,
  WritingSuggestion,
} from './types';

const EMPTY_RESULT: WritingCheckResult = {
  inputText: '',
  flaggedTerms: [],
  suggestedReplacements: [],
  rewardedTerms: [],
  confidence: 0,
  rewrittenText: null,
};

export function emptyWritingAwarenessState(): WritingAwarenessState {
  return {
    ruleOverrides: {},
    manualRules: [],
    repairs: [],
    reinforcementEvents: [],
    mutedSites: [],
    mutedTerms: [],
  };
}

export function normalizeDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

export function resolveFocusPack(seed: WritingAwarenessSeed, date = new Date()): FocusPack {
  const templates = seed.focusTemplates;
  if (!templates.length) {
    return {
      date,
      weeklyFamily: 'manual',
      targetWords: [],
      bannedTerms: [],
      triggerQuestion: 'What exact word would make this more precise?',
      exampleRewrite: '',
    };
  }

  const selected = focusTemplateForDate(templates, date);
  return {
    date,
    weeklyFamily: selected.family,
    targetWords: selected.targetWords,
    bannedTerms: selected.bannedTerms,
    triggerQuestion: selected.triggerQuestion,
    exampleRewrite: selected.exampleRewrite,
  };
}

export function focusTemplateForDate(templates: FocusTemplate[], date: Date): FocusTemplate {
  const week = isoWeek(date);
  const year = weekYear(date);
  const index = Math.abs((week + year) % templates.length);
  return templates[index];
}

export function mergeRules(
  seed: WritingAwarenessSeed,
  state: Partial<WritingAwarenessState> = {}
): VocabularyRule[] {
  const baseRules = seed.rules.map(applyDefaultRuleCasing);
  const overrides = state.ruleOverrides ?? {};
  const manualRules = state.manualRules ?? [];

  const merged = baseRules.map((rule) => applyRuleOverride(rule, overrides[rule.id]));
  merged.push(...manualRules.map(applyDefaultRuleCasing));

  return merged.sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }
    if (left.type !== right.type) {
      return left.type.localeCompare(right.type);
    }
    return left.term.localeCompare(right.term);
  });
}

export function analyzeWriting(input: AnalyzeWritingInput): AnalyzeWritingOutput {
  const state = {
    ...emptyWritingAwarenessState(),
    ...input.state,
    ruleOverrides: input.state?.ruleOverrides ?? {},
    manualRules: input.state?.manualRules ?? [],
    repairs: input.state?.repairs ?? [],
    reinforcementEvents: input.state?.reinforcementEvents ?? [],
    mutedSites: input.state?.mutedSites ?? [],
    mutedTerms: input.state?.mutedTerms ?? [],
  };
  const focusPack = input.focusPack ?? resolveFocusPack(input.seed);
  const rules = mergeRules(input.seed, state);
  const trimmed = input.text.trim();

  if (!trimmed.length) {
    return {
      focusPack,
      rules,
      result: {
        ...EMPTY_RESULT,
        inputText: '',
      },
    };
  }

  if (input.currentSite && state.mutedSites.includes(input.currentSite)) {
    return {
      focusPack,
      rules,
      result: {
        ...EMPTY_RESULT,
        inputText: trimmed,
      },
    };
  }

  const liveTargetTerms = new Set(focusPack.targetWords.map(normalizeTerm));
  const liveAvoidRules = rules.filter(
    (rule) =>
      rule.type === 'avoid' &&
      rule.active &&
      (rule.family === focusPack.weeklyFamily || rule.pinned || rule.source === 'manual')
  );
  const liveTargetRules = rules.filter(
    (rule) =>
      rule.type === 'target' &&
      rule.active &&
      (liveTargetTerms.has(normalizeTerm(rule.term)) ||
        rule.pinned ||
        rule.source === 'manual' ||
        rule.family === focusPack.weeklyFamily)
  );

  const mutedTerms = new Set(state.mutedTerms.map(normalizeTerm));
  const wordCount = Math.max(1, countWords(trimmed));

  const flaggedTerms = liveAvoidRules
    .filter((rule) => !mutedTerms.has(normalizeTerm(rule.term)))
    .flatMap((rule) => matchesForRule(rule, trimmed))
    .sort((left, right) => left.rangeLower - right.rangeLower);

  const rewardedTerms = input.subtleRewards === false
    ? []
    : liveTargetRules
        .filter((rule) => !mutedTerms.has(normalizeTerm(rule.term)))
        .flatMap((rule) => rewardableMatches(rule, matchesForRule(rule, trimmed), wordCount))
        .sort((left, right) => left.rangeLower - right.rangeLower);

  const flaggedRuleIds = new Set(flaggedTerms.map((match) => match.ruleId));
  const suggestedReplacements = liveAvoidRules.flatMap((rule): WritingSuggestion[] => {
    if (!flaggedRuleIds.has(rule.id)) {
      return [];
    }
    const replacements = rule.replacementOptions
      .map((option) => option.word.trim())
      .filter(Boolean)
      .slice(0, 3);
    return [
      {
        id: `suggestion:${rule.id}`,
        ruleId: rule.id,
        term: rule.term,
        replacements,
        message: rule.replacementOptions[0]?.useWhen || rule.notes,
      },
    ];
  });

  const confidence = Math.min(
    0.98,
    0.58 + flaggedTerms.length * 0.04 + rewardedTerms.length * 0.03
  );

  return {
    focusPack,
    rules,
    result: {
      inputText: trimmed,
      flaggedTerms,
      suggestedReplacements,
      rewardedTerms,
      confidence,
      rewrittenText: null,
    },
  };
}

export function rewriteText(
  text: string,
  result: WritingCheckResult,
  rules: VocabularyRule[]
): string {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  let output = text;
  const replacements = [...result.flaggedTerms].sort((left, right) => right.rangeLower - left.rangeLower);

  for (const match of replacements.slice(0, 3)) {
    const rule = byId.get(match.ruleId);
    if (!rule) {
      continue;
    }
    const replacement = replacementText(rule, match.term);
    output =
      output.slice(0, match.rangeLower) +
      replacement +
      output.slice(match.rangeUpper);
  }

  return output
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

export function applySuggestion(
  text: string,
  match: WritingMatch,
  replacement: string
): string {
  return text.slice(0, match.rangeLower) + replacement + text.slice(match.rangeUpper);
}

export function matchesForRule(rule: VocabularyRule, text: string): WritingMatch[] {
  const escapedTerm = escapeRegExp(rule.term);
  const expression = new RegExp(`(?<![A-Za-z])${escapedTerm}(?![A-Za-z])`, 'gi');
  const matches: WritingMatch[] = [];
  let index = 0;

  for (const match of text.matchAll(expression)) {
    const value = match[0];
    const start = match.index ?? -1;
    if (start < 0) {
      continue;
    }
    const end = start + value.length;
    matches.push({
      id: `${rule.id}:${index}`,
      ruleId: rule.id,
      term: value.toLowerCase(),
      family: rule.family,
      rangeLower: start,
      rangeUpper: end,
      snippet: snippetForRange(text, start, end),
      replacement: rule.replacementOptions[0]?.word || undefined,
    });
    index += 1;
  }

  return matches;
}

export function rewardableMatches(
  rule: VocabularyRule,
  matches: WritingMatch[],
  wordCount: number
): WritingMatch[] {
  if (!matches.length) {
    return [];
  }
  const density = matches.length / Math.max(1, wordCount);
  if (matches.length > 2 || density > 0.06) {
    return [];
  }
  if (matches.length > 1) {
    for (let index = 1; index < matches.length; index += 1) {
      if (matches[index].rangeLower - matches[index - 1].rangeUpper < 10) {
        return [];
      }
    }
  }
  return matches;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function snippetForRange(text: string, start: number, end: number, radius = 48): string {
  const excerptStart = Math.max(0, start - radius);
  const excerptEnd = Math.min(text.length, end + radius);
  let excerpt = text.slice(excerptStart, excerptEnd).trim();
  if (excerptStart > 0) {
    excerpt = `...${excerpt}`;
  }
  if (excerptEnd < text.length) {
    excerpt = `${excerpt}...`;
  }
  return excerpt;
}

function replacementText(rule: VocabularyRule, matchedTerm: string): string {
  switch (rule.family) {
    case 'really_very':
    case 'kind_of_sort_of':
      return '';
    case 'you_know':
      return 'for example';
    case 'i_think_feel_guess':
      return 'the core point is';
    default:
      return rule.replacementOptions[0]?.word || matchedTerm;
  }
}

function applyDefaultRuleCasing(rule: VocabularyRule): VocabularyRule {
  return {
    ...rule,
    term: rule.term.trim(),
  };
}

function applyRuleOverride(
  rule: VocabularyRule,
  override?: VocabularyRuleOverride
): VocabularyRule {
  if (!override) {
    return rule;
  }
  return {
    ...rule,
    active: override.active ?? rule.active,
    priority: override.priority ?? rule.priority,
    notes: override.notes ?? rule.notes,
    pinned: override.pinned ?? rule.pinned,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function weekYear(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  return target.getUTCFullYear();
}
