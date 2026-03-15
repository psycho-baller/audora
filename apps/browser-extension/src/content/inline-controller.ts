import {
  analyzeWriting,
  type VocabularyRule,
  type WritingCheckResult,
  type WritingMatch,
  type WritingSuggestion,
} from '@audora/writing-awareness-core';

import { browser } from '../shared/browser';
import { loadBootstrap, sendBackgroundMessage } from '../shared/messages';
import type { BootstrapPayload, ContentMessage } from '../shared/types';
import {
  applyQuickReplace,
  buildEditorSurface,
  isSupportedEditor,
  measureDecorationRects,
  type EditorSurface,
  type OverlayRect,
  type SupportedEditorElement,
} from './editor-support';

interface RenderedDecoration {
  id: string;
  kind: 'avoid' | 'reward';
  match: WritingMatch;
  rects: OverlayRect[];
  suggestion?: WritingSuggestion;
}

const OVERLAY_STYLE = `
  :host {
    all: initial;
  }

  [data-audora-writing-root="true"] {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    pointer-events: none;
    font-family: "Avenir Next", "Segoe UI", sans-serif;
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
        rgba(163, 57, 28, 0.95) 0,
        rgba(163, 57, 28, 0.95) 8px,
        rgba(163, 57, 28, 0) 8px,
        rgba(163, 57, 28, 0) 12px
      );
  }

  .line.reward::after {
    background:
      linear-gradient(90deg, rgba(33, 117, 67, 0.95), rgba(52, 154, 90, 0.95));
    box-shadow: 0 0 0 1px rgba(33, 117, 67, 0.12);
  }

  .line:hover::after {
    height: 3px;
  }

  .popover {
    position: fixed;
    width: 280px;
    padding: 14px;
    border-radius: 18px;
    background: rgba(252, 248, 241, 0.96);
    border: 1px solid rgba(33, 21, 10, 0.12);
    box-shadow: 0 22px 48px rgba(39, 25, 12, 0.2);
    color: #201710;
    backdrop-filter: blur(18px);
    pointer-events: auto;
  }

  .eyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: rgba(83, 70, 58, 0.86);
    margin-bottom: 8px;
  }

  .title {
    font: 700 16px/1.2 "Avenir Next", "Segoe UI", sans-serif;
    margin: 0 0 6px;
  }

  .copy {
    font: 500 12px/1.5 "Avenir Next", "Segoe UI", sans-serif;
    color: rgba(83, 70, 58, 0.92);
    margin: 0;
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
    font: 700 12px/1 "Avenir Next", "Segoe UI", sans-serif;
    color: #1f1711;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: inset 0 0 0 1px rgba(33, 21, 10, 0.1);
  }

  .action.primary {
    color: white;
    background: linear-gradient(135deg, #1c4f8a, #153966);
    box-shadow: 0 12px 30px rgba(28, 79, 138, 0.28);
  }

  .status {
    position: fixed;
    right: 18px;
    bottom: 18px;
    padding: 10px 12px;
    border-radius: 999px;
    background: rgba(31, 23, 17, 0.9);
    color: white;
    font: 700 11px/1 "Avenir Next", "Segoe UI", sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    pointer-events: none;
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
  private statusElement: HTMLDivElement;
  private fingerprints = new Set<string>();

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
    this.statusElement = document.createElement('div');
    this.statusElement.className = 'status';
    this.statusElement.hidden = true;
    this.statusElement.textContent = 'Overlay only';
    this.overlayRoot.append(this.popoverElement, this.statusElement);
    this.shadowRootRef.append(style, this.overlayRoot);
  }

  async start(): Promise<void> {
    if (!document.documentElement) {
      return;
    }

    document.documentElement.append(this.rootHost);
    this.bootstrap = await loadBootstrap(window.location.hostname);
    this.bind();
    this.refreshActiveEditor();
  }

  private bind(): void {
    document.addEventListener('focusin', this.handleFocusIn, true);
    document.addEventListener('input', this.handleInput, true);
    document.addEventListener('keyup', this.handleInput, true);
    document.addEventListener('mouseup', this.handleInput, true);
    document.addEventListener('selectionchange', this.handleSelectionChange, true);
    window.addEventListener('scroll', this.handleViewportChange, true);
    window.addEventListener('resize', this.handleViewportChange, true);
    browser.runtime.onMessage.addListener((message: unknown) => this.handleMessage(message as ContentMessage));
  }

  private handleFocusIn = (event: FocusEvent): void => {
    if (!isSupportedEditor(event.target)) {
      return;
    }
    this.activeElement = event.target;
    this.refreshActiveEditor();
  };

  private handleInput = (): void => {
    this.refreshActiveEditor();
  };

  private handleSelectionChange = (): void => {
    if (!this.activeElement) {
      return;
    }
    this.refreshActiveEditor();
  };

  private handleViewportChange = (): void => {
    if (!this.activeElement) {
      return;
    }
    this.refreshActiveEditor({ preservePopover: true });
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

    const active = this.activeElement && isSupportedEditor(this.activeElement) ? this.activeElement : currentActiveEditor();
    if (!active) {
      this.activeElement = null;
      this.activeSurface = null;
      this.activeResult = null;
      this.clearDecorations();
      return;
    }

    const surface = buildEditorSurface(active, window.location.hostname);
    if (!surface || !surface.text.trim()) {
      this.activeElement = active;
      this.activeSurface = surface;
      this.activeResult = null;
      this.clearDecorations();
      return;
    }

    this.activeElement = active;
    this.activeSurface = surface;

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
        suggestion: suggestionsByRule.get(match.ruleId),
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
        button.addEventListener('click', () => this.openPopover(decoration));
        this.overlayRoot.append(button);
      }
    }

    this.statusElement.hidden = surface.supportsQuickReplace;
    if (!surface.supportsQuickReplace) {
      this.statusElement.textContent = 'Overlay only';
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

  private openPopover(decoration: RenderedDecoration): void {
    const anchor = decoration.rects[0];
    if (!anchor) {
      return;
    }

    this.popoverElement.dataset.decorationId = decoration.id;
    this.popoverElement.hidden = false;
    this.popoverElement.style.left = `${Math.min(window.innerWidth - 296, anchor.left)}px`;
    this.popoverElement.style.top = `${Math.max(16, anchor.top - 12 - 140)}px`;
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

    const mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'action';
    mute.textContent = 'Mute term';
    mute.addEventListener('click', () => void this.muteTerm(decoration.match.term));
    buttons.append(mute);

    this.popoverElement.append(eyebrow, title, copy, buttons);
  }

  private closePopover(): void {
    this.popoverElement.hidden = true;
    this.popoverElement.dataset.decorationId = '';
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
    this.statusElement.hidden = true;
    this.closePopover();
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
  const active = document.activeElement;
  return isSupportedEditor(active) ? active : null;
}
