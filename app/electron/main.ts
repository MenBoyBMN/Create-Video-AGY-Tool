import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { spawn, type ChildProcess } from 'node:child_process';
import { app, BrowserWindow, clipboard, dialog, ipcMain, protocol, shell } from 'electron';

// Register agy-media:// before app ready so <audio>/<video>/<img> work with full HTTP Range streaming
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'agy-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

interface AppConfig {
  appName: string;
  version: string;
  fps: number;
  defaultAspect: '16:9' | '9:16';
  defaultPreset: string;
  defaultVoice: string;
  speechRate: string;
  defaultBgmTrack: string;
  defaultBgmVolume: number;
  theme: string;
  pythonPath: string;
  ffmpegPath: string;
  ffprobePath: string;
  chromePath: string;
  skillSubdir: string;
  renderGl?: string;
  hardwareAcceleration?: string;
  renderConcurrency?: number;
  wordAligner?: string;
  whisperModel?: string;
  whisperDevice?: string;
  geminiTtsModel?: string;
}

const MIME_MAP: Record<string, string> = {
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

let mainWindow: BrowserWindow | null = null;
let activeWatcher: fs.FSWatcher | null = null;
let watchedProjectId: string | null = null;
let watchDebounceTimer: NodeJS.Timeout | null = null;
const activeJobs = new Map<string, ChildProcess>();

function resolveAppRoot(): string {
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'));
  }
  return process.cwd();
}

const APP_ROOT = resolveAppRoot();

function getConfigPath(): string {
  return path.join(APP_ROOT, 'app.config.json');
}

function readJsonFile<T = Record<string, unknown>>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')) as T;
}

function loadAppConfig(): AppConfig {
  const defaults: AppConfig = {
    appName: 'AGY Video Studio',
    version: '2.0.0',
    fps: 60,
    defaultAspect: '16:9',
    defaultPreset: 'saas-motion',
    defaultVoice: 'vi-VN-HoaiMyNeural',
    speechRate: '+0%',
    defaultBgmTrack: 'bgm_ambient_tech',
    defaultBgmVolume: 0.16,
    theme: 'dark',
    pythonPath: 'python',
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    chromePath: '',
    skillSubdir: '.agents/skills/agy-video-studio',
    renderGl: 'angle',
    hardwareAcceleration: 'if-possible',
    renderConcurrency: 3,
    wordAligner: 'faster-whisper',
    whisperModel: 'small',
    whisperDevice: 'auto',
    geminiTtsModel: 'gemini-3.8-flash-tts',
  };
  const cfgPath = getConfigPath();
  if (!fs.existsSync(cfgPath)) return defaults;
  try {
    return { ...defaults, ...readJsonFile<Partial<AppConfig>>(cfgPath) };
  } catch {
    return defaults;
  }
}

function readEnvFile(): Record<string, string> {
  const envPath = path.join(APP_ROOT, '.env');
  const out: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return out;
  for (const raw of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    out[k] = v;
  }
  return out;
}

function writeEnvFile(entries: Record<string, string>): void {
  const envPath = path.join(APP_ROOT, '.env');
  const lines = [
    '# AGY Video Studio local API keys (never sent outside chosen TTS provider)',
    ...Object.entries(entries).map(([k, v]) => `${k}=${v ?? ''}`),
    '',
  ];
  fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
}

/**
 * Auto-Path Registration: writes app-path.json inside ~/.agents/skills/agy-video-studio/
 * every time the desktop app opens so moving the portable folder never breaks /agy-video-studio.
 */
function registerSkillAppPath(): {
  synced: boolean;
  appPathJson: string;
  skillInstalled: boolean;
  appRoot: string;
  updatedAt: string;
  error?: string;
} {
  const cfg = loadAppConfig();
  const skillDir = path.join(os.homedir(), cfg.skillSubdir || '.agents/skills/agy-video-studio');
  const appPathJson = path.join(skillDir, 'app-path.json');
  const updatedAt = new Date().toISOString();

  const payload = {
    appRoot: APP_ROOT,
    cli: path.join(APP_ROOT, 'cli', 'agy-studio.mjs'),
    projectsDir: path.join(APP_ROOT, 'projects'),
    exportsDir: path.join(APP_ROOT, 'exports'),
    exePath: app.isPackaged ? app.getPath('exe') : path.join(APP_ROOT, 'AGY-Video-Studio.exe'),
    updatedAt,
  };

  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(appPathJson, JSON.stringify(payload, null, 2), 'utf-8');
    return {
      synced: true,
      appPathJson,
      skillInstalled: fs.existsSync(path.join(skillDir, 'SKILL.md')),
      appRoot: APP_ROOT,
      updatedAt,
    };
  } catch (err) {
    return {
      synced: false,
      appPathJson,
      skillInstalled: fs.existsSync(path.join(skillDir, 'SKILL.md')),
      appRoot: APP_ROOT,
      updatedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function compileScenesForProject(projectDir: string): Promise<Record<string, unknown>> {
  const compilerPath = path.join(APP_ROOT, 'engine', 'runtime', 'compileCustomScene.mjs');
  const mod = await import(`file:///${compilerPath.replace(/\\/g, '/')}`);
  return mod.compileProjectCustomScenes(projectDir, { appRoot: APP_ROOT });
}

function getProjectsDir(): string {
  const dir = path.join(APP_ROOT, 'projects');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getExportsDir(): string {
  const dir = path.join(APP_ROOT, 'exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isWithinDir(baseDir: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  const rel = path.relative(resolvedBase, resolvedTarget);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function assertSafeProjectId(projectId: string): string {
  if (
    typeof projectId !== 'string' ||
    !/^[a-zA-Z0-9._-]+$/.test(projectId) ||
    projectId === '.' ||
    projectId === '..'
  ) {
    throw new Error(`Invalid project ID: "${String(projectId)}"`);
  }
  return projectId;
}

function resolveProjectDir(projectId: string): string {
  const safeId = assertSafeProjectId(projectId);
  const projectsRoot = getProjectsDir();
  const resolved = path.resolve(projectsRoot, safeId);
  if (!isWithinDir(projectsRoot, resolved) || resolved === path.resolve(projectsRoot)) {
    throw new Error(`Invalid project path for "${safeId}"`);
  }
  return resolved;
}

function killProcessTree(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid) {
    try {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.on('error', () => {
        // ignore if already exited
      });
    } catch {
      // fallback below
    }
  }
  try {
    child.kill();
  } catch {
    // ignore if already dead
  }
}

function runCliJsonAsync(cliArgs: string[], timeoutMs = 15000): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const cliPath = path.join(APP_ROOT, 'cli', 'agy-studio.mjs');
    const child = spawn(process.execPath, [cliPath, ...cliArgs], {
      cwd: APP_ROOT,
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        killProcessTree(child);
        resolve(null);
      }
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });
    child.on('error', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        resolve(null);
      }
    });
  });
}

function listAllProjects() {
  const dir = getProjectsDir();
  const items: Array<Record<string, unknown>> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const projectDir = path.join(dir, entry.name);
    const metaPath = path.join(projectDir, 'project.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = readJsonFile<Record<string, any>>(metaPath);
      const thumbRel = meta.thumbnail || (fs.existsSync(path.join(projectDir, 'qa', 'thumbnail.png')) ? 'qa/thumbnail.png' : '');
      const exportAbs = meta.exportPath ? path.join(APP_ROOT, meta.exportPath) : '';
      const exportExists = Boolean(exportAbs && fs.existsSync(exportAbs));
      items.push({
        ...meta,
        id: meta.id || entry.name,
        thumbnail: thumbRel,
        thumbnailUrl: thumbRel
          ? `agy-media://project/${encodeURIComponent(entry.name)}/${thumbRel}?t=${Date.now()}`
          : '',
        exportExists,
        exportUrl: exportExists
          ? `agy-media://export/${encodeURIComponent(path.basename(exportAbs))}?t=${Date.now()}`
          : '',
        projectDir,
      });
    } catch {
      // skip malformed project
    }
  }
  items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return items;
}

async function loadProjectDetail(projectId: string) {
  const projectDir = resolveProjectDir(projectId);
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project "${projectId}" not found.`);
  }
  const metaPath = path.join(projectDir, 'project.json');
  const storyboardPath = path.join(projectDir, 'storyboard.json');
  const timingsPath = path.join(projectDir, 'timings.json');

  const meta = fs.existsSync(metaPath) ? readJsonFile<Record<string, any>>(metaPath) : { id: projectId };
  const storyboard = fs.existsSync(storyboardPath)
    ? readJsonFile<Record<string, any>>(storyboardPath)
    : null;
  const timings = fs.existsSync(timingsPath)
    ? readJsonFile<Record<string, any>>(timingsPath)
    : null;

  const compiledScenes = await compileScenesForProject(projectDir);

  const assetsDir = path.join(projectDir, 'assets');
  const assets = fs.existsSync(assetsDir)
    ? fs
        .readdirSync(assetsDir)
        .filter((f) => !f.startsWith('.'))
        .map((f) => ({
          name: f,
          relPath: `assets/${f}`,
          url: `agy-media://project/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(f)}`,
        }))
    : [];

  const scenesDir = path.join(projectDir, 'scenes');
  const customSceneFiles = fs.existsSync(scenesDir)
    ? fs.readdirSync(scenesDir).filter((f) => f.endsWith('.tsx') || f.endsWith('.jsx'))
    : [];

  const exportAbs = meta.exportPath ? path.join(APP_ROOT, meta.exportPath) : '';
  const exportExists = Boolean(exportAbs && fs.existsSync(exportAbs));

  return {
    id: projectId,
    projectDir,
    assetBaseUrl: `agy-media://project/${encodeURIComponent(projectId)}`,
    meta: {
      ...meta,
      exportExists,
      exportUrl: exportExists
        ? `agy-media://export/${encodeURIComponent(path.basename(exportAbs))}?t=${Date.now()}`
        : '',
    },
    storyboard,
    timings,
    compiledScenes,
    assets,
    customSceneFiles,
    revision: Date.now(),
  };
}

function stopProjectWatch() {
  if (watchDebounceTimer) {
    clearTimeout(watchDebounceTimer);
    watchDebounceTimer = null;
  }
  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
  }
  watchedProjectId = null;
}

function startProjectWatch(projectId: string) {
  stopProjectWatch();
  let projectDir: string;
  try {
    projectDir = resolveProjectDir(projectId);
  } catch {
    return;
  }
  if (!fs.existsSync(projectDir)) return;
  watchedProjectId = projectId;

  try {
    activeWatcher = fs.watch(projectDir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;
      // Ignore temporary intermediate files
      if (filename.includes('_premaster') || filename.includes('_voiceover_bus') || filename.endsWith('_tts.mp3')) {
        return;
      }
      if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
      watchDebounceTimer = setTimeout(async () => {
        if (!mainWindow || mainWindow.isDestroyed() || watchedProjectId !== projectId) return;
        try {
          const detail = await loadProjectDetail(projectId);
          mainWindow.webContents.send('project:changed', {
            projectId,
            changedFile: filename,
            detail,
          });
        } catch {
          // ignore transient mid-write read errors
        }
      }, 180);
    });
  } catch {
    // non-fatal if fs.watch fails
  }
}

function runCliJob(jobId: string, cliArgs: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const cliPath = path.join(APP_ROOT, 'cli', 'agy-studio.mjs');
    const child = spawn(process.execPath, [cliPath, ...cliArgs], {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    });
    activeJobs.set(jobId, child);

    let stdoutBuf = '';
    let stderrBuf = '';

    child.stdout?.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf-8');
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString('utf-8');
      stderrBuf += text;
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === 'progress' && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('job:progress', {
              jobId,
              stage: parsed.stage,
              percent: parsed.percent,
              message: parsed.message,
            });
          }
        } catch {
          // ignore non-JSON stderr lines
        }
      }
    });

    child.on('error', (err) => {
      activeJobs.delete(jobId);
      reject(err);
    });

    child.on('close', (code) => {
      activeJobs.delete(jobId);
      if (code !== 0) {
        reject(new Error(stderrBuf.trim() || stdoutBuf.trim() || `CLI exited with code ${code}`));
        return;
      }
      try {
        const trimmed = stdoutBuf.trim();
        const jsonStart = trimmed.indexOf('{');
        const payload = jsonStart >= 0 ? JSON.parse(trimmed.slice(jsonStart)) : { ok: true };
        resolve(payload);
      } catch {
        resolve({ ok: true, raw: stdoutBuf });
      }
    });
  });
}

function registerMediaProtocol() {
  protocol.handle('agy-media', async (request) => {
    try {
      const url = new URL(request.url);
      const host = url.hostname; // 'project' or 'export'
      const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');

      let baseDir: string;
      let targetPath: string;
      if (host === 'project') {
        baseDir = path.resolve(getProjectsDir());
        targetPath = path.resolve(baseDir, pathname);
      } else if (host === 'export') {
        baseDir = path.resolve(getExportsDir());
        targetPath = path.resolve(baseDir, pathname);
      } else {
        return new Response('Forbidden host', { status: 403 });
      }

      if (!isWithinDir(baseDir, targetPath) || !fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
        return new Response('Not Found', { status: 404 });
      }

      const stat = fs.statSync(targetPath);
      const ext = path.extname(targetPath).toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        if (stat.size === 0) {
          return new Response('Range Not Satisfiable', {
            status: 416,
            headers: { 'Content-Range': 'bytes */0' },
          });
        }
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        if (!match) {
          return new Response('Range Not Satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${stat.size}` },
          });
        }
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const rawEnd = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        const end = Math.min(rawEnd, stat.size - 1);
        if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start >= stat.size || end < start) {
          return new Response('Range Not Satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${stat.size}` },
          });
        }
        const chunkSize = end - start + 1;
        const nodeStream = fs.createReadStream(targetPath, { start, end });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;
        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
          },
        });
      }

      const nodeStream = fs.createReadStream(targetPath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;
      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': String(stat.size),
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  });
}

function registerIpcHandlers() {
  ipcMain.handle('app:getInfo', async () => {
    const [info, skillSync] = await Promise.all([
      runCliJsonAsync(['info'], 15000),
      Promise.resolve(registerSkillAppPath()),
    ]);
    if (info) {
      return { ...info, skillSync };
    }
    return { ok: true, appRoot: APP_ROOT, skillSync, presets: [], voices: [], sfx: [], bgm: [] };
  });

  ipcMain.handle('skill:sync', () => registerSkillAppPath());

  ipcMain.handle('projects:list', () => listAllProjects());

  ipcMain.handle('projects:get', async (_e, projectId: string) => loadProjectDetail(projectId));

  ipcMain.handle('projects:watch', (_e, projectId: string) => {
    startProjectWatch(projectId);
    return { ok: true };
  });

  ipcMain.handle('projects:unwatch', () => {
    stopProjectWatch();
    return { ok: true };
  });

  ipcMain.handle(
    'projects:create',
    async (_e, opts: { id: string; title: string; aspect: '16:9' | '9:16'; preset: string; voice: string }) => {
      const args = [
        'init',
        '--id',
        opts.id,
        '--title',
        opts.title,
        '--aspect',
        opts.aspect,
        '--preset',
        opts.preset,
        '--voice',
        opts.voice,
      ];
      return runCliJob(`init-${Date.now()}`, args);
    }
  );

  ipcMain.handle('projects:duplicate', (_e, projectId: string) => {
    const srcDir = resolveProjectDir(projectId);
    if (!fs.existsSync(srcDir)) throw new Error(`Project "${projectId}" not found.`);
    const newId = `${assertSafeProjectId(projectId)}-copy-${Date.now().toString().slice(-4)}`;
    const destDir = resolveProjectDir(newId);
    fs.cpSync(srcDir, destDir, { recursive: true });
    const metaPath = path.join(destDir, 'project.json');
    if (fs.existsSync(metaPath)) {
      const meta = readJsonFile<Record<string, any>>(metaPath);
      meta.id = newId;
      meta.title = `${meta.title || projectId} (Copy)`;
      meta.status = 'draft';
      meta.exportPath = '';
      meta.createdAt = new Date().toISOString();
      meta.updatedAt = meta.createdAt;
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    }
    return { ok: true, id: newId };
  });

  ipcMain.handle('projects:delete', (_e, projectId: string) => {
    const targetDir = resolveProjectDir(projectId);
    if (watchedProjectId === projectId) stopProjectWatch();
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    return { ok: true };
  });

  ipcMain.handle('projects:saveStoryboard', (_e, projectId: string, storyboard: Record<string, unknown>) => {
    const projectDir = resolveProjectDir(projectId);
    const sbPath = path.join(projectDir, 'storyboard.json');
    fs.writeFileSync(sbPath, JSON.stringify(storyboard, null, 2), 'utf-8');

    const metaPath = path.join(projectDir, 'project.json');
    if (fs.existsSync(metaPath)) {
      const meta = readJsonFile<Record<string, any>>(metaPath);
      meta.title = storyboard.title || meta.title;
      meta.aspect = storyboard.aspect || meta.aspect;
      meta.voice = storyboard.voice || meta.voice;
      meta.beatCount = Array.isArray(storyboard.beats) ? storyboard.beats.length : meta.beatCount;
      meta.updatedAt = new Date().toISOString();
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    }
    return { ok: true };
  });

  ipcMain.handle('projects:importAsset', async (_e, projectId: string) => {
    const projectDir = resolveProjectDir(projectId);
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Chọn ảnh, video B-roll hoặc âm thanh cho cảnh',
      properties: ['openFile'],
      filters: [
        { name: 'Media Assets', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'mp4', 'webm', 'wav', 'mp3'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    const src = result.filePaths[0];
    const safeName = path.basename(src).replace(/[^a-zA-Z0-9._-]+/g, '_');
    const assetsDir = path.join(projectDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const dest = path.join(assetsDir, safeName);
    fs.copyFileSync(src, dest);
    return {
      canceled: false,
      name: safeName,
      relPath: `assets/${safeName}`,
      url: `agy-media://project/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(safeName)}`,
    };
  });

  ipcMain.handle('jobs:audio', (_e, jobId: string, projectId: string) =>
    runCliJob(jobId, ['audio', '--project', assertSafeProjectId(projectId), '--progress'])
  );

  ipcMain.handle('jobs:qa', (_e, jobId: string, projectId: string) =>
    runCliJob(jobId, ['qa', '--project', assertSafeProjectId(projectId), '--progress'])
  );

  ipcMain.handle('jobs:export', (_e, jobId: string, projectId: string) =>
    runCliJob(jobId, ['export', '--project', assertSafeProjectId(projectId), '--progress'])
  );

  ipcMain.handle('jobs:cancel', (_e, jobId: string) => {
    const child = activeJobs.get(jobId);
    if (child) {
      killProcessTree(child);
      activeJobs.delete(jobId);
      return { ok: true };
    }
    return { ok: false };
  });

  ipcMain.handle('settings:get', () => {
    return {
      config: loadAppConfig(),
      env: readEnvFile(),
      skillSync: registerSkillAppPath(),
      appRoot: APP_ROOT,
    };
  });

  ipcMain.handle(
    'settings:save',
    (_e, payload: { config: Partial<AppConfig>; env: Record<string, string> }) => {
      const merged = { ...loadAppConfig(), ...payload.config };
      fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2), 'utf-8');
      if (payload.env) {
        writeEnvFile(payload.env);
      }
      const skillSync = registerSkillAppPath();
      return { ok: true, config: merged, skillSync };
    }
  );

  ipcMain.handle('shell:openExportsDir', async () => {
    await shell.openPath(getExportsDir());
    return { ok: true };
  });

  ipcMain.handle('shell:openProjectDir', async (_e, projectId: string) => {
    await shell.openPath(resolveProjectDir(projectId));
    return { ok: true };
  });

  ipcMain.handle('shell:openExportFile', async (_e, relPath: string) => {
    const exportsDir = getExportsDir();
    const abs = path.resolve(APP_ROOT, String(relPath || ''));
    if (!isWithinDir(exportsDir, abs) || abs === path.resolve(exportsDir)) {
      return { ok: false, error: 'Forbidden export path' };
    }
    if (fs.existsSync(abs)) {
      await shell.openPath(abs);
      return { ok: true };
    }
    return { ok: false, error: 'File not found' };
  });

  ipcMain.handle('clipboard:write', (_e, text: string) => {
    clipboard.writeText(text);
    return { ok: true };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 740,
    title: 'AGY Video Studio',
    backgroundColor: '#111113',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    stopProjectWatch();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Auto-register portable folder path for /agy-video-studio skill on every launch
  registerSkillAppPath();
  registerMediaProtocol();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopProjectWatch();
  for (const child of activeJobs.values()) {
    killProcessTree(child);
  }
  activeJobs.clear();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
