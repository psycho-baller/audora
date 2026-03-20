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

  it('hydrates tooltip excerpt and examples from the accepted Eloq snapshot', () => {
    const diagnostics = diagnosticsFromResult(
      'interesting',
      {
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
        ],
        suggestedReplacements: [
          {
            id: 'suggestion:rule-a',
            ruleId: 'rule-a',
            term: 'interesting',
            replacements: ['intriguing'],
            message: 'Use a more precise word here.',
          },
        ],
      },
      {
        version: 1,
        generatedAt: '2026-03-21T08:00:00Z',
        summary: {
          totalWords: 2,
          overusedWords: 1,
          underusedWords: 1,
          acceptedConnections: 1,
          suggestedConnections: 0,
          dismissedConnections: 0,
        },
        words: [
          {
            id: 'overused-1',
            displayTerm: 'interesting',
            normalizedTerm: 'interesting',
            roles: ['overused'],
            notes: '',
            sourceExcerpt: 'That paragraph was interesting but still too vague.',
            exampleUsage: '',
            contexts: [],
            provenance: 'user',
          },
          {
            id: 'underused-1',
            displayTerm: 'intriguing',
            normalizedTerm: 'intriguing',
            roles: ['underused'],
            notes: '',
            sourceExcerpt: '',
            exampleUsage: 'The result was intriguing enough to investigate further.',
            contexts: [],
            provenance: 'ai',
          },
        ],
        connections: [
          {
            id: 'link-1',
            overusedWordID: 'overused-1',
            overusedTerm: 'interesting',
            underusedWordID: 'underused-1',
            underusedTerm: 'intriguing',
            origin: 'ai',
            status: 'accepted',
            rationale: 'Use a stronger curiosity word.',
            useWhen: 'You mean it provokes curiosity or suspense.',
            caution: 'Avoid it if the tone should stay neutral.',
            sourceExcerpt: 'That paragraph was interesting but still too vague.',
            exampleUsage: 'The result was intriguing enough to investigate further.',
            confidence: 0.92,
          },
        ],
      }
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.sourceExcerpt).toBe('That paragraph was interesting but still too vague.');
    expect(diagnostics[0]?.replacementDetails).toEqual([
      expect.objectContaining({
        term: 'intriguing',
        exampleUsage: 'The result was intriguing enough to investigate further.',
      }),
    ]);
  });

  it('falls back to accepted Eloq replacements when the analysis payload has none', () => {
    const diagnostics = diagnosticsFromResult(
      'interesting',
      {
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
        ],
        suggestedReplacements: [],
      },
      {
        version: 1,
        generatedAt: '2026-03-21T08:00:00Z',
        summary: {
          totalWords: 2,
          overusedWords: 1,
          underusedWords: 1,
          acceptedConnections: 1,
          suggestedConnections: 0,
          dismissedConnections: 0,
        },
        words: [],
        connections: [
          {
            id: 'link-1',
            overusedWordID: 'overused-1',
            overusedTerm: 'interesting',
            underusedWordID: 'underused-1',
            underusedTerm: 'noteworthy',
            origin: 'ai',
            status: 'accepted',
            rationale: 'Use a sharper significance word.',
            useWhen: 'You mean it stands out in a concrete way.',
            caution: 'Avoid it when the point is only mild curiosity.',
            sourceExcerpt: '',
            exampleUsage: 'That detail was noteworthy because it changed the conclusion.',
            confidence: 0.88,
          },
        ],
      }
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.replacements).toEqual(['noteworthy']);
    expect(diagnostics[0]?.replacementDetails?.[0]).toMatchObject({
      term: 'noteworthy',
      exampleUsage: 'That detail was noteworthy because it changed the conclusion.',
    });
  });
});
