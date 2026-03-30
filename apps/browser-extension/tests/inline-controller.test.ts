import { describe, expect, it } from 'vitest';

import { eventTargetsExtensionLayer } from '../src/content/extension-events';
import { buildInlineSuggestion } from '../src/content/eloq-tooltip';

describe('browser inline tooltip', () => {
  it('hydrates excerpt and example details from accepted Eloq links', () => {
    const suggestion = buildInlineSuggestion(
      'interesting',
      {
        message: 'Use a more precise word here.',
        replacements: ['intriguing'],
      },
      {
        version: 1,
        generatedAt: '2026-03-22T09:00:00Z',
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
            sourceExcerpt: 'That section was interesting but still too loose.',
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
            id: 'conn-1',
            overusedWordID: 'overused-1',
            overusedTerm: 'interesting',
            underusedWordID: 'underused-1',
            underusedTerm: 'intriguing',
            origin: 'ai',
            status: 'accepted',
            rationale: 'Use a stronger curiosity word.',
            useWhen: 'You mean it provokes curiosity or suspense.',
            caution: 'Avoid it when the tone should stay neutral.',
            sourceExcerpt: 'That section was interesting but still too loose.',
            exampleUsage: 'The result was intriguing enough to investigate further.',
            confidence: 0.9,
          },
        ],
      }
    );

    expect(suggestion).toMatchObject({
      replacements: ['intriguing'],
      sourceExcerpt: 'That section was interesting but still too loose.',
    });
    expect(suggestion?.replacementDetails).toEqual([
      expect.objectContaining({
        term: 'intriguing',
        exampleUsage: 'The result was intriguing enough to investigate further.',
      }),
    ]);
  });

  it('falls back to snapshot replacements when the analysis payload has none', () => {
    const suggestion = buildInlineSuggestion(
      'interesting',
      undefined,
      {
        version: 1,
        generatedAt: '2026-03-22T09:00:00Z',
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
            id: 'conn-1',
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

    expect(suggestion?.replacements).toEqual(['noteworthy']);
    expect(suggestion?.replacementDetails?.[0]).toMatchObject({
      term: 'noteworthy',
      exampleUsage: 'That detail was noteworthy because it changed the conclusion.',
    });
  });

  it('treats shadow-dom popover button clicks as inside the extension layer', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const overlayRoot = document.createElement('div');
    const popover = document.createElement('div');
    const button = document.createElement('button');

    popover.append(button);
    overlayRoot.append(popover);
    shadowRoot.append(overlayRoot);
    document.body.append(host);

    const inside = eventTargetsExtensionLayer(
      {
        target: host,
        composedPath: () => [button, popover, overlayRoot, shadowRoot, host, document.body, document],
      } as unknown as Event,
      host,
      overlayRoot,
      popover
    );

    expect(inside).toBe(true);
  });
});
