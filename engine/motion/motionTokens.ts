import { Easing, interpolate, spring } from 'remotion';
import type { AspectRatio, BeatSpec, BeatTiming, Storyboard, TimingsData } from './types';

export const FPS = 60;

export const ASPECT_DIMS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
};

export interface SafeZoneMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const SAFE_ZONES: Record<AspectRatio, SafeZoneMargins> = {
  '16:9': { top: 68, bottom: 120, left: 96, right: 96 },
  '9:16': { top: 220, bottom: 420, left: 64, right: 170 },
};

/**
 * Studio physics springs — linear easing is intentionally disallowed for UI/subject motion.
 */
export const SPRINGS = {
  SNAPPY: { damping: 18, stiffness: 260, mass: 0.75 },
  SMOOTH_UI: { damping: 24, stiffness: 150, mass: 0.95 },
  HEAVY_IMPACT: { damping: 14, stiffness: 220, mass: 1.35 },
  ELASTIC: { damping: 11, stiffness: 190, mass: 0.85 },
  CAMERA_GLIDE: { damping: 32, stiffness: 75, mass: 1.4 },
} as const;

export type SpringPresetName = keyof typeof SPRINGS;

export const EASINGS = {
  EDITORIAL: Easing.bezier(0.22, 1, 0.36, 1),
  SMOOTH_DECEL: Easing.bezier(0.16, 1, 0.3, 1),
  PUNCH_OVERSHOOT: Easing.bezier(0.34, 1.56, 0.64, 1),
  CINEMATIC_IN_OUT: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

export const DEPTH_FACTORS = {
  background: 0.28,
  midground: 0.65,
  subject: 1.0,
  foreground: 1.22,
} as const;

export type DepthLayerName = keyof typeof DEPTH_FACTORS;

export function springProgress(
  frame: number,
  fps: number = FPS,
  preset: SpringPresetName = 'SMOOTH_UI',
  delayFrames = 0
): number {
  return spring({
    frame: Math.max(0, frame - delayFrames),
    fps,
    config: SPRINGS[preset],
  });
}

export function editorialProgress(
  frame: number,
  startFrame: number,
  durationFrames: number
): number {
  if (durationFrames <= 0) return frame >= startFrame ? 1 : 0;
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASINGS.EDITORIAL,
  });
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#080b12').replace('#', '').trim();
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(normalized, 16);
  if (Number.isNaN(num)) return { r: 8, g: 11, b: 18 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function isLightColor(hex: string): boolean {
  const { r, g, b } = parseHexRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.48;
}

export interface AdaptivePalette {
  isLight: boolean;
  bgColor: string;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  surface: string;
  surfaceAlt: string;
  surfaceBorder: string;
  badgeTextOnAccent: string;
  shadow: string;
}

export function getAdaptivePalette(bgColor: string, accentColor: string): AdaptivePalette {
  const lightBg = isLightColor(bgColor);
  const lightAccent = isLightColor(accentColor);
  return {
    isLight: lightBg,
    bgColor,
    accentColor,
    textPrimary: lightBg ? '#111827' : '#f8fafc',
    textSecondary: lightBg ? '#374151' : '#cbd5e1',
    textMuted: lightBg ? '#6b7280' : '#94a3b8',
    surface: lightBg ? 'rgba(255, 255, 255, 0.86)' : 'rgba(15, 23, 42, 0.78)',
    surfaceAlt: lightBg ? 'rgba(17, 24, 39, 0.05)' : 'rgba(255, 255, 255, 0.05)',
    surfaceBorder: lightBg ? 'rgba(17, 24, 39, 0.14)' : 'rgba(255, 255, 255, 0.12)',
    badgeTextOnAccent: lightAccent ? '#090b10' : '#ffffff',
    shadow: lightBg
      ? '0 18px 44px rgba(15, 23, 42, 0.12)'
      : '0 24px 64px rgba(0, 0, 0, 0.5)',
  };
}

export interface EffectiveBeatEntry {
  beat: BeatSpec;
  timing: BeatTiming;
  idx: number;
}

export interface EffectiveBeatTimingsResult {
  beats: EffectiveBeatEntry[];
  totalFrames: number;
  fps: number;
}

/**
 * Resolves exact 60fps BeatTiming entries for every beat in the storyboard.
 * Preserves verbatim audio-aligned timestamps when beat IDs match in order;
 * otherwise repacks durations sequentially so added/deleted/reordered beats stay contiguous.
 */
export function resolveEffectiveBeatTimings(
  storyboard: Storyboard,
  timings: TimingsData | null | undefined
): EffectiveBeatTimingsResult {
  const fps = timings?.fps || storyboard.fps || FPS;
  const sbBeats = storyboard.beats || [];
  const rawTimings = timings?.beats || [];

  const exactOrderMatch =
    rawTimings.length === sbBeats.length &&
    sbBeats.length > 0 &&
    sbBeats.every((b, idx) => rawTimings[idx]?.id === b.id);

  if (exactOrderMatch) {
    const entries = sbBeats.map((beat, idx) => ({
      beat,
      timing: rawTimings[idx],
      idx,
    }));
    const lastEnd = entries[entries.length - 1]?.timing.endFrame ?? 0;
    return {
      beats: entries,
      totalFrames: Math.max(1, timings?.totalFrames || lastEnd),
      fps,
    };
  }

  const timingById = new Map<string, BeatTiming>();
  for (const bt of rawTimings) {
    timingById.set(bt.id, bt);
  }

  let cursor = 0;
  const entries: EffectiveBeatEntry[] = sbBeats.map((beat, idx) => {
    const found = timingById.get(beat.id);
    if (found) {
      const dur = Math.max(1, found.durationFrames || found.endFrame - found.startFrame);
      const delta = cursor - found.startFrame;
      const timing: BeatTiming = {
        ...found,
        startFrame: cursor,
        endFrame: cursor + dur,
        durationFrames: dur,
        words: (found.words || []).map((w) => ({
          ...w,
          startFrame: w.startFrame + delta,
          endFrame: w.endFrame + delta,
        })),
      };
      cursor += dur;
      return { beat, timing, idx };
    }

    const dur = Math.max(60, Math.round((beat.durationHintSec ?? 3.5) * fps));
    const timing: BeatTiming = {
      id: beat.id,
      startFrame: cursor,
      endFrame: cursor + dur,
      durationFrames: dur,
      words: [],
    };
    cursor += dur;
    return { beat, timing, idx };
  });

  return {
    beats: entries,
    totalFrames: Math.max(60, cursor),
    fps,
  };
}
