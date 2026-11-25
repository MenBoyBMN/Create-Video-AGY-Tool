#!/usr/bin/env node
/**
 * AGY Video Studio — Unified 5-Command CLI Bridge
 * Commands:
 *   node cli/agy-studio.mjs info
 *   node cli/agy-studio.mjs init --id <slug> --title "..." --aspect <16:9|9:16> [--preset ...] [--voice ...]
 *   node cli/agy-studio.mjs audio --project <slug>
 *   node cli/agy-studio.mjs qa --project <slug>
 *   node cli/agy-studio.mjs export --project <slug> [--progress]
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compileProjectCustomScenes } from '../engine/runtime/compileCustomScene.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');

const PRESETS_INFO = [
  {
    id: 'saas-motion',
    name: 'SaaS Motion',
    description: 'Adaptive glassmorphic UI showcase, KPI metric counters, step cards & 2.5D grid depth.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'slow_push_in',
  },
  {
    id: 'explainer-editorial',
    name: 'Explainer Editorial',
    description: 'High-contrast editorial typography, chapter watermarks, split media/points & 12fps grain.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'orbit_tilt',
  },
  {
    id: 'shorts-kinetic',
    name: 'Shorts Kinetic',
    description: 'High-retention vertical/horizontal kinetic text, impact shake & bold hero numbers.',
    recommendedAspects: ['9:16', '16:9'],
    defaultCameraMove: 'impact_shake',
  },
  {
    id: 'cinematic-broll',
    name: 'Cinematic B-Roll',
    description: 'Full-bleed video B-roll or AI art with Ken Burns motion, light leaks & lower-thirds.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'slow_push_in',
  },
  {
    id: 'whiteboard-sketch',
    name: 'Whiteboard Sketch',
    description: 'Hand-drawn Rough.js sketch boxes & arrows on textured paper with highlighter sweeps.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'static',
  },
  {
    id: 'tech-3d-data',
    name: 'Tech 3D & Data',
    description: 'Three.js 3D geometric rig with animated bar charts, code windows & 3D device mockups.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'orbit_tilt',
  },
  {
    id: 'dialogue-podcast',
    name: 'Dialogue Podcast',
    description: 'Two-speaker split stage with reactive voice wave bars synced to speaker timings.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'slow_push_in',
  },
];

const VALID_PRESET_IDS = PRESETS_INFO.map((p) => p.id);

const CAPTION_STYLES_INFO = [
  { id: 'glass-dark', name: 'Glass Dark (Mặc định tối kính mờ)' },
  { id: 'editorial-light', name: 'Editorial Light (Nền giấy sáng báo chí)' },
  { id: 'hormozi-pop', name: 'Hormozi Pop (Chữ lớn viền đậm viral)' },
  { id: 'karaoke-glow', name: 'Karaoke Glow (Sáng chữ theo nhịp đọc)' },
  { id: 'minimal-cinematic', name: 'Minimal Cinematic (Phụ đề phim điện ảnh)' },
  { id: 'typewriter-mono', name: 'Typewriter Mono (Kỹ thuật & Podcast)' },
];

const TRANSITIONS_INFO = [
  { id: 'fade', name: 'Fade (Chuyển mờ êm)' },
  { id: 'slide-left', name: 'Slide Left (Trượt ngang)' },
  { id: 'slide-up', name: 'Slide Up (Trượt lên)' },
  { id: 'wipe', name: 'Wipe (Gạt khung sắc nét)' },
  { id: 'whip-pan', name: 'Whip Pan (Lia máy nhanh có blur)' },
  { id: 'flash', name: 'Flash (Lóe sáng chuyển cảnh)' },
  { id: 'glitch', name: 'Glitch (Nhiễu RGB kỹ thuật số)' },
  { id: 'none', name: 'None (Cắt cứng)' },
];

const VOICES_INFO = [
  { id: 'vi-VN-HoaiMyNeural', label: 'Hoài My (Nữ — Tiếng Việt, Edge-TTS Free)', provider: 'edge-tts', lang: 'vi-VN' },
  { id: 'vi-VN-NamMinhNeural', label: 'Nam Minh (Nam — Tiếng Việt, Edge-TTS Free)', provider: 'edge-tts', lang: 'vi-VN' },
  { id: 'gemini:Puck', label: 'Gemini Puck (Diễn cảm & Multi-Speaker — GEMINI_API_KEY)', provider: 'gemini', lang: 'vi-VN' },
  { id: 'gemini:Kore', label: 'Gemini Kore (Nữ tự nhiên & Multi-Speaker — GEMINI_API_KEY)', provider: 'gemini', lang: 'vi-VN' },
  { id: 'gemini:Charon', label: 'Gemini Charon (Nam trầm tài liệu — GEMINI_API_KEY)', provider: 'gemini', lang: 'vi-VN' },
  { id: 'gemini:Aoede', label: 'Gemini Aoede (Ấm áp kể chuyện — GEMINI_API_KEY)', provider: 'gemini', lang: 'vi-VN' },
  { id: 'gemini:Fenrir', label: 'Gemini Fenrir (Mạnh mẽ, năng lượng cao — GEMINI_API_KEY)', provider: 'gemini', lang: 'vi-VN' },
  { id: 'vieneu:south-female', label: 'VieNeu Nữ Miền Nam (Offline 100% / Voice Clone)', provider: 'vieneu', lang: 'vi-VN' },
  { id: 'vieneu:north-male', label: 'VieNeu Nam Miền Bắc (Offline 100% / Voice Clone)', provider: 'vieneu', lang: 'vi-VN' },
  { id: 'vieneu:clone:narrator', label: 'VieNeu Clone: narrator (voices/narrator.wav)', provider: 'vieneu', lang: 'vi-VN' },
  { id: 'en-US-AndrewNeural', label: 'Andrew (Male — English US, Edge-TTS Free)', provider: 'edge-tts', lang: 'en-US' },
  { id: 'en-US-AriaNeural', label: 'Aria (Female — English US, Edge-TTS Free)', provider: 'edge-tts', lang: 'en-US' },
  { id: 'en-US-GuyNeural', label: 'Guy (Male — English US, Edge-TTS Free)', provider: 'edge-tts', lang: 'en-US' },
  { id: 'openai:alloy', label: 'OpenAI Alloy (requires OPENAI_API_KEY in .env)', provider: 'openai', lang: 'multi' },
  { id: 'elevenlabs:default', label: 'ElevenLabs Multilingual v2 (requires ELEVENLABS_API_KEY in .env)', provider: 'elevenlabs', lang: 'multi' },
];

function loadEnvKeys() {
  const envPath = path.join(APP_ROOT, '.env');
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const raw of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function checkGpuToolchain(config, pythonBin, ffmpegBin) {
  let nvencAvailable = false;
  try {
    const encRes = spawnSync(ffmpegBin, ['-hide_banner', '-encoders'], { encoding: 'utf-8' });
    nvencAvailable = (encRes.stdout || '').includes('h264_nvenc');
  } catch {
    nvencAvailable = false;
  }

  let cudaWhisperDevices = 0;
  try {
    const pyRes = spawnSync(
      pythonBin,
      ['-c', 'import ctranslate2; print(ctranslate2.get_cuda_device_count())'],
      { encoding: 'utf-8' }
    );
    if (pyRes.status === 0) {
      cudaWhisperDevices = parseInt((pyRes.stdout || '').trim(), 10) || 0;
    }
  } catch {
    cudaWhisperDevices = 0;
  }

  return {
    nvencAvailable,
    cudaWhisperDevices,
    renderGl: config.renderGl || 'angle',
    hardwareAcceleration: config.hardwareAcceleration || 'if-possible',
    renderConcurrency: Number(config.renderConcurrency || 3),
  };
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''));
}

function resolveSafeProjectDir(projectSlug) {
  const clean = String(projectSlug || '').trim();
  if (!clean || clean === '.' || clean === '..' || /[/\\]/.test(clean) || clean.includes('..')) {
    throw new Error(`Invalid project slug: "${projectSlug}"`);
  }
  const projectsRoot = path.resolve(APP_ROOT, 'projects');
  const projectDir = path.resolve(projectsRoot, clean);
  if (!isWithinDir(projectsRoot, projectDir) || projectDir === projectsRoot) {
    throw new Error(`Invalid project path: "${projectSlug}"`);
  }
  return projectDir;
}

function loadConfig() {
  const cfgPath = path.join(APP_ROOT, 'app.config.json');
  if (fs.existsSync(cfgPath)) {
    return readJsonFile(cfgPath);
  }
  return {
    fps: 60,
    defaultAspect: '16:9',
    defaultPreset: 'saas-motion',
    defaultVoice: 'vi-VN-HoaiMyNeural',
    speechRate: '+0%',
    defaultBgmTrack: 'bgm_ambient_tech',
    defaultBgmVolume: 0.16,
    pythonPath: 'python',
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    renderGl: 'angle',
    hardwareAcceleration: 'if-possible',
    renderConcurrency: 3,
    wordAligner: 'faster-whisper',
    whisperModel: 'small',
    whisperDevice: 'auto',
    geminiTtsModel: 'gemini-3.8-flash-tts',
  };
}

function getPortableRequire() {
  const candidates = [
    path.join(APP_ROOT, 'package.json'),
    path.join(APP_ROOT, 'resources', 'app', 'package.json'),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      const nm = path.join(path.dirname(cand), 'node_modules');
      if (fs.existsSync(nm)) {
        return { req: createRequire(cand), nodeModulesDir: nm };
      }
    }
  }
  return {
    req: createRequire(import.meta.url),
    nodeModulesDir: path.join(APP_ROOT, 'node_modules'),
  };
}

function parseArgs(argv) {
  const cmd = argv[0] || 'info';
  const flags = {};
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    }
  }
  return { cmd, flags };
}

function sanitizeSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isWithinDir(baseDir, targetPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  const rel = path.relative(resolvedBase, resolvedTarget);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function runPythonJson(pythonBin, scriptPath, scriptArgs) {
  const res = spawnSync(pythonBin, [scriptPath, ...scriptArgs], {
    cwd: APP_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (res.error) {
    throw new Error(`Failed to execute Python (${pythonBin}): ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(
      `Python script failed (${path.basename(scriptPath)}, exit ${res.status}):\n${res.stderr || res.stdout}`
    );
  }
  const stdout = (res.stdout || '').trim();
  const lastLine = stdout.split(/\r?\n/).filter(Boolean).pop() || '{}';
  return JSON.parse(lastLine);
}

function checkBinary(bin, versionFlag = '--version') {
  const res = spawnSync(bin, [versionFlag], { encoding: 'utf-8' });
  if (res.error || res.status !== 0) {
    return { available: false, bin };
  }
  const firstLine = (res.stdout || res.stderr || '').split(/\r?\n/)[0]?.trim() || '';
  return { available: true, bin, version: firstLine };
}

function emitProgress(enabled, stage, percent, message) {
  if (!enabled) return;
  process.stderr.write(
    `${JSON.stringify({ type: 'progress', stage, percent: Math.round(percent), message })}\n`
  );
}

const MIME_TYPES = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.json': 'application/json',
};

function startProjectAssetServer(projectDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
        const rel = decodeURIComponent(reqUrl.pathname).replace(/^\/+/, '');
        const resolved = path.resolve(projectDir, rel);
        if (!isWithinDir(projectDir, resolved)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        const stat = fs.statSync(resolved);
        const ext = path.extname(resolved).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const range = req.headers.range;

        if (range) {
          if (stat.size === 0) {
            res.writeHead(416, { 'Content-Range': 'bytes */0' });
            res.end('Range Not Satisfiable');
            return;
          }
          const match = /bytes=(\d*)-(\d*)/.exec(range);
          if (!match) {
            res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
            res.end('Range Not Satisfiable');
            return;
          }
          const start = match[1] ? parseInt(match[1], 10) : 0;
          const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
          const clampedEnd = Math.min(end, stat.size - 1);
          if (Number.isNaN(start) || Number.isNaN(clampedEnd) || start < 0 || start >= stat.size || clampedEnd < start) {
            res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
            res.end('Range Not Satisfiable');
            return;
          }
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${clampedEnd}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': clampedEnd - start + 1,
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
          });
          fs.createReadStream(resolved, { start, end: clampedEnd }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
          });
          fs.createReadStream(resolved).pipe(res);
        }
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${addr.port}`,
      });
    });
  });
}

function computeEngineFingerprint() {
  const targets = [
    path.join(APP_ROOT, 'engine', 'motion'),
    path.join(APP_ROOT, 'engine', 'presets'),
    path.join(APP_ROOT, 'engine', 'runtime'),
    path.join(APP_ROOT, 'package.json'),
  ];
  let latest = 0;
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    const st = fs.statSync(target);
    if (st.isFile()) {
      if (st.mtimeMs > latest) latest = st.mtimeMs;
      continue;
    }
    for (const f of fs.readdirSync(target)) {
      const fst = fs.statSync(path.join(target, f));
      if (fst.mtimeMs > latest) latest = fst.mtimeMs;
    }
  }
  return String(Math.floor(latest));
}

async function getRemotionServeUrl(portableReq, nodeModulesDir, progressEnabled) {
  const { bundle } = portableReq('@remotion/bundler');
  const cacheRoot = path.join(os.tmpdir(), 'agy-video-studio-remotion-bundle');
  const stampFile = path.join(cacheRoot, '.engine-stamp');
  const currentStamp = `${APP_ROOT}|${computeEngineFingerprint()}`;

  if (
    fs.existsSync(path.join(cacheRoot, 'index.html')) &&
    fs.existsSync(stampFile) &&
    fs.readFileSync(stampFile, 'utf-8') === currentStamp
  ) {
    return cacheRoot;
  }

  emitProgress(progressEnabled, 'bundle', 5, 'Đang đóng gói lõi Remotion 60fps...');
  fs.rmSync(cacheRoot, { recursive: true, force: true });
  fs.mkdirSync(cacheRoot, { recursive: true });

  const entryPoint = path.join(APP_ROOT, 'engine', 'runtime', 'remotionEntry.tsx');
  const serveUrl = await bundle({
    entryPoint,
    outDir: cacheRoot,
    webpackOverride: (cfg) => ({
      ...cfg,
      resolve: {
        ...cfg.resolve,
        modules: [
          nodeModulesDir,
          ...(cfg.resolve?.modules || ['node_modules']),
        ],
        alias: {
          ...(cfg.resolve?.alias || {}),
          '@agy/motion': path.join(APP_ROOT, 'engine', 'motion', 'index.ts'),
          '@agy/presets': path.join(APP_ROOT, 'engine', 'presets', 'index.ts'),
          '@agy/runtime': path.join(APP_ROOT, 'engine', 'runtime', 'index.ts'),
        },
      },
    }),
  });

  fs.writeFileSync(stampFile, currentStamp, 'utf-8');
  return serveUrl;
}

function resolveBrowserOptions(config, flags = {}) {
  const opts = {};
  if (config.chromePath && fs.existsSync(config.chromePath)) {
    opts.browserExecutable = config.chromePath;
    opts.chromeMode = 'chrome-for-testing';
  }
  const gl = flags.gl || config.renderGl || 'angle';
  if (gl && gl !== 'default') {
    opts.chromiumOptions = { gl };
  }
  return opts;
}

function loadProjectBundleData(projectSlug) {
  const projectDir = resolveSafeProjectDir(projectSlug);
  const storyboardPath = path.join(projectDir, 'storyboard.json');
  const timingsPath = path.join(projectDir, 'timings.json');
  const projectJsonPath = path.join(projectDir, 'project.json');

  if (!fs.existsSync(storyboardPath)) {
    throw new Error(`Project "${projectSlug}" missing storyboard.json at ${storyboardPath}`);
  }
  const storyboard = readJsonFile(storyboardPath);
  const fps = storyboard.fps || 60;
  let timings;
  if (fs.existsSync(timingsPath)) {
    timings = readJsonFile(timingsPath);
  } else {
    let cursor = 0;
    const fallbackBeats = (storyboard.beats || []).map((b) => {
      const dur = Math.max(60, Math.round((b.durationHintSec ?? 3.5) * fps));
      const bt = {
        id: b.id,
        startFrame: cursor,
        endFrame: cursor + dur,
        durationFrames: dur,
        words: [],
      };
      cursor += dur;
      return bt;
    });
    const totalFrames = Math.max(60, cursor);
    timings = {
      fps,
      totalFrames,
      totalDurationSec: Number((totalFrames / fps).toFixed(3)),
      waveformPeaks: [],
      beats: fallbackBeats,
    };
  }
  const meta = fs.existsSync(projectJsonPath)
    ? readJsonFile(projectJsonPath)
    : null;

  return { projectDir, storyboard, timings, meta, projectJsonPath };
}

async function cmdInfo() {
  const config = loadConfig();
  const pythonBin = config.pythonPath || 'python';
  const ffmpegBin = config.ffmpegPath || 'ffmpeg';
  const ffprobeBin = config.ffprobePath || 'ffprobe';

  let sfxCatalog = { sfx: [], bgm: [] };
  try {
    sfxCatalog = runPythonJson(
      pythonBin,
      path.join(APP_ROOT, 'engine', 'audio', 'sfx_generator.py'),
      ['--list']
    );
  } catch {
    // non-fatal for info
  }

  const projectsDir = path.join(APP_ROOT, 'projects');
  const projects = [];
  if (fs.existsSync(projectsDir)) {
    for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pJson = path.join(projectsDir, entry.name, 'project.json');
      if (fs.existsSync(pJson)) {
        try {
          projects.push(readJsonFile(pJson));
        } catch {
          // ignore malformed
        }
      }
    }
  }
  projects.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  const envKeys = loadEnvKeys();
  const gpuToolchain = checkGpuToolchain(config, pythonBin, ffmpegBin);

  console.log(
    JSON.stringify(
      {
        ok: true,
        appRoot: APP_ROOT,
        cliPath: __filename,
        projectsDir,
        exportsDir: path.join(APP_ROOT, 'exports'),
        defaults: {
          fps: config.fps || 60,
          aspect: config.defaultAspect || '16:9',
          preset: config.defaultPreset || 'saas-motion',
          voice: config.defaultVoice || 'vi-VN-HoaiMyNeural',
          bgmTrack: config.defaultBgmTrack || 'bgm_ambient_tech',
          bgmVolume: config.defaultBgmVolume ?? 0.16,
          renderGl: gpuToolchain.renderGl,
          hardwareAcceleration: gpuToolchain.hardwareAcceleration,
          renderConcurrency: gpuToolchain.renderConcurrency,
          wordAligner: config.wordAligner || 'faster-whisper',
        },
        presets: PRESETS_INFO,
        voices: VOICES_INFO,
        captionStyles: CAPTION_STYLES_INFO,
        transitions: TRANSITIONS_INFO,
        sfx: sfxCatalog.sfx,
        bgm: sfxCatalog.bgm,
        toolchain: {
          node: { available: true, version: process.version },
          python: checkBinary(pythonBin, '--version'),
          ffmpeg: checkBinary(ffmpegBin, '-version'),
          ffprobe: checkBinary(ffprobeBin, '-version'),
          gpu: gpuToolchain,
          providers: {
            geminiConfigured: Boolean(envKeys.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
            pexelsConfigured: Boolean(envKeys.PEXELS_API_KEY || process.env.PEXELS_API_KEY),
            pixabayConfigured: Boolean(envKeys.PIXABAY_API_KEY || process.env.PIXABAY_API_KEY),
          },
        },
        projects,
      },
      null,
      2
    )
  );
}

async function cmdInit(flags) {
  const config = loadConfig();
  const rawId = flags.id || flags.project;
  if (!rawId) {
    throw new Error('Missing required flag --id <slug>');
  }
  const slug = sanitizeSlug(rawId);
  if (!slug) {
    throw new Error(`Invalid project slug: "${rawId}"`);
  }

  const aspect = flags.aspect === '9:16' ? '9:16' : '16:9';
  const preset = VALID_PRESET_IDS.includes(flags.preset)
    ? flags.preset
    : aspect === '9:16'
      ? 'shorts-kinetic'
      : config.defaultPreset || 'saas-motion';
  const voice = flags.voice || config.defaultVoice || 'vi-VN-HoaiMyNeural';
  const title = flags.title || slug.replace(/[-_]+/g, ' ');
  const now = new Date().toISOString();

  const projectDir = path.join(APP_ROOT, 'projects', slug);
  if (fs.existsSync(projectDir) && !flags.force) {
    throw new Error(`Project "${slug}" already exists at ${projectDir}. Pass --force to overwrite.`);
  }

  for (const sub of ['scenes', 'assets', 'audio', 'audio/beats', 'qa']) {
    fs.mkdirSync(path.join(projectDir, sub), { recursive: true });
  }

  const starterStoryboard = {
    version: '1.0',
    title,
    aspect,
    fps: config.fps || 60,
    voice,
    speechRate: config.speechRate || '+0%',
    theme: {
      accentColor: '#38bdf8',
      secondaryColor: '#8b5cf6',
      bgColor: '#080b12',
      surfaceColor: '#111624',
      textColor: '#f8fafc',
    },
    bgm: {
      track: config.defaultBgmTrack || 'bgm_ambient_tech',
      volume: config.defaultBgmVolume ?? 0.16,
    },
    showCaptions: true,
    beats: [
      {
        id: 'beat-1',
        badge: 'HOOK',
        title,
        subtitle: 'Mở đầu ấn tượng trong 3 giây đầu tiên',
        narration: `Chào mừng bạn đến với ${title}. Hãy cùng khám phá giải pháp tạo video mượt mà 60 khung hình mỗi giây.`,
        keywords: ['60', 'khung', 'giải pháp'],
        preset,
        accentColor: '#38bdf8',
        cameraMove: 'impact_shake',
        sfx: [{ id: 'sub_impact', offsetMs: 0, volume: 0.65 }],
        durationHintSec: 4,
      },
      {
        id: 'beat-2',
        badge: 'CORE VALUE',
        title: 'Nhanh hơn, sắc nét hơn',
        subtitle: 'Kết hợp sức mạnh AI viết code hoạt ảnh và bàn dựng trực quan',
        narration: 'Mọi chuyển cảnh đều đồng bộ chính xác theo sóng âm giọng đọc và đạt chuẩn âm lượng phòng thu.',
        keywords: ['đồng bộ', 'sóng âm', 'phòng thu'],
        metrics: [
          { label: 'Frame Rate', value: '60 FPS', delta: 'Ultra Smooth' },
          { label: 'Loudness', value: '-14 LUFS', delta: 'Studio Master' },
        ],
        steps: [
          'Lên kịch bản giữ chân người xem',
          'Đồng bộ phụ đề theo năng lượng sóng âm',
          'Xuất bản video H.264 sắc nét',
        ],
        preset,
        accentColor: '#8b5cf6',
        cameraMove: 'slow_push_in',
        sfx: [{ id: 'whoosh_fast', offsetMs: 0, volume: 0.5 }],
        durationHintSec: 4.5,
      },
      {
        id: 'beat-3',
        badge: 'CALL TO ACTION',
        title: 'Bắt đầu ngay hôm nay',
        subtitle: 'Mở AGY Video Studio để tinh chỉnh trực quan và xuất bản',
        narration: 'Sẵn sàng biến ý tưởng của bạn thành video chuyên nghiệp chỉ trong vài phút.',
        keywords: ['chuyên nghiệp', 'ý tưởng'],
        preset,
        accentColor: '#10b981',
        cameraMove: 'orbit_tilt',
        sfx: [{ id: 'success_chord', offsetMs: 120, volume: 0.5 }],
        durationHintSec: 3.5,
      },
    ],
  };

  const projectMeta = {
    id: slug,
    title,
    aspect,
    status: 'draft',
    preset,
    voice,
    speechRate: config.speechRate || '+0%',
    bgmTrack: config.defaultBgmTrack || 'bgm_ambient_tech',
    bgmVolume: config.defaultBgmVolume ?? 0.16,
    durationSec: 12,
    totalFrames: 720,
    beatCount: starterStoryboard.beats.length,
    thumbnail: '',
    exportPath: '',
    createdAt: now,
    updatedAt: now,
  };

  fs.writeFileSync(
    path.join(projectDir, 'project.json'),
    JSON.stringify(projectMeta, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(projectDir, 'storyboard.json'),
    JSON.stringify(starterStoryboard, null, 2),
    'utf-8'
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        project: slug,
        projectDir,
        projectJsonPath: path.join(projectDir, 'project.json'),
        storyboardPath: path.join(projectDir, 'storyboard.json'),
        scenesDir: path.join(projectDir, 'scenes'),
        assetsDir: path.join(projectDir, 'assets'),
        meta: projectMeta,
      },
      null,
      2
    )
  );
}

async function cmdAudio(flags) {
  const config = loadConfig();
  const slug = flags.project || flags.id;
  if (!slug) throw new Error('Missing required flag --project <slug>');
  resolveSafeProjectDir(slug);

  const progressEnabled = Boolean(flags.progress);
  emitProgress(progressEnabled, 'audio', 10, 'Đang chạy Hybrid TTS, phân tích RMS 10ms & Master -14 LUFS...');

  const result = runPythonJson(
    config.pythonPath || 'python',
    path.join(APP_ROOT, 'engine', 'audio', 'audio_pipeline.py'),
    ['--app-root', APP_ROOT, '--project', slug]
  );

  emitProgress(progressEnabled, 'audio', 100, 'Hoàn tất đồng bộ âm thanh -14 LUFS.');
  console.log(JSON.stringify(result, null, 2));
}

async function cmdQa(flags) {
  const config = loadConfig();
  const slug = flags.project || flags.id;
  if (!slug) throw new Error('Missing required flag --project <slug>');
  const progressEnabled = Boolean(flags.progress);

  const { projectDir, storyboard, timings } = loadProjectBundleData(slug);
  const qaDir = path.join(projectDir, 'qa');
  fs.mkdirSync(qaDir, { recursive: true });

  // Clean old frame PNGs before fresh capture
  for (const oldFile of fs.readdirSync(qaDir)) {
    if (oldFile.endsWith('.png')) {
      fs.rmSync(path.join(qaDir, oldFile), { force: true });
    }
  }

  emitProgress(progressEnabled, 'compile', 10, 'Đang biên dịch các cảnh CustomScene...');
  const compiledScenes = await compileProjectCustomScenes(projectDir, { appRoot: APP_ROOT });

  const { req: portableReq, nodeModulesDir } = getPortableRequire();
  const { selectComposition, renderStill } = portableReq('@remotion/renderer');
  const { server, baseUrl } = await startProjectAssetServer(projectDir);

  try {
    const serveUrl = await getRemotionServeUrl(portableReq, nodeModulesDir, progressEnabled);
    const inputProps = {
      projectId: slug,
      storyboard,
      timings,
      assetBaseUrl: baseUrl,
      compiledScenes,
      showSafeZones: Boolean(flags['safe-zones']),
      enableAudio: false,
    };
    const browserOpts = resolveBrowserOptions(config, flags);
    const composition = await selectComposition({
      serveUrl,
      id: 'AgyVideoStudio',
      inputProps,
      ...browserOpts,
    });

    const targets = [];
    const beats = timings.beats || [];
    for (let i = 0; i < beats.length; i++) {
      const bt = beats[i];
      const dur = Math.max(1, bt.durationFrames);
      const settleFrame = Math.min(
        composition.durationInFrames - 1,
        bt.startFrame + Math.floor(dur * 0.42)
      );
      const lateFrame = Math.min(
        composition.durationInFrames - 1,
        bt.startFrame + Math.floor(dur * 0.78)
      );
      const prefix = `${String(i + 1).padStart(2, '0')}_${bt.id}`;
      targets.push({ frame: settleFrame, output: path.join(qaDir, `${prefix}_01_settle.png`) });
      if (lateFrame !== settleFrame) {
        targets.push({ frame: lateFrame, output: path.join(qaDir, `${prefix}_02_caption.png`) });
      }
    }

    for (let idx = 0; idx < targets.length; idx++) {
      const t = targets[idx];
      emitProgress(
        progressEnabled,
        'qa',
        20 + ((idx + 1) / Math.max(1, targets.length)) * 70,
        `Đang chụp keyframe ${idx + 1}/${targets.length}...`
      );
      await renderStill({
        composition,
        serveUrl,
        output: t.output,
        frame: t.frame,
        inputProps,
        imageFormat: 'png',
        ...browserOpts,
      });
    }

    const qaReport = runPythonJson(
      config.pythonPath || 'python',
      path.join(APP_ROOT, 'engine', 'qa', 'qa_pipeline.py'),
      [
        '--app-root',
        APP_ROOT,
        '--project',
        slug,
        '--expected-width',
        String(composition.width),
        '--expected-height',
        String(composition.height),
      ]
    );

    emitProgress(progressEnabled, 'qa', 100, 'Hoàn tất chụp & kiểm tra Visual QA.');
    console.log(JSON.stringify(qaReport, null, 2));
  } finally {
    server.close();
  }
}

async function cmdExport(flags) {
  const config = loadConfig();
  const slug = flags.project || flags.id;
  if (!slug) throw new Error('Missing required flag --project <slug>');
  const progressEnabled = Boolean(flags.progress);

  const { projectDir, storyboard, timings, meta, projectJsonPath } = loadProjectBundleData(slug);
  const exportsDir = path.join(APP_ROOT, 'exports');
  fs.mkdirSync(exportsDir, { recursive: true });

  const aspectTag = storyboard.aspect === '9:16' ? '9x16' : '16x9';
  const outputFilename = `${slug}_${aspectTag}.mp4`;
  const outputPath = path.join(exportsDir, outputFilename);

  emitProgress(progressEnabled, 'compile', 4, 'Đang biên dịch CustomScene...');
  const compiledScenes = await compileProjectCustomScenes(projectDir, { appRoot: APP_ROOT });

  const { req: portableReq, nodeModulesDir } = getPortableRequire();
  const { selectComposition, renderMedia } = portableReq('@remotion/renderer');
  const { server, baseUrl } = await startProjectAssetServer(projectDir);

  try {
    const serveUrl = await getRemotionServeUrl(portableReq, nodeModulesDir, progressEnabled);
    const inputProps = {
      projectId: slug,
      storyboard,
      timings,
      assetBaseUrl: baseUrl,
      compiledScenes,
      showSafeZones: false,
      enableAudio: true,
    };
    const browserOpts = resolveBrowserOptions(config, flags);
    const composition = await selectComposition({
      serveUrl,
      id: 'AgyVideoStudio',
      inputProps,
      ...browserOpts,
    });

    const cpuCount = os.cpus()?.length || 4;
    const glMode = flags.gl || config.renderGl || 'angle';
    const configuredConc = Number(flags.concurrency || config.renderConcurrency || (glMode === 'angle' ? 3 : 4));
    const concurrency = Math.max(1, Math.min(Math.max(2, cpuCount), configuredConc));
    const hardwareAcceleration = flags.hw || config.hardwareAcceleration || 'if-possible';

    emitProgress(
      progressEnabled,
      'render',
      12,
      `Bắt đầu render 60fps (${composition.durationInFrames} frames · gl=${glMode} · hw=${hardwareAcceleration} · c=${concurrency})...`
    );
    let lastLogged = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      pixelFormat: 'yuv420p',
      audioCodec: 'aac',
      audioBitrate: '192k',
      outputLocation: outputPath,
      inputProps,
      concurrency,
      hardwareAcceleration,
      ...browserOpts,
      onProgress: ({ progress, renderedFrames, encodedFrames }) => {
        const pct = Math.min(99, Math.round(12 + progress * 86));
        if (pct !== lastLogged) {
          lastLogged = pct;
          emitProgress(
            progressEnabled,
            'render',
            pct,
            `Đang render 60fps — ${renderedFrames}/${composition.durationInFrames} frames (encoded ${encodedFrames})`
          );
        }
      },
    });

    const updatedMeta = {
      ...(meta || { id: slug, title: storyboard.title, aspect: storyboard.aspect }),
      status: 'rendered',
      exportPath: `exports/${outputFilename}`,
      durationSec: timings.totalDurationSec,
      totalFrames: composition.durationInFrames,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(projectJsonPath, JSON.stringify(updatedMeta, null, 2), 'utf-8');

    emitProgress(progressEnabled, 'done', 100, `Đã xuất xong ${outputFilename}`);
    console.log(
      JSON.stringify(
        {
          ok: true,
          project: slug,
          outputPath,
          relativeExportPath: `exports/${outputFilename}`,
          width: composition.width,
          height: composition.height,
          fps: composition.fps,
          durationInFrames: composition.durationInFrames,
          durationSec: Number((composition.durationInFrames / composition.fps).toFixed(3)),
          sizeBytes: fs.statSync(outputPath).size,
        },
        null,
        2
      )
    );
  } finally {
    server.close();
  }
}

async function cmdMedia(flags) {
  const config = loadConfig();
  const slug = flags.project || flags.id;
  if (!slug) throw new Error('Missing required flag --project <slug>');
  resolveSafeProjectDir(slug);
  if (!flags.query) throw new Error('Missing required flag --query "<search terms>"');

  const args = [
    '--app-root',
    APP_ROOT,
    '--project',
    slug,
    '--query',
    String(flags.query),
    '--type',
    flags.type === 'video' ? 'video' : 'image',
    '--source',
    flags.source || 'auto',
    '--orientation',
    flags.orientation === 'portrait' ? 'portrait' : 'landscape',
  ];
  if (flags.out) {
    args.push('--out', String(flags.out));
  }
  const result = runPythonJson(
    config.pythonPath || 'python',
    path.join(APP_ROOT, 'engine', 'media', 'stock_fetcher.py'),
    args
  );
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  try {
    switch (cmd) {
      case 'info':
        await cmdInfo();
        break;
      case 'init':
        await cmdInit(flags);
        break;
      case 'audio':
        await cmdAudio(flags);
        break;
      case 'qa':
        await cmdQa(flags);
        break;
      case 'export':
        await cmdExport(flags);
        break;
      case 'media':
        await cmdMedia(flags);
        break;
      default:
        throw new Error(`Unknown command "${cmd}". Valid commands: info, init, audio, qa, export, media.`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ ok: false, command: cmd, error: message }));
    process.exit(1);
  }
}

main();
