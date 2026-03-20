import { describe, expect, it } from 'vitest';

import { diagnosticsFromResult } from '../src/editor-extension';

describe('obsidian editor diagnostics', () => {
  it('deduplicates identical avoid diagnostics that target the same range', () => {
    const diagnostics = diagnosticsFromResult('interesting', {
      inputText: 'interesting',
      confidence: 0.9,
      rewrittenText: null,
      rewardedTerms: [],
      flaggedTerms: [
        {
          id: 'rule-a:0',
          ruleId: 'rule-a',
          term: 'interesting',
          family: 'eloq',
          rangeLower: 0,
          rangeUpper: 11,
          snippet: 'interesting',
        },
        {
          id: 'rule-b:0',
          ruleId: 'rule-b',
          term: 'interesting',
          family: 'eloq',
          rangeLower: 0,
          rangeUpper: 11,
          snippet: 'interesting',
        },
      ],
      suggestedReplacements: [
        {
          id: 'suggestion:rule-a',
          ruleId: 'rule-a',
          term: 'interesting',
          replacements: ['compelling', 'revealing'],
          message: 'Use a more forceful word.',
        },
        {
          id: 'suggestion:rule-b',
          ruleId: 'rule-b',
          term: 'interesting',
          replacements: ['revealing', 'specific'],
          message: 'Use a more exact word.',
        },
      ],
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      kind: 'avoid',
      from: 0,
      to: 11,
      term: 'interesting',
    });
    expect(diagnostics[0]?.replacements).toEqual(['compelling', 'revealing', 'specific']);
  });
});
