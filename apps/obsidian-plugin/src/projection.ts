import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

import type { ProjectedDocument, ProjectedLintSpan } from './types';

const EXCLUDED_NODE_PATTERNS = [
  /frontmatter/i,
  /code/i,
  /math/i,
  /url/i,
  /link/i,
  /image/i,
  /html/i,
  /comment/i,
  /processing/i,
  /tag/i,
];

const MARK_NODE_PATTERNS = [
  /mark/i,
  /formatting/i,
  /escape/i,
];

const URL_EXPRESSION = /\b[a-z]+:\/\/\S+/giu;
const HTTP_EXPRESSION = /\b(?:https?:\/\/|www\.)\S+/giu;
const TAG_EXPRESSION = /(^|\s)#[\p{Letter}\p{Number}_/-]+/gu;
const INLINE_MATH_EXPRESSION = /\$[^$\n]+\$/gu;
const INLINE_CODE_EXPRESSION = /`[^`\n]+`/gu;

export function buildProjectedDocument(state: EditorState): ProjectedDocument {
  const sourceText = state.doc.toString();
  if (!sourceText.length) {
    return {
      sourceText,
      projectedText: '',
      spans: [],
    };
  }

  const mask = new Uint8Array(sourceText.length);
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      if (shouldMaskWholeNode(node.name) || shouldMaskSyntaxNode(node.name)) {
        markRange(mask, node.from, node.to);
      }
    },
  });

  applyMarkdownLineHeuristics(sourceText, mask);
  maskPattern(sourceText, mask, URL_EXPRESSION);
  maskPattern(sourceText, mask, HTTP_EXPRESSION);
  maskPattern(sourceText, mask, INLINE_MATH_EXPRESSION);
  maskPattern(sourceText, mask, INLINE_CODE_EXPRESSION);
  maskTagPattern(sourceText, mask);

  const projectedText = buildProjectedText(sourceText, mask);
  const spans = buildProjectedSpans(sourceText, mask);

  return {
    sourceText,
    projectedText,
    spans,
  };
}

function shouldMaskWholeNode(name: string): boolean {
  return EXCLUDED_NODE_PATTERNS.some((pattern) => pattern.test(name));
}

function shouldMaskSyntaxNode(name: string): boolean {
  return MARK_NODE_PATTERNS.some((pattern) => pattern.test(name));
}

function buildProjectedText(sourceText: string, mask: Uint8Array): string {
  const characters = sourceText.split('');
  for (let index = 0; index < characters.length; index += 1) {
    if (!mask[index]) {
      continue;
    }
    if (characters[index] !== '\n' && characters[index] !== '\r') {
      characters[index] = ' ';
    }
  }
  return characters.join('');
}

function buildProjectedSpans(sourceText: string, mask: Uint8Array): ProjectedLintSpan[] {
  const spans: ProjectedLintSpan[] = [];
  let start = -1;

  for (let index = 0; index <= sourceText.length; index += 1) {
    const included = index < sourceText.length && mask[index] === 0;
    if (included && start < 0) {
      start = index;
      continue;
    }

    if (!included && start >= 0) {
      const text = sourceText.slice(start, index);
      if (text.trim().length) {
        spans.push({
          originalFrom: start,
          originalTo: index,
          projectedFrom: start,
          projectedTo: index,
          text,
        });
      }
      start = -1;
    }
  }

  return spans;
}

function applyMarkdownLineHeuristics(sourceText: string, mask: Uint8Array): void {
  const lines = sourceText.matchAll(/.*(?:\r?\n|$)/g);
  let inFrontmatter = false;
  let inFence = false;

  for (const match of lines) {
    const line = match[0];
    if (!line.length) {
      continue;
    }
    const start = match.index ?? 0;
    const content = line.replace(/\r?\n$/, '');
    const trimmed = content.trim();

    if (start === 0 && (trimmed === '---' || trimmed === '+++')) {
      inFrontmatter = true;
      markRange(mask, start, start + content.length);
      continue;
    }

    if (inFrontmatter) {
      markRange(mask, start, start + content.length);
      if (trimmed === '---' || trimmed === '+++') {
        inFrontmatter = false;
      }
      continue;
    }

    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      markRange(mask, start, start + content.length);
      continue;
    }

    if (inFence) {
      markRange(mask, start, start + content.length);
      continue;
    }

    const prefixMatch = content.match(/^\s{0,3}(?:>+\s*|[*+-]\s+|\d+\.\s+|#{1,6}\s+)(?:\[[ xX]\]\s+)?/);
    if (prefixMatch) {
      markRange(mask, start, start + prefixMatch[0].length);
    }

    if (/^\s*(?:[-*_]\s*){3,}$/.test(content)) {
      markRange(mask, start, start + content.length);
    }
  }
}

function maskPattern(sourceText: string, mask: Uint8Array, expression: RegExp): void {
  for (const match of sourceText.matchAll(expression)) {
    if (typeof match.index !== 'number') {
      continue;
    }
    markRange(mask, match.index, match.index + match[0].length);
  }
}

function maskTagPattern(sourceText: string, mask: Uint8Array): void {
  for (const match of sourceText.matchAll(TAG_EXPRESSION)) {
    if (typeof match.index !== 'number') {
      continue;
    }
    const prefix = match[1] ?? '';
    const tagText = match[0].slice(prefix.length);
    const start = match.index + prefix.length;
    markRange(mask, start, start + tagText.length);
  }
}

function markRange(mask: Uint8Array, from: number, to: number): void {
  for (let index = Math.max(0, from); index < Math.min(mask.length, to); index += 1) {
    mask[index] = 1;
  }
}
