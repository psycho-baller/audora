import path from 'node:path';

import react from '@vitejs/plugin-react';
import { build as esbuild } from 'esbuild';
import { defineConfig, type Plugin } from 'vite';

const browserTarget = process.env.BROWSER_TARGET === 'firefox' ? 'firefox' : 'chrome';

function buildManifest(target: 'chrome' | 'firefox') {
  const manifest: Record<string, unknown> = {
    manifest_version: 3,
    name: 'Eloq Writing',
    version: '0.0.1',
    description: 'Read the Eloq vocabulary graph in your browser and surface accepted inline suggestions.',
    permissions: ['storage', 'tabs', 'nativeMessaging'],
    host_permissions: ['<all_urls>'],
    background:
      target === 'firefox'
        ? {
            scripts: ['background.js'],
            type: 'module',
          }
        : {
            service_worker: 'background.js',
            type: 'module',
          },
    action: {
      default_title: 'Eloq Writing',
      default_popup: 'popup.html',
    },
    options_page: 'options.html',
    commands: {
      'toggle-writing-awareness': {
        suggested_key: {
          default: 'Alt+Shift+A',
        },
        description: 'Open the first active writing suggestion on the current page.',
      },
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        all_frames: true,
        match_about_blank: true,
        match_origin_as_fallback: true,
        run_at: 'document_idle',
      },
    ],
    browser_specific_settings:
      target === 'firefox'
        ? {
            gecko: {
              id: 'writing-awareness@audora.local',
            },
          }
        : undefined,
  };

  if (target !== 'firefox') {
    delete manifest.browser_specific_settings;
  }

  return manifest;
}

function manifestPlugin(target: 'chrome' | 'firefox'): Plugin {
  return {
    name: 'audora-extension-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(buildManifest(target), null, 2),
      });
    },
  };
}

function bundledContentScriptPlugin(target: 'chrome' | 'firefox'): Plugin {
  return {
    name: 'audora-bundled-content-script',
    apply: 'build',
    async closeBundle() {
      const outdir = path.resolve(__dirname, 'dist', target);
      await esbuild({
        entryPoints: [path.resolve(__dirname, 'src/content/index.ts')],
        outfile: path.join(outdir, 'content.js'),
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        sourcemap: false,
        jsx: 'automatic',
        loader: {
          '.css': 'text',
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), manifestPlugin(browserTarget), bundledContentScriptPlugin(browserTarget)],
  publicDir: 'public',
  build: {
    outDir: path.resolve(__dirname, 'dist', browserTarget),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        options: path.resolve(__dirname, 'options.html'),
        background: path.resolve(__dirname, 'src/background/index.ts'),
        content: path.resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content.js';
          }
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
