import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.join(rootDirectory, 'dist');
const manifestPath = path.join(rootDirectory, 'manifest.json');
const obsidianConfigPath = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'obsidian',
  'obsidian.json'
);

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const pluginID = manifest.id;

const explicitVault = parseVaultArgument(process.argv.slice(2));
const vaultPath = explicitVault ?? (await resolveOpenVaultPath());

if (!vaultPath) {
  throw new Error(
    'Could not determine an Obsidian vault. Pass one explicitly with --vault "/absolute/path/to/vault".'
  );
}

await fs.mkdir(path.join(vaultPath, '.obsidian', 'plugins'), { recursive: true });
const targetPath = path.join(vaultPath, '.obsidian', 'plugins', pluginID);

await ensureDistExists();
await installSymlink({ sourcePath: distDirectory, targetPath });

console.log(`[eloq-obsidian-plugin] linked ${targetPath} -> ${distDirectory}`);

function parseVaultArgument(argv) {
  const vaultIndex = argv.indexOf('--vault');
  if (vaultIndex >= 0) {
    return argv[vaultIndex + 1] ?? null;
  }

  const prefixedArgument = argv.find((entry) => entry.startsWith('--vault='));
  if (prefixedArgument) {
    return prefixedArgument.slice('--vault='.length);
  }

  return null;
}

async function resolveOpenVaultPath() {
  const obsidianConfig = JSON.parse(await fs.readFile(obsidianConfigPath, 'utf8'));
  const vaultEntries = Object.values(obsidianConfig?.vaults ?? {});
  const openVault = vaultEntries.find((vault) => vault?.open && typeof vault.path === 'string');
  if (openVault?.path) {
    return openVault.path;
  }

  const mostRecentVault = vaultEntries
    .filter((vault) => typeof vault?.path === 'string')
    .sort((left, right) => Number(right?.ts ?? 0) - Number(left?.ts ?? 0))[0];

  return mostRecentVault?.path ?? null;
}

async function ensureDistExists() {
  const stats = await fs.stat(distDirectory).catch(() => null);
  if (!stats?.isDirectory()) {
    throw new Error(`Missing build output at ${distDirectory}. Run the plugin build first.`);
  }
}

async function installSymlink({ sourcePath, targetPath }) {
  const existing = await fs.lstat(targetPath).catch(() => null);
  if (!existing) {
    await fs.symlink(sourcePath, targetPath, 'dir');
    return;
  }

  if (existing.isSymbolicLink()) {
    const linkedPath = await fs.readlink(targetPath);
    const resolvedLinkedPath = path.resolve(path.dirname(targetPath), linkedPath);
    if (resolvedLinkedPath === sourcePath) {
      return;
    }

    await fs.rm(targetPath, { force: true, recursive: true });
    await fs.symlink(sourcePath, targetPath, 'dir');
    return;
  }

  const backupPath = `${targetPath}.backup-${Date.now()}`;
  await fs.rename(targetPath, backupPath);
  await fs.symlink(sourcePath, targetPath, 'dir');
  console.log(`[eloq-obsidian-plugin] existing plugin moved to ${backupPath}`);
}
