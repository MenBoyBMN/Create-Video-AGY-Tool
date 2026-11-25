import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cliPath = path.resolve(process.cwd(), 'cli', 'agy-studio.mjs');

describe('Unified CLI (cli/agy-studio.mjs)', () => {
  it('returns valid structured JSON on `info` with 7 presets, v2 voices, captionStyles, transitions, 21+ sfx, 6+ bgm, and gpu toolchain', () => {
    const res = spawnSync(process.execPath, [cliPath, 'info'], {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    expect(res.status).toBe(0);
    const data = JSON.parse(res.stdout);
    expect(data.ok).toBe(true);
    expect(data.presets.map((p: { id: string }) => p.id)).toEqual([
      'saas-motion',
      'explainer-editorial',
      'shorts-kinetic',
      'cinematic-broll',
      'whiteboard-sketch',
      'tech-3d-data',
      'dialogue-podcast',
    ]);
    expect(data.voices.some((v: { provider: string }) => v.provider === 'gemini')).toBe(true);
    expect(data.voices.some((v: { provider: string }) => v.provider === 'vieneu')).toBe(true);
    expect(data.captionStyles.length).toBeGreaterThanOrEqual(6);
    expect(data.transitions.length).toBeGreaterThanOrEqual(8);
    expect(data.sfx.length).toBeGreaterThanOrEqual(21);
    expect(data.bgm.length).toBeGreaterThanOrEqual(6);
    expect(data.toolchain.python.available).toBe(true);
    expect(data.toolchain.ffmpeg.available).toBe(true);
    expect(data.toolchain.gpu).toBeDefined();
    expect(typeof data.toolchain.gpu.nvencAvailable).toBe('boolean');
  });
});
