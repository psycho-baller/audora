import { spawn } from 'node:child_process';

const cwd = new URL('..', import.meta.url).pathname;

function start(name, command, args) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${name} exited with signal ${signal}`);
      return;
    }
    if (code && code !== 0) {
      console.log(`${name} exited with code ${code}`);
      process.exit(code);
    }
  });

  return child;
}

const api = start('api', 'python3', ['-m', 'transcript_lab.api']);
const web = start('web', 'vite', ['--config', 'vite.config.ts']);

function shutdown() {
  api.kill('SIGTERM');
  web.kill('SIGTERM');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
