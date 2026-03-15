import type { WritingMatch } from '@audora/writing-awareness-core';

export type EditorKind = 'textarea' | 'contenteditable';
export type SupportedEditorElement = HTMLTextAreaElement | HTMLElement;

export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TextNodeSegment {
  node: Text;
  start: number;
  end: number;
}

interface BaseEditorSurface {
  id: string;
  site: string;
  kind: EditorKind;
  element: SupportedEditorElement;
  text: string;
  selectionStart: number;
  selectionEnd: number;
  supportsQuickReplace: boolean;
}

export interface TextareaSurface extends BaseEditorSurface {
  kind: 'textarea';
  element: HTMLTextAreaElement;
}

export interface ContentEditableSurface extends BaseEditorSurface {
  kind: 'contenteditable';
  element: HTMLElement;
  segments: TextNodeSegment[];
}

export type EditorSurface = TextareaSurface | ContentEditableSurface;

export function isSupportedEditor(target: EventTarget | null): target is SupportedEditorElement {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled;
  }
  return isContentEditableRoot(target);
}

export function buildEditorSurface(
  element: SupportedEditorElement,
  site: string
): EditorSurface | null {
  if (element instanceof HTMLTextAreaElement) {
    return {
      id: editorIdForElement(element),
      site,
      kind: 'textarea',
      element,
      text: element.value,
      selectionStart: element.selectionStart ?? 0,
      selectionEnd: element.selectionEnd ?? element.selectionStart ?? 0,
      supportsQuickReplace: !element.readOnly && !element.disabled,
    };
  }

  if (!isContentEditableRoot(element)) {
    return null;
  }

  const segments = collectTextSegments(element);
  const text = segments.map((segment) => segment.node.nodeValue ?? '').join('');
  const selection = selectionOffsetsForElement(element, segments);

  return {
    id: editorIdForElement(element),
    site,
    kind: 'contenteditable',
    element,
    text,
    selectionStart: selection.start,
    selectionEnd: selection.end,
    supportsQuickReplace: !element.matches('[contenteditable="false"]'),
    segments,
  };
}

export function measureDecorationRects(surface: EditorSurface, match: WritingMatch): OverlayRect[] {
  if (surface.kind === 'textarea') {
    return textareaRectsForRange(surface.element, match.rangeLower, match.rangeUpper);
  }
  return contentEditableRectsForRange(surface, match.rangeLower, match.rangeUpper);
}

export function applyQuickReplace(
  surface: EditorSurface,
  match: WritingMatch,
  replacement: string
): boolean {
  if (!surface.supportsQuickReplace) {
    return false;
  }

  if (surface.kind === 'textarea') {
    surface.element.focus();
    surface.element.setSelectionRange(match.rangeLower, match.rangeUpper);
    surface.element.setRangeText(replacement, match.rangeLower, match.rangeUpper, 'end');
    dispatchInput(surface.element);
    return true;
  }

  const range = rangeForOffsets(surface.segments, match.rangeLower, match.rangeUpper);
  if (!range) {
    return false;
  }

  const textNode = document.createTextNode(replacement);
  range.deleteContents();
  range.insertNode(textNode);

  const selection = window.getSelection();
  if (selection) {
    const after = document.createRange();
    after.setStart(textNode, replacement.length);
    after.collapse(true);
    selection.removeAllRanges();
    selection.addRange(after);
  }

  dispatchInput(surface.element);
  return true;
}

function isContentEditableRoot(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.getAttribute('contenteditable') === 'false') {
      return false;
    }
    if (
      current.isContentEditable ||
      current.contentEditable === 'true' ||
      current.contentEditable === 'plaintext-only' ||
      current.getAttribute('contenteditable') === 'true' ||
      current.getAttribute('contenteditable') === 'plaintext-only'
    ) {
      return !current.closest('[data-audora-writing-root="true"]');
    }
    current = current.parentElement;
  }

  return false;
}

function editorIdForElement(element: SupportedEditorElement): string {
  if (!element.dataset.audoraEditorId) {
    element.dataset.audoraEditorId = `audora-editor-${crypto.randomUUID()}`;
  }
  return element.dataset.audoraEditorId;
}

function dispatchInput(element: HTMLElement): void {
  element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

function collectTextSegments(root: HTMLElement): TextNodeSegment[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const value = node.textContent ?? '';
      return value.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const segments: TextNodeSegment[] = [];
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const value = node.nodeValue ?? '';
    const start = offset;
    offset += value.length;
    segments.push({
      node,
      start,
      end: offset,
    });
  }
  return segments;
}

function selectionOffsetsForElement(
  element: HTMLElement,
  segments: TextNodeSegment[]
): { start: number; end: number } {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return { start: 0, end: 0 };
  }
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
    return { start: 0, end: 0 };
  }

  return {
    start: nodeOffsetToAbsolute(segments, range.startContainer, range.startOffset),
    end: nodeOffsetToAbsolute(segments, range.endContainer, range.endOffset),
  };
}

function nodeOffsetToAbsolute(
  segments: TextNodeSegment[],
  container: Node,
  offset: number
): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const segment = segments.find((entry) => entry.node === container);
    if (!segment) {
      return 0;
    }
    return segment.start + offset;
  }

  const child = container.childNodes[offset] ?? container.childNodes[offset - 1] ?? null;
  if (!child) {
    return 0;
  }

  if (child.nodeType === Node.TEXT_NODE) {
    const segment = segments.find((entry) => entry.node === child);
    return segment?.start ?? 0;
  }

  const nested = child.firstChild;
  if (nested?.nodeType === Node.TEXT_NODE) {
    const segment = segments.find((entry) => entry.node === nested);
    return segment?.start ?? 0;
  }

  return 0;
}

function contentEditableRectsForRange(
  surface: ContentEditableSurface,
  start: number,
  end: number
): OverlayRect[] {
  const range = rangeForOffsets(surface.segments, start, end);
  if (!range) {
    return [];
  }

  return Array.from(range.getClientRects()).map(toOverlayRect).filter((rect) => rect.width > 0);
}

function rangeForOffsets(
  segments: TextNodeSegment[],
  start: number,
  end: number
): Range | null {
  const startSegment = segments.find((segment) => start >= segment.start && start <= segment.end);
  const endSegment = segments.find((segment) => end >= segment.start && end <= segment.end);
  if (!startSegment || !endSegment) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startSegment.node, Math.max(0, start - startSegment.start));
  range.setEnd(endSegment.node, Math.max(0, end - endSegment.start));
  return range;
}

function textareaRectsForRange(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number
): OverlayRect[] {
  const measureRoot = document.createElement('div');
  const style = window.getComputedStyle(textarea);
  const textareaRect = textarea.getBoundingClientRect();
  const marker = document.createElement('span');

  measureRoot.style.position = 'fixed';
  measureRoot.style.left = '-99999px';
  measureRoot.style.top = '0';
  measureRoot.style.whiteSpace = 'pre-wrap';
  measureRoot.style.wordBreak = 'break-word';
  measureRoot.style.overflowWrap = 'break-word';
  measureRoot.style.visibility = 'hidden';
  measureRoot.style.pointerEvents = 'none';
  measureRoot.style.width = `${textarea.clientWidth}px`;
  measureRoot.style.font = style.font;
  measureRoot.style.lineHeight = style.lineHeight;
  measureRoot.style.letterSpacing = style.letterSpacing;
  measureRoot.style.padding = style.padding;
  measureRoot.style.border = style.border;
  measureRoot.style.boxSizing = style.boxSizing;
  measureRoot.style.textTransform = style.textTransform;
  measureRoot.style.textIndent = style.textIndent;
  measureRoot.style.tabSize = style.tabSize;

  measureRoot.append(document.createTextNode(textarea.value.slice(0, start)));
  marker.textContent = textarea.value.slice(start, end) || ' ';
  measureRoot.append(marker);
  measureRoot.append(document.createTextNode(textarea.value.slice(end)));
  document.body.append(measureRoot);

  const overlayRects = Array.from(marker.getClientRects()).map((rect) => ({
    left: textareaRect.left + (rect.left - measureRoot.getBoundingClientRect().left) - textarea.scrollLeft,
    top: textareaRect.top + (rect.top - measureRoot.getBoundingClientRect().top) - textarea.scrollTop,
    width: rect.width,
    height: rect.height,
  }));

  measureRoot.remove();
  return overlayRects.filter((rect) => rect.width > 0);
}

function toOverlayRect(rect: DOMRect): OverlayRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}
