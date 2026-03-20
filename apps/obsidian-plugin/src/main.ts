import fs from 'node:fs';
import path from 'node:path';

import {
  emptyWritingAwarenessDiskState,
  getEloqStoragePaths,
  loadEloqBootstrapFromDisk,
} from '@audora/writing-awareness-storage';
import type { DiskBootstrapPayload, WritingAwarenessDiskState } from '@audora/writing-awareness-storage';
import type { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import {
  FileSystemAdapter,
  MarkdownView,
  Notice,
  Plugin,
} from 'obsidian';

import {
  createAudoraEditorExtension,
  diagnosticNearSelection,
  nextDiagnostic,
  type AudoraEditorControllerHandle,
} from './editor-extension';
import { AudoraWritingSettingTab } from './settings';
import type { ObsidianAudoraPluginSettings, ObsidianWritingDiagnostic } from './types';

const DEFAULT_SETTINGS: ObsidianAudoraPluginSettings = {
  automaticChecking: true,
  showRewardUnderlines: true,
  debounceMs: 220,
};

interface PersistedPluginData {
  settings?: Partial<ObsidianAudoraPluginSettings>;
  localState?: Partial<WritingAwarenessDiskState>;
}

export default class AudoraObsidianPlugin extends Plugin {
  settings: ObsidianAudoraPluginSettings = DEFAULT_SETTINGS;
  bootstrap: DiskBootstrapPayload | null = null;

  private readonly editorControllers = new Set<AudoraEditorControllerHandle>();
  private settingsTab: AudoraWritingSettingTab | null = null;
  private storageWatcher: fs.FSWatcher | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private syncStatus = 'Waiting for Eloq snapshot.';
  private localState: WritingAwarenessDiskState = emptyWritingAwarenessDiskState();

  get storageRootPath(): string {
    return getEloqStoragePaths(this.storageOptions).rootDirectory;
  }

  get syncStatusMessage(): string {
    return this.syncStatus;
  }

  get storageOptions() {
    return {
      fallbackSnapshotPath: this.bundledSnapshotPath(),
      preferFallbackSnapshot: true,
      localState: this.localState,
    };
  }

  async onload(): Promise<void> {
    const persisted = ((await this.loadData()) ?? {}) as PersistedPluginData | Partial<ObsidianAudoraPluginSettings>;
    if ('automaticChecking' in persisted || 'showRewardUnderlines' in persisted || 'debounceMs' in persisted) {
      this.settings = { ...DEFAULT_SETTINGS, ...(persisted as Partial<ObsidianAudoraPluginSettings>) };
      this.localState = emptyWritingAwarenessDiskState();
    } else {
      const structured = persisted as PersistedPluginData;
      this.settings = { ...DEFAULT_SETTINGS, ...(structured.settings ?? {}) };
      this.localState = {
        ...emptyWritingAwarenessDiskState(),
        ...(structured.localState ?? {}),
      };
    }

    await this.reloadBootstrapFromDisk();
    this.startStorageWatch();

    this.addSettingTab((this.settingsTab = new AudoraWritingSettingTab(this)));
    this.registerEditorExtension(createAudoraEditorExtension(this));

    this.addCommand({
      id: 'refresh-writing-awareness',
      name: 'Refresh Eloq snapshot from disk',
      callback: async () => {
        await this.reloadBootstrapFromDisk({ showNotice: true });
      },
    });

    this.addCommand({
      id: 'reload-bundled-seed',
      name: 'Reload bundled Eloq snapshot',
      callback: async () => {
        await this.reloadBundledSnapshot({ showNotice: true });
      },
    });

    this.addCommand({
      id: 'next-writing-issue',
      name: 'Jump to next Eloq issue',
      checkCallback: (checking) => {
        const view = this.activeEditorView();
        const diagnostic = view ? nextDiagnostic(view.state, 'forward') : null;
        if (!diagnostic) {
          return false;
        }
        if (!checking) {
          this.selectDiagnostic(view!, diagnostic);
        }
        return true;
      },
    });

    this.addCommand({
      id: 'previous-writing-issue',
      name: 'Jump to previous Eloq issue',
      checkCallback: (checking) => {
        const view = this.activeEditorView();
        const diagnostic = view ? nextDiagnostic(view.state, 'backward') : null;
        if (!diagnostic) {
          return false;
        }
        if (!checking) {
          this.selectDiagnostic(view!, diagnostic);
        }
        return true;
      },
    });

    for (const [index, label] of ['first', 'second', 'third'].entries()) {
      this.addCommand({
        id: `apply-${label}-suggestion`,
        name: `Apply ${label} Eloq suggestion`,
        checkCallback: (checking) => {
          const view = this.activeEditorView();
          const diagnostic = view ? diagnosticNearSelection(view.state) : null;
          const replacement = diagnostic?.replacements[index];
          if (!view || !diagnostic || !replacement) {
            return false;
          }
          if (!checking) {
            this.applyReplacement(view, diagnostic, replacement);
          }
          return true;
        },
      });
    }

    this.addCommand({
      id: 'add-selection-to-learning-words',
      name: 'Open Eloq to add the current selection',
      checkCallback: (checking) => {
        const view = this.activeEditorView();
        if (!view) {
          return false;
        }
        const selection = view.state.sliceDoc(
          view.state.selection.main.from,
          view.state.selection.main.to
        );
        if (!selection.trim().length) {
          return false;
        }
        if (!checking) {
          new Notice('Add new words in Eloq on macOS. Obsidian is now read-only for vocabulary data.');
        }
        return true;
      },
    });
  }

  onunload(): void {
    if (this.storageWatcher) {
      this.storageWatcher.close();
      this.storageWatcher = null;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  registerEditorController(controller: AudoraEditorControllerHandle): void {
    this.editorControllers.add(controller);
  }

  unregisterEditorController(controller: AudoraEditorControllerHandle): void {
    this.editorControllers.delete(controller);
  }

  async updateSettings(patch: Partial<ObsidianAudoraPluginSettings>): Promise<void> {
    this.settings = {
      ...this.settings,
      ...patch,
    };
    await this.persistPluginData();
    this.refreshAllEditors();
    this.settingsTab?.display();
  }

  async reloadBootstrapFromDisk(options: { showNotice?: boolean } = {}): Promise<void> {
    try {
      this.bootstrap = await loadEloqBootstrapFromDisk({
        ...this.storageOptions,
        currentSite: 'obsidian',
      });
      const acceptedConnections = this.bootstrap.snapshot?.summary.acceptedConnections ?? 0;
      this.syncStatus = `Loaded ${acceptedConnections} accepted Eloq links from ${this.bootstrap.storageRoot}.`;
      this.refreshAllEditors();
      this.settingsTab?.display();
      if (options.showNotice) {
        new Notice('Eloq snapshot refreshed from disk.');
      }
    } catch (error) {
      this.syncStatus = error instanceof Error ? error.message : 'Failed to load Eloq snapshot.';
      this.settingsTab?.display();
      if (options.showNotice) {
        new Notice(this.syncStatus);
      }
    }
  }

  async reloadBundledSnapshot(options: { showNotice?: boolean } = {}): Promise<void> {
    try {
      this.bootstrap = await loadEloqBootstrapFromDisk({
        ...this.storageOptions,
        currentSite: 'obsidian',
        forceFallbackSnapshot: true,
      });
      this.syncStatus = 'Loaded bundled Eloq snapshot.';
      this.refreshAllEditors();
      this.settingsTab?.display();
      if (options.showNotice) {
        new Notice('Bundled Eloq snapshot reloaded.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reload bundled Eloq snapshot.';
      this.syncStatus = message;
      this.settingsTab?.display();
      if (options.showNotice) {
        new Notice(message);
      }
    }
  }

  applyReplacement(view: EditorView, diagnostic: ObsidianWritingDiagnostic, replacement: string): void {
    view.dispatch({
      changes: {
        from: diagnostic.from,
        to: diagnostic.to,
        insert: replacement,
      },
      selection: EditorSelection.cursor(diagnostic.from + replacement.length),
      scrollIntoView: true,
    });
  }

  async muteTerm(term: string): Promise<void> {
    const normalized = term.trim().toLowerCase();
    if (!normalized.length) {
      return;
    }

    if (this.localState.mutedTerms.includes(normalized)) {
      return;
    }

    await this.persistState({
      ...this.localState,
      mutedTerms: [...this.localState.mutedTerms, normalized],
    });
    new Notice(`Muted "${normalized}" in Eloq.`);
  }

  private async persistState(nextState: Partial<WritingAwarenessDiskState>): Promise<void> {
    this.localState = {
      ...emptyWritingAwarenessDiskState(),
      ...this.localState,
      ...nextState,
      ruleOverrides: nextState.ruleOverrides ?? this.localState.ruleOverrides ?? {},
      manualRules: [],
      repairs: nextState.repairs ?? this.localState.repairs ?? [],
      reinforcementEvents: nextState.reinforcementEvents ?? this.localState.reinforcementEvents ?? [],
      mutedSites: nextState.mutedSites ?? this.localState.mutedSites ?? [],
      mutedTerms: nextState.mutedTerms ?? this.localState.mutedTerms ?? [],
    };
    await this.persistPluginData();
    await this.reloadBootstrapFromDisk();
  }

  private async persistPluginData(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      localState: this.localState,
    } satisfies PersistedPluginData);
  }

  private startStorageWatch(): void {
    try {
      fs.mkdirSync(this.storageRootPath, { recursive: true });
      this.storageWatcher = fs.watch(this.storageRootPath, { persistent: false }, (_event, fileName) => {
        const changed = fileName ? String(fileName) : null;
        if (changed !== 'snapshot.json') {
          return;
        }
        if (this.refreshTimer) {
          clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => {
          void this.reloadBootstrapFromDisk();
        }, 120);
      });
      this.register(() => this.storageWatcher?.close());
    } catch (error) {
      this.syncStatus =
        error instanceof Error ? error.message : 'Failed to watch Eloq storage directory.';
      this.settingsTab?.display();
    }
  }

  private refreshAllEditors(): void {
    for (const controller of this.editorControllers) {
      controller.forceRefresh();
    }
  }

  private activeEditorView(): EditorView | null {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      return null;
    }

    const editorView = (markdownView.editor as unknown as { cm?: EditorView }).cm;
    return editorView ?? null;
  }

  private selectDiagnostic(view: EditorView, diagnostic: ObsidianWritingDiagnostic): void {
    view.dispatch({
      selection: {
        anchor: diagnostic.from,
        head: diagnostic.to,
      },
      scrollIntoView: true,
    });
  }

  private bundledSnapshotPath(): string | null {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      return null;
    }

    return path.join(
      adapter.getBasePath(),
      this.app.vault.configDir,
      'plugins',
      this.manifest.id,
      'EloqSnapshot.json'
    );
  }
}
