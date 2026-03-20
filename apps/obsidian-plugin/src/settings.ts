import { PluginSettingTab, Setting } from 'obsidian';

import type AudoraObsidianPlugin from './main';

export class AudoraWritingSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: AudoraObsidianPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Eloq Writing Awareness' });

    new Setting(containerEl)
      .setName('Automatic checking')
      .setDesc('Analyze the active note as you type in Source mode and Live Preview.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.automaticChecking).onChange(async (value) => {
          await this.plugin.updateSettings({ automaticChecking: value });
        })
      );

    new Setting(containerEl)
      .setName('Reward underlines')
      .setDesc('Show subtle underlines for target words that Eloq wants to reinforce.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showRewardUnderlines).onChange(async (value) => {
          await this.plugin.updateSettings({ showRewardUnderlines: value });
        })
      );

    new Setting(containerEl)
      .setName('Debounce interval')
      .setDesc('Wait time before Eloq rechecks the note after an edit.')
      .addText((text) =>
        text
          .setPlaceholder('220')
          .setValue(String(this.plugin.settings.debounceMs))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isNaN(parsed)) {
              return;
            }
            await this.plugin.updateSettings({
              debounceMs: Math.max(50, Math.min(1500, parsed)),
            });
          })
      );

    new Setting(containerEl)
      .setName('Eloq storage path')
      .setDesc(this.plugin.storageRootPath);

    new Setting(containerEl)
      .setName('Sync status')
      .setDesc(this.plugin.syncStatusMessage)
      .addButton((button) =>
        button.setButtonText('Refresh from disk').onClick(async () => {
          await this.plugin.reloadBootstrapFromDisk({ showNotice: true });
          this.display();
        })
      )
      .addButton((button) =>
        button.setButtonText('Reload bundled snapshot').onClick(async () => {
          await this.plugin.reloadBundledSnapshot({ showNotice: true });
          this.display();
        })
      );

    const bootstrap = this.plugin.bootstrap;
    if (bootstrap) {
      new Setting(containerEl)
        .setName('Snapshot summary')
        .setDesc(
          `${bootstrap.snapshot?.summary.totalWords ?? 0} words, ${bootstrap.snapshot?.summary.acceptedConnections ?? 0} accepted links, ${bootstrap.state.mutedTerms.length} muted terms.`
        );
    }
  }
}
