export type AspectRatio = '16:9' | '9:16';

export type PresetId =
  | 'saas-motion'
  | 'explainer-editorial'
  | 'shorts-kinetic'
  | 'cinematic-broll'
  | 'whiteboard-sketch'
  | 'tech-3d-data'
  | 'dialogue-podcast';

export type CameraMoveType =
  | 'static'
  | 'slow_push_in'
  | 'slow_pull_out'
  | 'pan_left'
  | 'pan_right'
  | 'impact_shake'
  | 'orbit_tilt';

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-up'
  | 'wipe'
  | 'whip-pan'
  | 'flash'
  | 'glitch';

export type CaptionStyleId =
  | 'glass-dark'
  | 'editorial-light'
  | 'hormozi-pop'
  | 'karaoke-glow'
  | 'minimal-cinematic'
  | 'typewriter-mono';

export type ProjectStatus = 'draft' | 'rendered';

export interface SfxCue {
  id: string;
  offsetMs: number;
  volume?: number;
}

export interface MetricItem {
  label: string;
  value: string;
  delta?: string;
}

export interface DialogueTurn {
  speaker: string;
  voice?: string;
  style?: string;
  text: string;
}

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface CodeSnippetSpec {
  language?: string;
  title?: string;
  code: string;
  highlightLines?: number[];
}

export interface BeatSpec {
  id: string;
  title: string;
  subtitle?: string;
  narration: string;
  keywords?: string[];
  metrics?: MetricItem[];
  steps?: string[];
  preset?: PresetId;
  customScene?: string;
  accentColor?: string;
  bgColor?: string;
  cameraMove?: CameraMoveType;
  transition?: TransitionType;
  voiceStyle?: string;
  dialogue?: DialogueTurn[];
  chartData?: ChartDatum[];
  codeSnippet?: CodeSnippetSpec;
  mediaType?: 'auto' | 'image' | 'video';
  asset?: string;
  sfx?: SfxCue[];
  badge?: string;
  durationHintSec?: number;
}

export interface StoryboardTheme {
  accentColor: string;
  secondaryColor?: string;
  bgColor: string;
  surfaceColor?: string;
  textColor?: string;
  fontFamily?: string;
}

export interface StoryboardBgm {
  track: string;
  volume: number;
}

export interface Storyboard {
  version?: string;
  title: string;
  aspect: AspectRatio;
  fps: number;
  voice?: string;
  speechRate?: string;
  captionStyle?: CaptionStyleId;
  defaultTransition?: TransitionType;
  theme: StoryboardTheme;
  bgm?: StoryboardBgm;
  showCaptions?: boolean;
  beats: BeatSpec[];
}

export interface WordTiming {
  word: string;
  startFrame: number;
  endFrame: number;
  isKeyword?: boolean;
  speaker?: string;
}

export interface BeatTiming {
  id: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  audioFile?: string;
  speechStartMs?: number;
  speechEndMs?: number;
  words: WordTiming[];
}

export interface TimingsData {
  fps: number;
  totalFrames: number;
  totalDurationSec: number;
  masterAudio?: string;
  waveformPeaks: number[];
  beats: BeatTiming[];
}

export interface ProjectMeta {
  id: string;
  title: string;
  aspect: AspectRatio;
  status: ProjectStatus;
  preset: PresetId;
  voice: string;
  speechRate?: string;
  bgmTrack?: string;
  bgmVolume?: number;
  durationSec: number;
  totalFrames?: number;
  beatCount?: number;
  thumbnail?: string;
  exportPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomSceneCompileError {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  lineText?: string;
}

export interface CompiledSceneEntry {
  sceneName: string;
  filePath: string;
  ok: boolean;
  code?: string;
  hash?: string;
  error?: CustomSceneCompileError;
}

export interface CustomSceneProps {
  beat: BeatSpec;
  beatTiming: BeatTiming;
  beatIndex: number;
  totalBeats: number;
  storyboard: Storyboard;
  aspect: AspectRatio;
  accentColor: string;
  bgColor: string;
  resolveAssetUrl: (relPath?: string) => string | undefined;
}

export interface CompositionInputProps {
  projectId: string;
  storyboard: Storyboard;
  timings: TimingsData;
  assetBaseUrl: string;
  compiledScenes?: Record<string, CompiledSceneEntry>;
  showSafeZones?: boolean;
  enableAudio?: boolean;
  onSceneErrorCopy?: (payload: {
    projectId: string;
    beatId: string;
    sceneName: string;
    errorMessage: string;
    stack?: string;
  }) => void;
}
