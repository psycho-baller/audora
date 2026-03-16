import fs from 'node:fs';
import path from 'node:path';

import {
  getWritingAwarenessStoragePaths,
  loadWritingAwarenessBootstrapFromDisk,
  loadWritingAwarenessSeedFromDisk,
  loadWritingAwarenessStateFromDisk,
  saveLearningTargetToState,
  saveWritingAwarenessStateToDisk,
  summarizeWritingAwarenessEvents,
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

export default class AudoraObsidianPlugin extends Plugin {
  settings: ObsidianAudoraPluginSettings = DEFAULT_SETTINGS;
  bootstrap: DiskBootstrapPayload | null = null;

  private readonly editorControllers = new Set<AudoraEditorControllerHandle>();
  private settingsTab: AudoraWritingSettingTab | null = null;
  private storageWatcher: fs.FSWatcher | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private syncStatus = 'Waiting for Audora storage.';

  get storageRootPath(): string {
    return getWritingAwarenessStoragePaths(this.storageOptions).rootDirectory;
  }

  get syncStatusMessage(): string {
    return this.syncStatus;
  }

  get storageOptions() {
    return {
      fallbackSeedPath: this.bundledSeedPath(),
      preferFallbackSeed: true,
    };
  }

  async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };

    await this.reloadBootstrapFromDisk();
    this.startStorageWatch();

    this.addSettingTab((this.settingsTab = new AudoraWritingSettingTab(this)));
    this.registerEditorExtension(createAudoraEditorExtension(this));

    this.addCommand({
      id: 'refresh-writing-awareness',
      name: 'Refresh Audora rules from disk',
      callback: async () => {
        await this.reloadBootstrapFromDisk({ showNotice: true });
      },
    });

    this.addCommand({
      id: 'reload-bundled-seed',
      name: 'Reload bundled Audora seed',
      callback: async () => {
        await this.reloadBundledSeed({ showNotice: true });
      },
    });

    this.addCommand({
      id: 'next-writing-issue',
      name: 'Jump to next Audora issue',
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
      name: 'Jump to previous Audora issue',
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
        name: `Apply ${label} Audora suggestion`,
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
      name: 'Add selection to Audora learning words',
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
          void this.addSelectionToLearningWords(view);
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
    await this.saveData(this.settings);
    this.refreshAllEditors();
    this.settingsTab?.display();
  }

  async reloadBootstrapFromDisk(options: { showNotice?: boolean } = {}): Promise<void> {
    try {
      this.bootstrap = await loadWritingAwarenessBootstrapFromDisk({
        ...this.storageOptions,
        currentSite: 'obsidian',
      });
      this.syncStatus = `Loaded ${this.bootstrap.seed.rules.length} base rules from ${this.bootstrap.storageRoot}.`;
      this.refreshAllEditors();
      this.settingsTab?.display();
      if (options.showNotice) {
        new Notice('Audora rules refreshed from disk.');
      }
    } catch (error) {
      this.syncStatus = error instanceof Error ? error.message : 'Failed to load Audora rules.';
      this.settingsTab?.display();
      if (options.showNotice) {
        new Notice(this.syncStatus);
      }
    }
  }

  async reloadBundledSeed(options: { showNotice?: boolean } = {}): Promise<void> {
    try {
      const seed = await loadWritingAwarenessSeedFromDisk({
        ...this.storageOptions,
        forceFallbackSeed: true,
      });
      const currentState = await loadWritingAwarenessStateFromDisk(this.storageOptions);
      await saveWritingAwarenessStateToDisk(
        {
          ...currentState,
          lastSeedRunId: seed.sourceRunId,
          lastSeedSyncedAt: new Date().toISOString(),
        },
        this.storageOptions
      );
      await this.reloadBootstrapFromDisk();
      if (options.showNotice) {
        new Notice('Bundled Audora seed reloaded.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reload bundled seed.';
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

    const currentState = await this.currentState();
    if (currentState.mutedTerms.includes(normalized)) {
      return;
    }

    await this.persistState({
      ...currentState,
      mutedTerms: [...currentState.mutedTerms, normalized],
    });
    new Notice(`Muted "${normalized}" in Audora.`);
  }

  private async addSelectionToLearningWords(view: EditorView): Promise<void> {
    const selection = view.state.sliceDoc(
      view.state.selection.main.from,
      view.state.selection.main.to
    );
    const currentState = await this.currentState();
    const activeFile = this.app.workspace.getActiveFile();
    const saved = saveLearningTargetToState({
      state: currentState,
      text: selection,
      sourceApp: 'Obsidian',
      contextLabel: activeFile?.basename ?? 'Obsidian note',
      origin: 'selection',
    });

    if (saved.result.status !== 'invalid') {
      await this.persistState(saved.state);
    }

    new Notice(saved.result.message);
  }

  private async persistState(nextState: Partial<WritingAwarenessDiskState>): Promise<void> {
    const savedState = await saveWritingAwarenessStateToDisk(nextState, this.storageOptions);
    if (this.bootstrap) {
      this.bootstrap = {
        ...this.bootstrap,
        state: savedState,
        summary: summarizeWritingAwarenessEvents(savedState),
      };
    } else {
      this.bootstrap = await loadWritingAwarenessBootstrapFromDisk({
        ...this.storageOptions,
        currentSite: 'obsidian',
      });
    }
    this.syncStatus = `Loaded ${this.bootstrap.seed.rules.length} base rules from ${this.bootstrap.storageRoot}.`;
    this.refreshAllEditors();
    this.settingsTab?.display();
  }

  private async currentState(): Promise<WritingAwarenessDiskState> {
    return this.bootstrap?.state ?? loadWritingAwarenessStateFromDisk(this.storageOptions);
  }

  private startStorageWatch(): void {
    try {
      fs.mkdirSync(this.storageRootPath, { recursive: true });
      this.storageWatcher = fs.watch(this.storageRootPath, { persistent: false }, (_event, fileName) => {
        const changed = fileName ? String(fileName) : null;
        if (changed !== 'seed.json' && changed !== 'state.json') {
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
        error instanceof Error ? error.message : 'Failed to watch Audora storage directory.';
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

  private bundledSeedPath(): string | null {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      return null;
    }

    return path.join(
      adapter.getBasePath(),
      this.app.vault.configDir,
      'plugins',
      this.manifest.id,
      'WritingAwarenessSeed.json'
    );
  }
}
