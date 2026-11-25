import { describe, expect, it } from 'vitest';
import {
  ASPECT_DIMS,
  DEPTH_FACTORS,
  FPS,
  SAFE_ZONES,
  SPRINGS,
  editorialProgress,
  hexToRgba,
  resolveEffectiveBeatTimings,
} from '../engine/motion/motionTokens';
import type { Storyboard, TimingsData } from '../engine/motion/types';

describe('60fps Motion Tokens', () => {
  it('defines studio 60fps constants and aspect dimensions', () => {
    expect(FPS).toBe(60);
    expect(ASPECT_DIMS['16:9']).toEqual({ width: 1920, height: 1080 });
    expect(ASPECT_DIMS['9:16']).toEqual({ width: 1080, height: 1920 });
  });

  it('defines 4-layer 2.5D parallax depth factors', () => {
    expect(DEPTH_FACTORS.background).toBe(0.28);
    expect(DEPTH_FACTORS.midground).toBe(0.65);
    expect(DEPTH_FACTORS.subject).toBe(1.0);
    expect(DEPTH_FACTORS.foreground).toBe(1.22);
  });

  it('defines safe zones protecting vertical TikTok/Shorts UI', () => {
    expect(SAFE_ZONES['9:16'].bottom).toBeGreaterThanOrEqual(400);
    expect(SAFE_ZONES['9:16'].right).toBeGreaterThanOrEqual(150);
    expect(SAFE_ZONES['16:9'].bottom).toBeGreaterThanOrEqual(100);
  });

  it('provides non-linear spring presets and editorial easing progression', () => {
    expect(Object.keys(SPRINGS)).toEqual([
      'SNAPPY',
      'SMOOTH_UI',
      'HEAVY_IMPACT',
      'ELASTIC',
      'CAMERA_GLIDE',
    ]);
    expect(editorialProgress(0, 0, 30)).toBe(0);
    expect(editorialProgress(30, 0, 30)).toBe(1);
    // Non-linear ease-out should be ahead of linear 0.5 at midpoint
    expect(editorialProgress(15, 0, 30)).toBeGreaterThan(0.5);
  });

  it('converts 3-digit and 6-digit hex colors to rgba cleanly and falls back safely on invalid hex', () => {
    expect(hexToRgba('#38bdf8', 0.5)).toBe('rgba(56, 189, 248, 0.5)');
    expect(hexToRgba('#fff', 0.25)).toBe('rgba(255, 255, 255, 0.25)');
    expect(hexToRgba('not-a-hex', 0.4)).toBe('rgba(8, 11, 18, 0.4)');
  });

  it('resolves beat timings verbatim on match and repacks sequentially when beats are added or reordered', () => {
    const baseStoryboard: Storyboard = {
      title: 'Test',
      aspect: '16:9',
      fps: 60,
      theme: { accentColor: '#38bdf8', bgColor: '#080b12' },
      beats: [
        { id: 'b1', title: 'One', narration: 'One', durationHintSec: 2 },
        { id: 'b2', title: 'Two', narration: 'Two', durationHintSec: 3 },
      ],
    };

    const timings: TimingsData = {
      fps: 60,
      totalFrames: 300,
      totalDurationSec: 5,
      waveformPeaks: [],
      beats: [
        {
          id: 'b1',
          startFrame: 0,
          endFrame: 120,
          durationFrames: 120,
          words: [{ word: 'One', startFrame: 10, endFrame: 40 }],
        },
        {
          id: 'b2',
          startFrame: 120,
          endFrame: 300,
          durationFrames: 180,
          words: [{ word: 'Two', startFrame: 135, endFrame: 180 }],
        },
      ],
    };

    const exact = resolveEffectiveBeatTimings(baseStoryboard, timings);
    expect(exact.totalFrames).toBe(300);
    expect(exact.beats[1].timing.startFrame).toBe(120);
    expect(exact.beats[1].timing.words[0].startFrame).toBe(135);

    // Reorder b2 before b1 and add b3
    const modified: Storyboard = {
      ...baseStoryboard,
      beats: [
        baseStoryboard.beats[1],
        baseStoryboard.beats[0],
        { id: 'b3', title: 'Three', narration: 'Three', durationHintSec: 2 },
      ],
    };
    const repacked = resolveEffectiveBeatTimings(modified, timings);
    expect(repacked.beats[0].timing.startFrame).toBe(0);
    expect(repacked.beats[0].timing.endFrame).toBe(180);
    expect(repacked.beats[0].timing.words[0].startFrame).toBe(15);
    expect(repacked.beats[1].timing.startFrame).toBe(180);
    expect(repacked.beats[1].timing.endFrame).toBe(300);
    expect(repacked.beats[2].timing.startFrame).toBe(300);
    expect(repacked.beats[2].timing.endFrame).toBe(420);
    expect(repacked.totalFrames).toBe(420);
  });
});
