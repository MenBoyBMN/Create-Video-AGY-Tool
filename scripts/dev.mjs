import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const DEV_URL = 'http://localhost:5179';

function waitForUrl(url, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - started > timeoutMs) {
            reject(new Error(`Timed out waiting for ${url}`));
          } else {
            setTimeout(check, 250);
          }
        });
    };
    check();
  });
}

async function run() {
  // Build electron main & preload first
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(root, 'scripts', 'build-electron.mjs')], {
      cwd: root,
      stdio: 'inherit',
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`build-electron exited ${code}`))));
  });

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const viteProc = spawn(npmCmd, ['run', 'dev:web'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });

  await waitForUrl(DEV_URL);

  const electronBin = path.join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron'
  );
  const electronProc = spawn(electronBin, ['.'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: DEV_URL,
    },
  });

  electronProc.on('close', () => {
    viteProc.kill();
    process.exit(0);
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
