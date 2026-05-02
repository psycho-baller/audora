import {
  analyzeWriting,
  type WritingCheckResult,
  type WritingMatch,
} from '@audora/writing-awareness-core';

import { browser } from '../shared/browser';
import { loadBootstrap, sendBackgroundMessage } from '../shared/messages';
import type { BootstrapPayload, ContentMessage } from '../shared/types';
import { eventTargetsExtensionLayer } from './extension-events';
import { buildInlineSuggestion, type InlineSuggestion } from './eloq-tooltip';
import {
  applyQuickReplace,
  buildEditorSurface,
  measureDecorationRects,
  type EditorSurface,
  type OverlayRect,
  resolveDeepActiveEditor,
  resolveSupportedEditor,
  type SupportedEditorElement,
} from './editor-support';

interface RenderedDecoration {
  id: string;
  kind: 'avoid' | 'reward';
  match: WritingMatch;
  rects: OverlayRect[];
  suggestion?: InlineSuggestion;
}

const SNAPSHOT_REFRESH_INTERVAL_MS = 5_000;

const OVERLAY_STYLE = `
  :host {
    all: initial;
  }

  [data-audora-writing-root="true"] {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    pointer-events: none;
    font-family: "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif;
    color: #f4f2f0;
    --eloq-accent: #d9ef59;
    --eloq-accent-strong: #f5ff78;
    --eloq-accent-soft: rgba(217, 239, 89, 0.16);
    --eloq-danger: rgba(180, 110, 105, 0.95);
    --eloq-surface: rgba(18, 24, 22, 0.98);
    --eloq-surface-raised: rgba(28, 36, 33, 0.98);
    --eloq-border: rgba(217, 239, 89, 0.14);
    --eloq-muted: rgba(190, 184, 178, 0.8);
    --eloq-copy: rgba(244, 242, 240, 0.95);
    --eloq-shadow: 0 24px 52px rgba(0, 0, 0, 0.34);
  }

  .line {
    position: fixed;
    pointer-events: auto;
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
  }

  .line::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 1px;
    height: 2px;
    border-radius: 999px;
  }

  .line.avoid::after {
    background:
      repeating-linear-gradient(
        90deg,
        var(--eloq-danger) 0,
        var(--eloq-danger) 8px,
        rgba(180, 110, 105, 0) 8px,
        rgba(180, 110, 105, 0) 12px
      );
  }

  .line.reward::after {
    background:
      linear-gradient(90deg, rgba(245, 255, 120, 0.95), rgba(217, 239, 89, 0.95));
    box-shadow: 0 0 0 1px rgba(217, 239, 89, 0.14);
  }

  .line:hover::after {
    height: 3px;
  }

  .popover {
    position: fixed;
    width: 320px;
    max-height: min(420px, calc(100vh - 32px));
    overflow-y: auto;
    padding: 14px;
    border-radius: 18px;
    background: var(--eloq-surface);
    border: 1px solid var(--eloq-border);
    box-shadow: var(--eloq-shadow);
    color: var(--eloq-copy);
    backdrop-filter: blur(18px);
    pointer-events: auto;
  }

  .eyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--eloq-muted);
    margin-bottom: 8px;
  }

  .title {
    font: 700 16px/1.2 "SF Pro Display", "Segoe UI", sans-serif;
    margin: 0 0 6px;
  }

  .copy {
    font: 500 12px/1.5 "SF Pro Text", "Segoe UI", sans-serif;
    color: var(--eloq-muted);
    margin: 0;
  }

  .excerpt {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--eloq-surface-raised);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: var(--eloq-copy);
    font: 500 11px/1.45 "SF Pro Text", "Segoe UI", sans-serif;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .action {
    border: 0;
    border-radius: 999px;
    padding: 8px 11px;
    cursor: pointer;
    font: 700 12px/1 "SF Pro Text", "Segoe UI", sans-serif;
    color: var(--eloq-copy);
    background: rgba(255, 255, 255, 0.03);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  .action.primary {
    color: rgba(12, 10, 8, 0.98);
    background: var(--eloq-accent);
    box-shadow: 0 12px 30px rgba(217, 239, 89, 0.24);
  }

  .action.primary:hover {
    background: var(--eloq-accent-strong);
  }

  .details {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .detail {
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .detail-title {
    margin: 0 0 4px;
    color: var(--eloq-copy);
    font: 700 11px/1.35 "SF Pro Text", "Segoe UI", sans-serif;
  }
`;

export class InlineWritingController {
  private bootstrap: BootstrapPayload | null = null;
  private activeElement: SupportedEditorElement | null = null;
  private activeSurface: EditorSurface | null = null;
  private activeResult: WritingCheckResult | null = null;
  private renderedDecorations: RenderedDecoration[] = [];
  private rootHost: HTMLDivElement;
  private shadowRootRef: ShadowRoot;
  private overlayRoot: HTMLDivElement;
  private popoverElement: HTMLDivElement;
  private fingerprints = new Set<string>();
  private surfaceObserver: MutationObserver | null = null;
  private observedElement: SupportedEditorElement | null = null;
  private refreshTimer: number | null = null;
  private popoverCloseTimer: number | null = null;
  private snapshotRefreshTimer: number | null = null;
  private readonly runtimeMessageListener = (message: unknown) =>
    this.handleMessage(message as ContentMessage);

  constructor() {
    this.rootHost = document.createElement('div');
    this.rootHost.dataset.audoraWritingRoot = 'true';
    this.shadowRootRef = this.rootHost.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = OVERLAY_STYLE;
    this.overlayRoot = document.createElement('div');
    this.overlayRoot.dataset.audoraWritingRoot = 'true';
    this.popoverElement = document.createElement('div');
    this.popoverElement.className = 'popover';
    this.popoverElement.hidden = true;
    this.overlayRoot.append(this.popoverElement);
    this.shadowRootRef.append(style, this.overlayRoot);
  }

  async start(): Promise<void> {
    if (!document.documentElement) {
      return;
    }

    document.documentElement.append(this.rootHost);
    this.bootstrap = await loadBootstrap(window.location.hostname);
    this.bind();
    this.startSnapshotAutoRefresh();
    this.refreshActiveEditor();
  }

  private bind(): void {
    document.addEventListener('focusin', this.handleFocusIn, true);
    document.addEventListener('beforeinput', this.handleInput, true);
    document.addEventListener('input', this.handleInput, true);
    document.addEventListener('keyup', this.handleInput, true);
    document.addEventListener('compositionend', this.handleInput, true);
    document.addEventListener('mouseup', this.handleInput, true);
    document.addEventListener('pointerdown', this.handlePointerDown, true);
    document.addEventListener('selectionchange', this.handleSelectionChange, true);
    document.addEventListener('visibilitychange', this.handleVisibilityChange, true);
    window.addEventListener('scroll', this.handleViewportChange, true);
    window.addEventListener('resize', this.handleViewportChange, true);
    window.addEventListener('focus', this.handleWindowFocus, true);
    browser.runtime.onMessage.addListener(this.runtimeMessageListener);
  }

  dispose(): void {
    document.removeEventListener('focusin', this.handleFocusIn, true);
    document.removeEventListener('beforeinput', this.handleInput, true);
    document.removeEventListener('input', this.handleInput, true);
    document.removeEventListener('keyup', this.handleInput, true);
    document.removeEventListener('compositionend', this.handleInput, true);
    document.removeEventListener('mouseup', this.handleInput, true);
    document.removeEventListener('pointerdown', this.handlePointerDown, true);
    document.removeEventListener('selectionchange', this.handleSelectionChange, true);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange, true);
    window.removeEventListener('scroll', this.handleViewportChange, true);
    window.removeEventListener('resize', this.handleViewportChange, true);
    window.removeEventListener('focus', this.handleWindowFocus, true);
    browser.runtime.onMessage.removeListener(this.runtimeMessageListener);
    this.stopObservingSurface();
    this.cancelPopoverClose();
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.snapshotRefreshTimer !== null) {
      window.clearInterval(this.snapshotRefreshTimer);
      this.snapshotRefreshTimer = null;
    }
    document.documentElement?.removeAttribute('data-eloq-inline-writing-active');
    this.rootHost.remove();
  }

  private handleFocusIn = (event: FocusEvent): void => {
    const editor = editorFromEvent(event) ?? currentActiveEditor();
    if (editor) {
      this.activeElement = editor;
    }
    this.refreshActiveEditor();
  };

  private handleInput = (event: Event): void => {
    const editor = editorFromEvent(event);
    if (editor) {
      this.activeElement = editor;
    }
    this.scheduleRefresh();
  };

  private handleSelectionChange = (): void => {
    this.activeElement = currentActiveEditor();
    this.scheduleRefresh(true);
  };

  private handleViewportChange = (): void => {
    if (!this.activeElement && !this.renderedDecorations.length) {
      return;
    }
    this.refreshActiveEditor({ preservePopover: true });
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      void this.requestSnapshotRefresh();
    }
  };

  private handleWindowFocus = (): void => {
    void this.requestSnapshotRefresh();
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (eventTargetsExtensionLayer(event, this.rootHost, this.overlayRoot, this.popoverElement)) {
      return;
    }

    this.closePopover();
  };

  private handleMessage = async (message: ContentMessage): Promise<void> => {
    if (message.type === 'awareness:refresh') {
      this.bootstrap = await loadBootstrap(window.location.hostname);
      this.refreshActiveEditor();
      return;
    }
    if (message.type === 'awareness:toggle-popover') {
      this.toggleFirstPopover();
    }
  };

  private refreshActiveEditor(options: { preservePopover?: boolean } = {}): void {
    if (!this.bootstrap) {
      return;
    }

    const active =
      (this.activeElement && resolveSupportedEditor(this.activeElement)) ||
      currentActiveEditor();

    if (!active) {
      this.activeElement = null;
      this.activeSurface = null;
      this.activeResult = null;
      this.stopObservingSurface();
      this.clearDecorations();
      return;
    }

    const surface = buildEditorSurface(active, window.location.hostname);
    if (!surface || !surface.text.trim()) {
      this.activeElement = active;
      this.activeSurface = surface;
      this.activeResult = null;
      this.stopObservingSurface();
      this.clearDecorations();
      return;
    }

    this.activeElement = active;
    this.activeSurface = surface;
    this.observeSurface(surface);

    const analysis = analyzeWriting({
      text: surface.text,
      seed: this.bootstrap.seed,
      state: this.bootstrap.state,
      focusPack: this.bootstrap.focusPack,
      subtleRewards: true,
      currentSite: surface.site,
    });

    this.activeResult = analysis.result;
    this.renderDecorations(surface, analysis.result, options.preservePopover === true);
    void this.recordEvents(analysis.result);
  }

  private renderDecorations(
    surface: EditorSurface,
    result: WritingCheckResult,
    preservePopover: boolean
  ): void {
    const previousOpenId = preservePopover ? this.popoverElement.dataset.decorationId : '';
    this.renderedDecorations = [];

    Array.from(this.overlayRoot.querySelectorAll('.line')).forEach((element) => element.remove());

    const suggestionsByRule = new Map(result.suggestedReplacements.map((entry) => [entry.ruleId, entry]));
    const snapshot = this.bootstrap?.snapshot;
    const decorations: RenderedDecoration[] = [];

    for (const match of result.flaggedTerms.slice(0, 12)) {
      const rects = measureDecorationRects(surface, match);
      if (!rects.length) {
        continue;
      }
      decorations.push({
        id: `avoid:${match.id}`,
        kind: 'avoid',
        match,
        rects,
        suggestion: buildInlineSuggestion(
          match.term,
          suggestionsByRule.get(match.ruleId),
          snapshot
        ),
      });
    }

    for (const match of result.rewardedTerms.slice(0, 6)) {
      const rects = measureDecorationRects(surface, match);
      if (!rects.length) {
        continue;
      }
      decorations.push({
        id: `reward:${match.id}`,
        kind: 'reward',
        match,
        rects,
      });
    }

    this.renderedDecorations = decorations;

    for (const decoration of decorations) {
      for (const rect of decoration.rects) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `line ${decoration.kind}`;
        button.style.left = `${rect.left}px`;
        button.style.top = `${rect.top}px`;
        button.style.width = `${rect.width}px`;
        button.style.height = `${Math.max(18, rect.height)}px`;
        button.dataset.decorationId = decoration.id;
        button.addEventListener('mouseenter', () => this.handleDecorationHover(decoration));
        button.addEventListener('mouseleave', () => this.schedulePopoverClose(decoration.id));
        button.addEventListener('focus', () => this.handleDecorationHover(decoration));
        button.addEventListener('blur', () => this.schedulePopoverClose(decoration.id));
        button.addEventListener('click', () => this.openPopover(decoration));
        this.overlayRoot.append(button);
      }
    }

    if (previousOpenId) {
      const existing = decorations.find((entry) => entry.id === previousOpenId);
      if (existing) {
        this.openPopover(existing);
        return;
      }
    }

    this.closePopover();
  }

  private startSnapshotAutoRefresh(): void {
    if (this.snapshotRefreshTimer !== null) {
      window.clearInterval(this.snapshotRefreshTimer);
    }

    this.snapshotRefreshTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void this.requestSnapshotRefresh();
    }, SNAPSHOT_REFRESH_INTERVAL_MS);
  }

  private async requestSnapshotRefresh(): Promise<void> {
    await sendBackgroundMessage<{ ok: true }>({
      type: 'awareness:request-refresh',
    }).catch(() => undefined);
  }

  private openPopover(decoration: RenderedDecoration): void {
    this.cancelPopoverClose();

    const anchor = decoration.rects[0];
    if (!anchor) {
      return;
    }

    this.popoverElement.dataset.decorationId = decoration.id;
    this.popoverElement.hidden = false;
    this.popoverElement.innerHTML = '';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = decoration.kind === 'avoid' ? 'Replace default word' : 'Strong target word';

    const title = document.createElement('h3');
    title.className = 'title';
    title.textContent =
      decoration.kind === 'avoid'
        ? `"${decoration.match.term}" can be sharper here`
        : `"${decoration.match.term}" lands well here`;

    const copy = document.createElement('p');
    copy.className = 'copy';
    copy.textContent =
      decoration.kind === 'avoid'
        ? decoration.suggestion?.message || decoration.match.snippet
        : decoration.match.snippet;

    const excerpt = document.createElement('div');
    excerpt.className = 'excerpt';
    excerpt.textContent = decoration.suggestion?.sourceExcerpt ?? '';
    excerpt.hidden = !decoration.suggestion?.sourceExcerpt;

    const buttons = document.createElement('div');
    buttons.className = 'buttons';

    if (decoration.kind === 'avoid' && decoration.suggestion?.replacements.length) {
      decoration.suggestion.replacements.slice(0, 3).forEach((replacement, index) => {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = `action ${index === 0 ? 'primary' : ''}`;
        action.textContent = replacement;
        action.addEventListener('click', () => this.replaceDecoration(decoration, replacement));
        buttons.append(action);
      });
    }

    const details = document.createElement('div');
    details.className = 'details';
    details.hidden = !decoration.suggestion?.replacementDetails.length;

    decoration.suggestion?.replacementDetails.slice(0, 3).forEach((detail) => {
      const row = document.createElement('div');
      row.className = 'detail';

      const rowTitle = document.createElement('div');
      rowTitle.className = 'detail-title';
      rowTitle.textContent = detail.term;

      const rowCopy = document.createElement('p');
      rowCopy.className = 'copy';
      rowCopy.textContent = detail.exampleUsage || detail.useWhen || detail.rationale || detail.caution;

      row.append(rowTitle, rowCopy);
      details.append(row);
    });

    const mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'action';
    mute.textContent = 'Mute term';
    mute.addEventListener('click', () => void this.muteTerm(decoration.match.term));
    buttons.append(mute);

    this.popoverElement.append(eyebrow, title, copy, excerpt, buttons, details);
    this.popoverElement.onmouseenter = () => this.cancelPopoverClose();
    this.popoverElement.onmouseleave = () => this.schedulePopoverClose(decoration.id);

    const rect = this.popoverElement.getBoundingClientRect();
    const maxLeft = Math.max(16, window.innerWidth - rect.width - 16);
    const maxTop = Math.max(16, window.innerHeight - rect.height - 16);
    this.popoverElement.style.left = `${clamp(anchor.left, 16, maxLeft)}px`;
    this.popoverElement.style.top = `${clamp(anchor.top - 12 - rect.height, 16, maxTop)}px`;
  }

  private closePopover(): void {
    this.cancelPopoverClose();
    this.popoverElement.hidden = true;
    this.popoverElement.dataset.decorationId = '';
    this.popoverElement.onmouseenter = null;
    this.popoverElement.onmouseleave = null;
    this.popoverElement.innerHTML = '';
  }

  private async muteTerm(term: string): Promise<void> {
    this.bootstrap = await sendBackgroundMessage<BootstrapPayload>({
      type: 'awareness:toggle-term-mute',
      term,
    });
    this.refreshActiveEditor();
  }

  private replaceDecoration(decoration: RenderedDecoration, replacement: string): void {
    if (!this.activeSurface) {
      return;
    }
    const success = applyQuickReplace(this.activeSurface, decoration.match, replacement);
    if (!success) {
      return;
    }
    this.closePopover();
    window.setTimeout(() => this.refreshActiveEditor(), 30);
  }

  private scheduleRefresh(preservePopover = false): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refreshActiveEditor({ preservePopover });
    }, 24);
  }

  private observeSurface(surface: EditorSurface): void {
    if (
      this.observedElement === surface.element &&
      this.surfaceObserver
    ) {
      return;
    }

    this.stopObservingSurface();

    if (surface.kind !== 'contenteditable') {
      return;
    }

    this.observedElement = surface.element;
    this.surfaceObserver = new MutationObserver(() => {
      this.scheduleRefresh(true);
    });
    this.surfaceObserver.observe(surface.element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private stopObservingSurface(): void {
    this.surfaceObserver?.disconnect();
    this.surfaceObserver = null;
    this.observedElement = null;
  }

  private toggleFirstPopover(): void {
    if (this.popoverElement.hidden) {
      const firstDecoration = this.renderedDecorations.find((entry) => entry.kind === 'avoid') ?? this.renderedDecorations[0];
      if (firstDecoration) {
        this.openPopover(firstDecoration);
      }
      return;
    }
    this.closePopover();
  }

  private clearDecorations(): void {
    Array.from(this.overlayRoot.querySelectorAll('.line')).forEach((element) => element.remove());
    this.renderedDecorations = [];
    this.closePopover();
  }

  private handleDecorationHover(decoration: RenderedDecoration): void {
    this.cancelPopoverClose();
    this.openPopover(decoration);
  }

  private schedulePopoverClose(decorationId: string): void {
    this.cancelPopoverClose();

    this.popoverCloseTimer = window.setTimeout(() => {
      this.popoverCloseTimer = null;
      if (this.popoverElement.dataset.decorationId === decorationId) {
        this.closePopover();
      }
    }, 120);
  }

  private cancelPopoverClose(): void {
    if (this.popoverCloseTimer !== null) {
      window.clearTimeout(this.popoverCloseTimer);
      this.popoverCloseTimer = null;
    }
  }

  private async recordEvents(result: WritingCheckResult): Promise<void> {
    const events: BootstrapPayload['state']['reinforcementEvents'] = [];
    const dayKey = new Date().toISOString().slice(0, 10);
    const normalizedText = result.inputText.toLowerCase().trim().slice(0, 120);

    for (const match of result.flaggedTerms.slice(0, 3)) {
      const key = `avoid|${match.ruleId}|${dayKey}|${normalizedText}`;
      if (this.fingerprints.has(key)) {
        continue;
      }
      this.fingerprints.add(key);
      events.push({
        id: crypto.randomUUID(),
        term: match.term,
        kind: 'avoid-caught',
        context: window.location.hostname,
        createdAt: new Date().toISOString(),
      });
    }

    for (const match of result.rewardedTerms.slice(0, 2)) {
      const key = `target|${match.ruleId}|${dayKey}|${normalizedText}`;
      if (this.fingerprints.has(key)) {
        continue;
      }
      this.fingerprints.add(key);
      events.push({
        id: crypto.randomUUID(),
        term: match.term,
        kind: 'target-used-well',
        context: window.location.hostname,
        createdAt: new Date().toISOString(),
      });
    }

    if (!events.length) {
      return;
    }

    await sendBackgroundMessage<{ ok: true }>({
      type: 'awareness:record-events',
      events,
    });
  }
}

function currentActiveEditor(): SupportedEditorElement | null {
  return resolveDeepActiveEditor(document);
}

function editorFromEvent(event: Event): SupportedEditorElement | null {
  if (typeof event.composedPath === 'function') {
    for (const target of event.composedPath()) {
      const editor = resolveSupportedEditor(target as EventTarget | null);
      if (editor) {
        return editor;
      }
    }
  }

  return resolveSupportedEditor(event.target);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
