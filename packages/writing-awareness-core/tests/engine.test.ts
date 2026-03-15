import { describe, expect, it } from 'vitest';

import {
  analyzeWriting,
  emptyWritingAwarenessState,
  rewriteText,
  type WritingAwarenessSeed,
} from '../src/index';

const seed: WritingAwarenessSeed = {
  sourceRunId: 'test-run',
  generatedAt: '2026-03-15T00:00:00.000Z',
  rules: [
    {
      id: 'avoid:thing_family:thing',
      type: 'avoid',
      term: 'thing',
      replacementOptions: [
        {
          word: 'constraint',
          useWhen: 'Use when you mean a limiting condition.',
          caution: 'Do not use for physical objects.',
        },
      ],
      contexts: ['productivity'],
      source: 'corpus-derived',
      active: true,
      priority: 5,
      notes: 'Overused placeholder noun.',
      family: 'thing_family',
      pinned: false,
    },
    {
      id: 'target:thing_family:constraint',
      type: 'target',
      term: 'constraint',
      replacementOptions: [
        {
          word: 'constraint',
          useWhen: 'Use when a limit shapes the outcome.',
          caution: 'Do not stuff it repeatedly.',
        },
      ],
      contexts: ['productivity'],
      source: 'corpus-derived',
      active: true,
      priority: 4,
      notes: 'Precision target.',
      family: 'thing_family',
      pinned: false,
    },
  ],
  focusTemplates: [
    {
      family: 'thing_family',
      targetWords: ['constraint', 'pattern', 'decision'],
      bannedTerms: ['thing', 'stuff'],
      triggerQuestion: 'What exact object, action, or constraint do I mean?',
      exampleRewrite: 'Fix this thing -> resolve this blocker',
    },
  ],
  contextWordBanks: [],
};

describe('analyzeWriting', () => {
  it('flags avoid terms and rewards focus targets', () => {
    const analysis = analyzeWriting({
      text: 'This thing is the real constraint in the process because the timeline, budget, and staffing all depend on it.',
      seed,
      state: emptyWritingAwarenessState(),
    });

    expect(analysis.result.flaggedTerms).toHaveLength(1);
    expect(analysis.result.flaggedTerms[0]?.term).toBe('thing');
    expect(analysis.result.rewardedTerms).toHaveLength(1);
    expect(analysis.result.rewardedTerms[0]?.term).toBe('constraint');
  });

  it('honors muted terms and manual overrides', () => {
    const analysis = analyzeWriting({
      text: 'This thing is slowing us down.',
      seed,
      state: {
        ...emptyWritingAwarenessState(),
        mutedTerms: ['thing'],
      },
    });

    expect(analysis.result.flaggedTerms).toHaveLength(0);
  });

  it('rewrites flagged terms from the same rule set', () => {
    const analysis = analyzeWriting({
      text: 'This thing matters.',
      seed,
      state: emptyWritingAwarenessState(),
    });

    const rewritten = rewriteText('This thing matters.', analysis.result, analysis.rules);
    expect(rewritten).toContain('constraint');
  });
});
