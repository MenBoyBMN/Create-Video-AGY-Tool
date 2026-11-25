import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const unpackedDir = path.join(root, 'release', 'win-unpacked');
const portableDir = path.join(root, 'release', 'AGY-Video-Studio');

if (!fs.existsSync(unpackedDir)) {
  console.error(`[finalize-portable] Missing expected directory: ${unpackedDir}`);
  process.exit(1);
}

// Preserve user data (.env, custom projects, exports, cloned voices) across rebuilds
const backupDir = path.join(os.tmpdir(), `agy-video-studio-backup-${Date.now()}`);
const preservedItems = [];

if (fs.existsSync(portableDir)) {
  const candidates = [
    { rel: '.env', type: 'file' },
    { rel: 'projects', type: 'dir' },
    { rel: 'exports', type: 'dir' },
    { rel: path.join('engine', 'audio', 'voices'), type: 'dir' },
  ];

  for (const item of candidates) {
    const src = path.join(portableDir, item.rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(backupDir, item.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    preservedItems.push(item.rel);
  }

  try {
    fs.rmSync(portableDir, { recursive: true, force: true });
  } catch (err) {
    fs.rmSync(backupDir, { recursive: true, force: true });
    if (err && (err.code === 'EPERM' || err.code === 'EBUSY')) {
      console.error(
        `[finalize-portable] Cannot replace "${portableDir}" because AGY-Video-Studio.exe is currently running.\n` +
        `Please close AGY-Video-Studio.exe and run: node scripts/finalize-portable.mjs`
      );
      process.exit(1);
    }
    throw err;
  }
}

fs.renameSync(unpackedDir, portableDir);

// Ensure clean portable directories exist right beside AGY-Video-Studio.exe
for (const sub of ['projects', 'exports', path.join('engine', 'audio', 'voices')]) {
  fs.mkdirSync(path.join(portableDir, sub), { recursive: true });
}

// Restore preserved user data (never clobbering existing user .env / projects / exports)
if (preservedItems.length > 0 && fs.existsSync(backupDir)) {
  for (const rel of preservedItems) {
    const src = path.join(backupDir, rel);
    const dest = path.join(portableDir, rel);
    if (fs.statSync(src).isDirectory()) {
      for (const entry of fs.readdirSync(src)) {
        const entrySrc = path.join(src, entry);
        const entryDest = path.join(dest, entry);
        if (!fs.existsSync(entryDest)) {
          fs.cpSync(entrySrc, entryDest, { recursive: true });
        }
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }
  fs.rmSync(backupDir, { recursive: true, force: true });
  console.log(`[finalize-portable] Preserved user data: ${preservedItems.join(', ')}`);
}

// Copy demo showcase project & MP4 if present so first launch has a ready-to-explore showcase
const demoId = '2026-11-23_agy-studio-showcase';
const demoSrc = path.join(root, 'projects', demoId);
const demoDest = path.join(portableDir, 'projects', demoId);
if (fs.existsSync(demoSrc) && !fs.existsSync(demoDest)) {
  fs.cpSync(demoSrc, demoDest, { recursive: true });
}
const demoMp4 = `${demoId}_16x9.mp4`;
const demoMp4Src = path.join(root, 'exports', demoMp4);
const demoMp4Dest = path.join(portableDir, 'exports', demoMp4);
if (fs.existsSync(demoMp4Src) && !fs.existsSync(demoMp4Dest)) {
  fs.copyFileSync(demoMp4Src, demoMp4Dest);
}

const exePath = path.join(portableDir, 'AGY-Video-Studio.exe');
console.log(`[finalize-portable] Portable folder ready: ${portableDir}`);
console.log(`[finalize-portable] Executable: ${exePath} (exists=${fs.existsSync(exePath)})`);
