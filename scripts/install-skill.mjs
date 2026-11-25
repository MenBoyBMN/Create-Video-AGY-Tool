#!/usr/bin/env node
/**
 * AGY Video Studio — Install / Sync `/agy-video-studio` Skill into `~/.agents/skills/agy-video-studio`
 * Copies SKILL.md + references/ from `.agents/skills/agy-video-studio/` (excluding machine-local app-path.json)
 * and registers the current machine's `app-path.json`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const templateDir = path.join(repoRoot, '.agents', 'skills', 'agy-video-studio');
const skillDir = path.join(os.homedir(), '.agents', 'skills', 'agy-video-studio');

if (!fs.existsSync(path.join(templateDir, 'SKILL.md'))) {
  console.error(`[install-skill] Missing skill source at ${templateDir}`);
  process.exit(1);
}

fs.mkdirSync(skillDir, { recursive: true });
fs.cpSync(templateDir, skillDir, {
  recursive: true,
  force: true,
  filter: (src) => path.basename(src) !== 'app-path.json',
});

const portableDir = path.join(repoRoot, 'release', 'AGY-Video-Studio');
const portableExe = path.join(portableDir, 'AGY-Video-Studio.exe');
const targetRoot = fs.existsSync(portableExe) ? portableDir : repoRoot;

const appPathPayload = {
  appRoot: targetRoot,
  cli: path.join(targetRoot, 'cli', 'agy-studio.mjs'),
  projectsDir: path.join(targetRoot, 'projects'),
  exportsDir: path.join(targetRoot, 'exports'),
  exePath: fs.existsSync(portableExe) ? portableExe : path.join(targetRoot, 'AGY-Video-Studio.exe'),
  updatedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(skillDir, 'app-path.json'),
  JSON.stringify(appPathPayload, null, 2),
  'utf-8'
);

console.log(`[install-skill] Installed /agy-video-studio skill to: ${skillDir}`);
console.log(`[install-skill] Synced appRoot -> ${targetRoot}`);
