import type {
  AspectRatio,
  CompiledSceneEntry,
  PresetId,
  ProjectMeta,
  Storyboard,
  TimingsData,
} from '@agy/motion';

export interface SkillSyncStatus {
  synced: boolean;
  appPathJson: string;
  skillInstalled: boolean;
  appRoot: string;
  updatedAt: string;
  error?: string;
}

export interface StudioProjectSummary extends ProjectMeta {
  thumbnailUrl?: string;
  exportExists?: boolean;
  exportUrl?: string;
  projectDir?: string;
}

export interface ProjectAssetItem {
  name: string;
  relPath: string;
  url: string;
}

export interface StudioProjectDetail {
  id: string;
  projectDir: string;
  assetBaseUrl: string;
  meta: StudioProjectSummary;
  storyboard: Storyboard;
  timings: TimingsData | null;
  compiledScenes: Record<string, CompiledSceneEntry>;
  assets: ProjectAssetItem[];
  customSceneFiles: string[];
  revision: number;
}

export interface CatalogItem {
  id: string;
  layer?: string;
  name?: string;
  label?: string;
  provider?: string;
  lang?: string;
  description?: string;
}

export interface ToolchainEntry {
  available: boolean;
  bin?: string;
  version?: string;
}

export interface GpuToolchainInfo {
  nvencAvailable: boolean;
  cudaWhisperDevices: number;
  renderGl: string;
  hardwareAcceleration: string;
  renderConcurrency: number;
}

export interface StudioAppInfo {
  ok: boolean;
  appRoot: string;
  projectsDir?: string;
  exportsDir?: string;
  presets: CatalogItem[];
  voices: CatalogItem[];
  captionStyles?: CatalogItem[];
  transitions?: CatalogItem[];
  sfx: CatalogItem[];
  bgm: CatalogItem[];
  toolchain?: {
    node?: ToolchainEntry;
    python?: ToolchainEntry;
    ffmpeg?: ToolchainEntry;
    ffprobe?: ToolchainEntry;
    gpu?: GpuToolchainInfo;
    providers?: {
      geminiConfigured?: boolean;
      pexelsConfigured?: boolean;
      pixabayConfigured?: boolean;
    };
  };
  skillSync: SkillSyncStatus;
}

export interface JobProgressEvent {
  jobId: string;
  stage: string;
  percent: number;
  message: string;
}

export interface ProjectChangedEvent {
  projectId: string;
  changedFile: string;
  detail: StudioProjectDetail;
}

export interface AppSettingsPayload {
  config: {
    fps: number;
    defaultAspect: AspectRatio;
    defaultPreset: PresetId;
    defaultVoice: string;
    speechRate: string;
    defaultBgmTrack: string;
    defaultBgmVolume: number;
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
  };
  env: Record<string, string>;
  skillSync: SkillSyncStatus;
  appRoot: string;
}

export interface AgyStudioBridge {
  getInfo: () => Promise<StudioAppInfo>;
  syncSkillPath: () => Promise<SkillSyncStatus>;
  listProjects: () => Promise<StudioProjectSummary[]>;
  getProject: (projectId: string) => Promise<StudioProjectDetail>;
  watchProject: (projectId: string) => Promise<{ ok: boolean }>;
  unwatchProject: () => Promise<{ ok: boolean }>;
  createProject: (opts: {
    id: string;
    title: string;
    aspect: AspectRatio;
    preset: PresetId;
    voice: string;
  }) => Promise<{ ok: boolean; project: string }>;
  duplicateProject: (projectId: string) => Promise<{ ok: boolean; id: string }>;
  deleteProject: (projectId: string) => Promise<{ ok: boolean }>;
  saveStoryboard: (projectId: string, storyboard: Storyboard) => Promise<{ ok: boolean }>;
  importAsset: (projectId: string) => Promise<{
    canceled: boolean;
    name?: string;
    relPath?: string;
    url?: string;
  }>;
  runAudioJob: (jobId: string, projectId: string) => Promise<Record<string, unknown>>;
  runQaJob: (jobId: string, projectId: string) => Promise<Record<string, unknown>>;
  runExportJob: (jobId: string, projectId: string) => Promise<Record<string, unknown>>;
  cancelJob: (jobId: string) => Promise<{ ok: boolean }>;
  getSettings: () => Promise<AppSettingsPayload>;
  saveSettings: (payload: {
    config: Record<string, unknown>;
    env: Record<string, string>;
  }) => Promise<{ ok: boolean; skillSync: SkillSyncStatus }>;
  openExportsDir: () => Promise<{ ok: boolean }>;
  openProjectDir: (projectId: string) => Promise<{ ok: boolean }>;
  openExportFile: (relPath: string) => Promise<{ ok: boolean }>;
  copyText: (text: string) => Promise<{ ok: boolean }>;
  onJobProgress: (cb: (ev: JobProgressEvent) => void) => () => void;
  onProjectChanged: (cb: (ev: ProjectChangedEvent) => void) => () => void;
}

declare global {
  interface Window {
    agyStudio: AgyStudioBridge;
  }
}
