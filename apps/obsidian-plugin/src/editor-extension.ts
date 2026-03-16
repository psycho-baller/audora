import { analyzeWriting, type WritingCheckResult } from '@audora/writing-awareness-core';
import { StateEffect, StateField, type EditorState, type Extension, RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  hoverTooltip,
  showTooltip,
  type DecorationSet,
  type Tooltip,
  type TooltipView,
  type ViewUpdate,
} from '@codemirror/view';

import { buildProjectedDocument } from './projection';
import type AudoraObsidianPlugin from './main';
import type { ObsidianWritingDiagnostic } from './types';

const setDiagnosticsEffect = StateEffect.define<readonly ObsidianWritingDiagnostic[]>();
const clearDiagnosticsEffect = StateEffect.define<void>();
const setCursorDiagnosticEffect = StateEffect.define<ObsidianWritingDiagnostic | null>();

const diagnosticsField = StateField.define<readonly ObsidianWritingDiagnostic[]>({
  create() {
    return [];
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        return effect.value;
      }
      if (effect.is(clearDiagnosticsEffect)) {
        return [];
      }
    }
    return value;
  },
});

const decorationsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        return buildDecorations(effect.value);
      }
      if (effect.is(clearDiagnosticsEffect)) {
        return Decoration.none;
      }
    }
    return transaction.docChanged ? value.map(transaction.changes) : value;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

const cursorDiagnosticField = StateField.define<ObsidianWritingDiagnostic | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setCursorDiagnosticEffect)) {
        return effect.value;
      }
      if (effect.is(clearDiagnosticsEffect)) {
        return null;
      }
    }
    return value;
  },
  provide(field) {
    return showTooltip.computeN([field], (state) => {
      const diagnostic = state.field(field);
      return diagnostic ? [tooltipForDiagnostic(diagnostic)] : [];
    });
  },
});

export interface AudoraEditorControllerHandle {
  forceRefresh(): void;
}

export function createAudoraEditorExtension(plugin: AudoraObsidianPlugin): Extension[] {
  return [
    diagnosticsField,
    decorationsField,
    cursorDiagnosticField,
    hoverTooltip((view, position) => {
      const diagnostic = diagnosticAtPosition(audoraDiagnosticsForState(view.state), position);
      return diagnostic ? interactiveTooltipForDiagnostic(view, diagnostic, plugin) : null;
    }),
    ViewPlugin.fromClass(
      class AudoraEditorController implements AudoraEditorControllerHandle {
        private analysisTimer: number | null = null;
        private cursorTimer: number | null = null;
        private lastFingerprint = '';

        constructor(private readonly view: EditorView) {
          plugin.registerEditorController(this);
          this.forceRefresh();
        }

        update(update: ViewUpdate): void {
          if (update.docChanged) {
            this.scheduleAnalysis();
            return;
          }

          if (update.selectionSet || update.focusChanged) {
            this.scheduleCursorRefresh();
          }
        }

        destroy(): void {
          plugin.unregisterEditorController(this);
          if (this.analysisTimer !== null) {
            window.clearTimeout(this.analysisTimer);
          }
          if (this.cursorTimer !== null) {
            window.clearTimeout(this.cursorTimer);
          }
        }

        forceRefresh(): void {
          if (!plugin.settings.automaticChecking) {
            this.clearDiagnostics();
            return;
          }

          if (this.analysisTimer !== null) {
            window.clearTimeout(this.analysisTimer);
          }
          this.analysisTimer = window.setTimeout(() => {
            this.analysisTimer = null;
            this.runAnalysis();
          }, 0);
        }

        private scheduleAnalysis(): void {
          if (this.analysisTimer !== null) {
            window.clearTimeout(this.analysisTimer);
          }
          this.analysisTimer = window.setTimeout(() => {
            this.analysisTimer = null;
            this.runAnalysis();
          }, plugin.settings.debounceMs);
        }

        private scheduleCursorRefresh(): void {
          if (this.cursorTimer !== null) {
            window.clearTimeout(this.cursorTimer);
          }
          this.cursorTimer = window.setTimeout(() => {
            this.cursorTimer = null;
            this.refreshCursorDiagnostic();
          }, 0);
        }

        private runAnalysis(): void {
          const bootstrap = plugin.bootstrap;
          if (!bootstrap) {
            this.clearDiagnostics();
            return;
          }

          const projected = buildProjectedDocument(this.view.state);
          if (!projected.projectedText.trim().length) {
            this.clearDiagnostics();
            return;
          }

          const analysis = analyzeWriting({
            text: projected.projectedText,
            seed: bootstrap.seed,
            state: bootstrap.state,
            focusPack: bootstrap.focusPack,
            subtleRewards: plugin.settings.showRewardUnderlines,
            currentSite: 'obsidian',
          });

          const diagnostics = diagnosticsFromResult(projected.sourceText, analysis.result);
          const fingerprint = diagnosticsFingerprint(diagnostics);
          if (fingerprint !== this.lastFingerprint) {
            this.view.dispatch({
              effects: [setDiagnosticsEffect.of(diagnostics)],
            });
            this.lastFingerprint = fingerprint;
          }

          this.refreshCursorDiagnostic(diagnostics);
        }

        private refreshCursorDiagnostic(
          diagnostics = audoraDiagnosticsForState(this.view.state)
        ): void {
          const selection = this.view.state.selection.main;
          if (!selection.empty) {
            this.setCursorDiagnostic(null);
            return;
          }

          const diagnostic = diagnosticAtPosition(diagnostics, selection.head);
          this.setCursorDiagnostic(diagnostic ?? null);
        }

        private setCursorDiagnostic(diagnostic: ObsidianWritingDiagnostic | null): void {
          const existing = this.view.state.field(cursorDiagnosticField);
          if (sameDiagnostic(existing, diagnostic)) {
            return;
          }
          this.view.dispatch({
            effects: [setCursorDiagnosticEffect.of(diagnostic)],
          });
        }

        private clearDiagnostics(): void {
          this.lastFingerprint = '';
          this.view.dispatch({
            effects: [clearDiagnosticsEffect.of()],
          });
        }
      }
    ),
  ];
}

export function audoraDiagnosticsForState(state: EditorState): readonly ObsidianWritingDiagnostic[] {
  return state.field(diagnosticsField, false) ?? [];
}

export function diagnosticNearSelection(
  state: EditorState
): ObsidianWritingDiagnostic | null {
  const diagnostics = audoraDiagnosticsForState(state);
  if (!diagnostics.length) {
    return null;
  }

  const cursor = state.selection.main.head;
  const containing = diagnosticAtPosition(diagnostics, cursor);
  if (containing) {
    return containing;
  }

  return diagnostics.find((diagnostic) => diagnostic.from >= cursor) ?? diagnostics[0] ?? null;
}

export function nextDiagnostic(
  state: EditorState,
  direction: 'forward' | 'backward'
): ObsidianWritingDiagnostic | null {
  const diagnostics = audoraDiagnosticsForState(state);
  if (!diagnostics.length) {
    return null;
  }

  const cursor = state.selection.main.head;
  if (direction === 'forward') {
    return (
      diagnostics.find((diagnostic) => diagnostic.from > cursor) ??
      diagnostics[0] ??
      null
    );
  }

  for (let index = diagnostics.length - 1; index >= 0; index -= 1) {
    if (diagnostics[index].to < cursor) {
      return diagnostics[index];
    }
  }

  return diagnostics[diagnostics.length - 1] ?? null;
}

function diagnosticsFromResult(
  sourceText: string,
  result: WritingCheckResult
): ObsidianWritingDiagnostic[] {
  const suggestions = new Map(result.suggestedReplacements.map((entry) => [entry.ruleId, entry]));

  const avoid = result.flaggedTerms.map((match) => {
    const suggestion = suggestions.get(match.ruleId);
    return {
      id: `avoid:${match.id}`,
      kind: 'avoid' as const,
      ruleId: match.ruleId,
      term: sourceText.slice(match.rangeLower, match.rangeUpper),
      from: match.rangeLower,
      to: match.rangeUpper,
      message: suggestion?.message ?? 'Use a more precise word here.',
      snippet: match.snippet,
      replacements: suggestion?.replacements ?? [],
    };
  });

  const rewards = result.rewardedTerms.map((match) => ({
    id: `reward:${match.id}`,
    kind: 'reward' as const,
    ruleId: match.ruleId,
    term: sourceText.slice(match.rangeLower, match.rangeUpper),
    from: match.rangeLower,
    to: match.rangeUpper,
    message: 'Strong word choice here.',
    snippet: match.snippet,
    replacements: [],
  }));

  return [...avoid, ...rewards].sort((left, right) => left.from - right.from);
}

function buildDecorations(
  diagnostics: readonly ObsidianWritingDiagnostic[]
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const diagnostic of diagnostics) {
    builder.add(
      diagnostic.from,
      diagnostic.to,
      Decoration.mark({
        class: diagnostic.kind === 'avoid' ? 'cm-audora-avoid' : 'cm-audora-reward',
      })
    );
  }
  return builder.finish();
}

function diagnosticAtPosition(
  diagnostics: readonly ObsidianWritingDiagnostic[],
  position: number
): ObsidianWritingDiagnostic | null {
  return (
    diagnostics.find((diagnostic) => position >= diagnostic.from && position <= diagnostic.to) ??
    null
  );
}

function interactiveTooltipForDiagnostic(
  view: EditorView,
  diagnostic: ObsidianWritingDiagnostic,
  plugin: AudoraObsidianPlugin
): Tooltip {
  return {
    pos: diagnostic.from,
    end: diagnostic.to,
    above: false,
    create(): TooltipView {
      return createTooltipView(view, diagnostic, plugin);
    },
  };
}

function tooltipForDiagnostic(diagnostic: ObsidianWritingDiagnostic): Tooltip {
  return {
    pos: diagnostic.from,
    end: diagnostic.to,
    above: false,
    create(): TooltipView {
      const dom = document.createElement('div');
      dom.className = 'cm-tooltip audora-writing-tooltip';
      renderTooltipContent(dom, diagnostic, null);
      return { dom };
    },
  };
}

function createTooltipView(
  view: EditorView,
  diagnostic: ObsidianWritingDiagnostic,
  plugin: AudoraObsidianPlugin
): TooltipView {
  const dom = document.createElement('div');
  dom.className = 'cm-tooltip audora-writing-tooltip';
  renderTooltipContent(dom, diagnostic, {
    onApply: async (replacement) => {
      plugin.applyReplacement(view, diagnostic, replacement);
    },
    onMute: async () => {
      await plugin.muteTerm(diagnostic.term);
    },
  });
  return { dom };
}

function renderTooltipContent(
  dom: HTMLElement,
  diagnostic: ObsidianWritingDiagnostic,
  actions: {
    onApply: (replacement: string) => Promise<void> | void;
    onMute: () => Promise<void> | void;
  } | null
): void {
  const eyebrow = dom.createDiv({ cls: 'audora-writing-tooltip__eyebrow' });
  eyebrow.textContent = diagnostic.kind === 'avoid' ? 'Sharpen wording' : 'Rewarded language';

  const title = dom.createDiv({ cls: 'audora-writing-tooltip__title' });
  title.textContent =
    diagnostic.kind === 'avoid'
      ? `"${diagnostic.term}" can be sharper here`
      : `"${diagnostic.term}" lands well here`;

  const copy = dom.createDiv({ cls: 'audora-writing-tooltip__copy' });
  copy.textContent = diagnostic.message;

  if (diagnostic.snippet) {
    const snippet = dom.createDiv({ cls: 'audora-writing-tooltip__snippet' });
    snippet.textContent = diagnostic.snippet;
  }

  if (!actions) {
    return;
  }

  const actionRow = dom.createDiv({ cls: 'audora-writing-tooltip__actions' });

  for (const replacement of diagnostic.replacements.slice(0, 3)) {
    const button = actionRow.createEl('button', {
      cls: 'audora-writing-tooltip__button audora-writing-tooltip__button--primary',
      text: replacement,
    });
    button.addEventListener('click', () => {
      void actions.onApply(replacement);
    });
  }

  const muteButton = actionRow.createEl('button', {
    cls: 'audora-writing-tooltip__button',
    text: 'Ignore term',
  });
  muteButton.addEventListener('click', () => {
    void actions.onMute();
  });
}

function diagnosticsFingerprint(diagnostics: readonly ObsidianWritingDiagnostic[]): string {
  return diagnostics
    .map((diagnostic) => `${diagnostic.id}:${diagnostic.from}:${diagnostic.to}:${diagnostic.kind}`)
    .join('|');
}

function sameDiagnostic(
  left: ObsidianWritingDiagnostic | null,
  right: ObsidianWritingDiagnostic | null
): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.id === right.id && left.from === right.from && left.to === right.to;
}
