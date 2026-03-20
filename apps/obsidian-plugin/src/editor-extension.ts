import { analyzeWriting, type WritingCheckResult } from '@audora/writing-awareness-core';
import type { EloqSnapshotReadModel } from '@audora/writing-awareness-storage';
import { StateEffect, StateField, type EditorState, type Extension, RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  hoverTooltip,
  type DecorationSet,
  type Tooltip,
  type TooltipView,
  type ViewUpdate,
} from '@codemirror/view';

import { buildProjectedDocument } from './projection';
import type AudoraObsidianPlugin from './main';
import type { ObsidianReplacementDetail, ObsidianWritingDiagnostic } from './types';

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
      return diagnostic ? interactiveTooltipForDiagnostic(diagnostic, plugin) : null;
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

          const diagnostics = diagnosticsFromResult(
            projected.sourceText,
            analysis.result,
            bootstrap.snapshot
          );
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

export function diagnosticsFromResult(
  sourceText: string,
  result: WritingCheckResult,
  snapshot?: EloqSnapshotReadModel
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

  return hydrateDiagnosticsFromSnapshot(
    dedupeDiagnostics([...avoid, ...rewards]),
    snapshot
  ).sort((left, right) => left.from - right.from);
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
  diagnostic: ObsidianWritingDiagnostic,
  plugin: AudoraObsidianPlugin
): Tooltip {
  return {
    pos: diagnostic.from,
    end: diagnostic.to,
    above: false,
    create(view): TooltipView {
      return createTooltipView(view, diagnostic, plugin);
    },
  };
}

function createTooltipView(
  view: EditorView,
  diagnostic: ObsidianWritingDiagnostic,
  plugin: AudoraObsidianPlugin
): TooltipView {
  const dom = document.createElement('div');
  dom.className = 'audora-writing-tooltip';
  renderTooltipContent(dom, diagnostic, {
    onApply: async (replacement) => {
      plugin.applyReplacement(view, diagnostic, replacement);
    },
  });
  return {
    dom,
    mount() {
      styleTooltipShell(dom);
    },
  };
}

function renderTooltipContent(
  dom: HTMLElement,
  diagnostic: ObsidianWritingDiagnostic,
  actions: {
    onApply: (replacement: string) => Promise<void> | void;
  }
): void {
  const panel = dom.createDiv({
    cls:
      diagnostic.kind === 'avoid'
        ? 'audora-writing-tooltip__panel'
        : 'audora-writing-tooltip__panel audora-writing-tooltip__panel--reward',
  });

  if (diagnostic.kind === 'reward') {
    const title = panel.createDiv({ cls: 'audora-writing-tooltip__title audora-writing-tooltip__title--reward' });
    title.textContent = 'Strong choice.';
    return;
  }

  const title = panel.createDiv({ cls: 'audora-writing-tooltip__title' });
  title.textContent = `Replace "${diagnostic.term}"`;

  if (diagnostic.message) {
    const message = panel.createDiv({ cls: 'audora-writing-tooltip__meta audora-writing-tooltip__meta--lead' });
    message.textContent = diagnostic.message;
  }

  if (diagnostic.sourceExcerpt) {
    const excerpt = panel.createDiv({ cls: 'audora-writing-tooltip__excerpt' });
    excerpt.textContent = diagnostic.sourceExcerpt;
  }

  if (!diagnostic.replacements.length) {
    const emptyState = panel.createDiv({ cls: 'audora-writing-tooltip__meta' });
    emptyState.textContent = 'No saved alternatives yet.';
    return;
  }

  const actionRow = panel.createDiv({ cls: 'audora-writing-tooltip__actions' });

  for (const replacement of diagnostic.replacements.slice(0, 3)) {
    const button = actionRow.createEl('button', {
      cls: 'audora-writing-tooltip__button audora-writing-tooltip__button--primary',
      text: replacement,
    });
    button.addEventListener('click', () => {
      void actions.onApply(replacement);
    });
  }

  if (diagnostic.replacementDetails?.length) {
    const detailList = panel.createDiv({ cls: 'audora-writing-tooltip__detail-list' });

    for (const detail of diagnostic.replacementDetails.slice(0, 3)) {
      const detailRow = detailList.createDiv({ cls: 'audora-writing-tooltip__detail-row' });
      const heading = detailRow.createDiv({ cls: 'audora-writing-tooltip__detail-title' });
      heading.textContent = detail.term;

      if (detail.exampleUsage) {
        const example = detailRow.createDiv({ cls: 'audora-writing-tooltip__meta' });
        example.textContent = detail.exampleUsage;
      } else if (detail.useWhen) {
        const useWhen = detailRow.createDiv({ cls: 'audora-writing-tooltip__meta' });
        useWhen.textContent = detail.useWhen;
      }
    }
  }
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

function dedupeDiagnostics(
  diagnostics: readonly ObsidianWritingDiagnostic[]
): ObsidianWritingDiagnostic[] {
  const merged = new Map<string, ObsidianWritingDiagnostic>();

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.kind}:${diagnostic.from}:${diagnostic.to}:${diagnostic.term.toLowerCase()}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...diagnostic,
        replacements: [...diagnostic.replacements],
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      id: existing.id,
      ruleId: existing.ruleId,
      message: existing.message || diagnostic.message,
      snippet: existing.snippet || diagnostic.snippet,
      replacements: uniqueReplacements([...existing.replacements, ...diagnostic.replacements]),
    });
  }

  return [...merged.values()];
}

function uniqueReplacements(replacements: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const replacement of replacements) {
    const trimmed = replacement.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

function styleTooltipShell(dom: HTMLElement): void {
  const shell = dom.closest('.cm-tooltip') as HTMLElement | null;
  if (!shell) {
    return;
  }

  shell.classList.add('audora-writing-tooltip-shell');
  shell.style.background = 'transparent';
  shell.style.border = '0';
  shell.style.boxShadow = 'none';
  shell.style.padding = '0';
  shell.style.overflow = 'visible';
}

function hydrateDiagnosticsFromSnapshot(
  diagnostics: readonly ObsidianWritingDiagnostic[],
  snapshot?: EloqSnapshotReadModel
): ObsidianWritingDiagnostic[] {
  if (!snapshot) {
    return [...diagnostics];
  }

  const acceptedConnections = Array.isArray(snapshot.connections)
    ? snapshot.connections.filter((connection) => connection.status === 'accepted')
    : [];
  if (!acceptedConnections.length) {
    return [...diagnostics];
  }

  const wordsById = new Map(
    (Array.isArray(snapshot.words) ? snapshot.words : []).map((word) => [String(word.id), word])
  );
  const connectionIndex = new Map<
    string,
    {
      sourceExcerpt: string;
      replacements: Map<string, ObsidianReplacementDetail>;
    }
  >();

  for (const connection of acceptedConnections) {
    const overusedWord = wordsById.get(String(connection.overusedWordID));
    const underusedWord = wordsById.get(String(connection.underusedWordID));
    const overusedTerm = normalizeComparableTerm(connection.overusedTerm ?? overusedWord?.displayTerm ?? '');
    const underusedTerm = String(connection.underusedTerm ?? underusedWord?.displayTerm ?? '').trim();
    const underusedKey = normalizeComparableTerm(underusedTerm);
    if (!overusedTerm || !underusedTerm || !underusedKey) {
      continue;
    }

    const group = connectionIndex.get(overusedTerm) ?? {
      sourceExcerpt: '',
      replacements: new Map<string, ObsidianReplacementDetail>(),
    };

    const sourceExcerpt = normalizedTooltipText(
      connection.sourceExcerpt ??
        overusedWord?.sourceExcerpt ??
        ''
    );
    if (sourceExcerpt && !group.sourceExcerpt) {
      group.sourceExcerpt = sourceExcerpt;
    }

    if (!group.replacements.has(underusedKey)) {
      group.replacements.set(underusedKey, {
        term: underusedTerm,
        rationale: normalizedTooltipText(connection.rationale),
        useWhen: normalizedTooltipText(connection.useWhen),
        caution: normalizedTooltipText(connection.caution),
        sourceExcerpt,
        exampleUsage: normalizedTooltipText(
          connection.exampleUsage ??
            underusedWord?.exampleUsage ??
            ''
        ),
      });
    }

    connectionIndex.set(overusedTerm, group);
  }

  return diagnostics.map((diagnostic) => {
    if (diagnostic.kind !== 'avoid') {
      return diagnostic;
    }

    const group = connectionIndex.get(normalizeComparableTerm(diagnostic.term));
    if (!group) {
      return diagnostic;
    }

    const orderedDetails = uniqueReplacementDetails([
      ...diagnostic.replacements.map((replacement) =>
        group.replacements.get(normalizeComparableTerm(replacement))
      ),
      ...group.replacements.values(),
    ]);

    return {
      ...diagnostic,
      replacements: orderedDetails.length
        ? orderedDetails.map((detail) => detail.term)
        : diagnostic.replacements,
      sourceExcerpt: group.sourceExcerpt || diagnostic.sourceExcerpt,
      replacementDetails: orderedDetails,
    };
  });
}

function uniqueReplacementDetails(
  details: readonly (ObsidianReplacementDetail | undefined)[]
): ObsidianReplacementDetail[] {
  const seen = new Set<string>();
  const output: ObsidianReplacementDetail[] = [];

  for (const detail of details) {
    if (!detail) {
      continue;
    }
    const key = normalizeComparableTerm(detail.term);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(detail);
  }

  return output;
}

function normalizedTooltipText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeComparableTerm(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}
