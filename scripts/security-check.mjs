#!/usr/bin/env node
/**
 * AGY Video Studio — Pre-Release & Pre-Push Security / Hygiene Audit
 * Ensures no `.env`, API keys, voice clones, heavy binaries, caches, or personal machine paths
 * are tracked or left unignored before committing/pushing to GitHub.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const FORBIDDEN_FILE_PATTERNS = [
  { name: '.env secret file', re: /(^|\/)\.env(\.[^/]+)?$/i, allow: /(^|\/)\.env\.example$/i },
  { name: 'machine-local app-path.json', re: /(^|\/)app-path\.json$/i },
  { name: 'Python bytecode cache', re: /(^|\/)__pycache__(\/|$)|\.pyc$|\.pyo$/i },
  { name: 'compiled binary/video export', re: /^exports\/.+\.(mp4|mov|webm|mkv|wav|mp3)$/i },
  { name: 'voice clone audio', re: /^engine\/audio\/voices\/.+\.(wav|mp3|ogg|m4a)$/i },
  { name: 'generated SFX wav', re: /^engine\/audio\/sfx_library\/.+\.wav$/i },
  { name: 'project binary media/qa', re: /^projects\/.+\.(mp4|wav|mp3|png|jpg|jpeg|webp)$/i },
];

const SECRET_PATTERNS = [
  { name: 'Google/Gemini API Key', re: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
  { name: 'OpenAI/Secret Key (sk-...)', re: /\bsk-[0-9A-Za-z_-]{20,}\b/ },
  { name: 'ElevenLabs Key (sk_...)', re: /\bsk_[0-9A-Za-z_-]{20,}\b/ },
  { name: 'GitHub PAT', re: /\bgh[pousr]_[0-9A-Za-z]{20,}\b/ },
  { name: 'Private Key Block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const PERSONAL_PATH_PATTERNS = [
  { name: 'Hardcoded Windows user path', re: /[A-Za-z]:\\Users\\[^\\\r\n\s"'`]+/i },
  { name: 'Hardcoded local D:\\DEV path', re: /[A-Za-z]:\\DEV\\/i },
];

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.json', '.yml', '.yaml',
  '.md', '.txt', '.html', '.css', '.ps1', '.bat', '.sh', '.example',
]);

function walkFallback(dir, relBase = '') {
  const skipDirs = new Set([
    '.git', 'node_modules', 'dist', 'dist-electron', 'release', '.remotion', '__pycache__', '.venv', 'venv',
  ]);
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      out.push(...walkFallback(path.join(dir, entry.name), rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function getCandidateFiles() {
  if (fs.existsSync(path.join(repoRoot, '.git'))) {
    const res = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    if (res.status === 0) {
      return res.stdout
        .split(/\r?\n/)
        .map((s) => s.trim().replace(/\\/g, '/'))
        .filter(Boolean);
    }
  }
  return walkFallback(repoRoot);
}

const files = getCandidateFiles();
const errors = [];

for (const rel of files) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;

  for (const rule of FORBIDDEN_FILE_PATTERNS) {
    if (rule.re.test(rel) && !(rule.allow && rule.allow.test(rel))) {
      errors.push(`[FORBIDDEN FILE] ${rel} (${rule.name})`);
    }
  }

  const size = fs.statSync(abs).size;
  if (size > MAX_FILE_BYTES) {
    errors.push(`[TOO LARGE >5MB] ${rel} (${(size / (1024 * 1024)).toFixed(2)} MB)`);
  }

  const ext = path.extname(rel).toLowerCase();
  const base = path.basename(rel).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext) || base === 'license' || base === '.gitignore') {
    if (rel === 'scripts/security-check.mjs') continue;
    const content = fs.readFileSync(abs, 'utf-8');
    for (const pat of SECRET_PATTERNS) {
      if (pat.re.test(content)) {
        errors.push(`[SECRET LEAK] ${rel} matched ${pat.name}`);
      }
    }
    for (const pat of PERSONAL_PATH_PATTERNS) {
      if (pat.re.test(content)) {
        errors.push(`[PERSONAL PATH] ${rel} matched ${pat.name}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`\n[check:release] FAILED with ${errors.length} issue(s):\n`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`[check:release] PASSED — ${files.length} repo files audited cleanly (0 secrets, 0 personal paths, 0 junk binaries).`);
