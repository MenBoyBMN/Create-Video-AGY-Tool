import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Music, Plus, Subtitles, Volume2, Zap } from 'lucide-react';
import {
  resolveEffectiveBeatTimings,
  type Storyboard,
  type TimingsData,
} from '@agy/motion';

interface TimelineProps {
  storyboard: Storyboard;
  timings: TimingsData | null;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  selectedBeatId: string;
  onSeek: (frame: number) => void;
  onSelectBeat: (beatId: string, seekFrame: number) => void;
  onAddBeat: () => void;
  onUpdateSfxOffset: (beatId: string, sfxIndex: number, newOffsetMs: number) => void;
}

const BEAT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

function formatSecTick(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const Timeline: React.FC<TimelineProps> = ({
  storyboard,
  timings,
  currentFrame,
  totalFrames,
  fps,
  selectedBeatId,
  onSeek,
  onSelectBeat,
  onAddBeat,
  onUpdateSfxOffset,
}) => {
  const trackContainerRef = useRef<HTMLDivElement | null>(null);
  const waveWrapperRef = useRef<HTMLDivElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveSizeRef = useRef<{ width: number; height: number }>({ width: 800, height: 42 });

  const [draggingSfx, setDraggingSfx] = useState<{
    beatId: string;
    sfxIndex: number;
    beatStartFrame: number;
    beatDurationMs: number;
  } | null>(null);
  const [waveTick, setWaveTick] = useState(0);

  const effectiveBeats = useMemo(
    () => resolveEffectiveBeatTimings(storyboard, timings).beats,
    [storyboard, timings]
  );

  // Group caption words into display phrases for T1 track
  const captionPhrases = useMemo(() => {
    const allWords = effectiveBeats.flatMap((item) => item.timing.words || []);
    const out: Array<{ text: string; startFrame: number; endFrame: number }> = [];
    const chunkSize = storyboard.aspect === '9:16' ? 4 : 6;
    for (let i = 0; i < allWords.length; i += chunkSize) {
      const slice = allWords.slice(i, i + chunkSize);
      if (slice.length > 0) {
        out.push({
          text: slice.map((w) => w.word).join(' '),
          startFrame: slice[0].startFrame,
          endFrame: slice[slice.length - 1].endFrame,
        });
      }
    }
    return out;
  }, [effectiveBeats, storyboard.aspect]);

  // Observe container resize so canvas buffer is only reallocated on actual resize
  useEffect(() => {
    const wrapper = waveWrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(100, Math.round(entry.contentRect.width));
        const h = Math.max(24, Math.round(entry.contentRect.height));
        if (w !== waveSizeRef.current.width || h !== waveSizeRef.current.height) {
          waveSizeRef.current = { width: w, height: h };
          setWaveTick((t) => t + 1);
        }
      }
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // Draw real waveform peaks onto HTML5 Canvas
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = waveSizeRef.current;
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const peaks = timings?.waveformPeaks || [];
    if (peaks.length === 0) {
      ctx.strokeStyle = 'rgba(113, 113, 122, 0.35)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const playheadRatio = totalFrames > 0 ? currentFrame / totalFrames : 0;
    const barW = width / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const p = Math.max(0.06, peaks[i]);
      const barH = p * (height - 8);
      const x = i * barW;
      const y = (height - barH) / 2;
      const ratio = i / peaks.length;
      ctx.fillStyle = ratio <= playheadRatio ? '#3b82f6' : 'rgba(113, 113, 122, 0.45)';
      ctx.fillRect(x + 0.5, y, Math.max(1.5, barW - 1.2), barH);
    }
    ctx.restore();
  }, [timings?.waveformPeaks, currentFrame, totalFrames, waveTick]);

  // Handle pointer drag for SFX markers
  useEffect(() => {
    if (!draggingSfx) return;
    const handleMove = (e: PointerEvent) => {
      const rect = trackContainerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const globalFrame = ratio * totalFrames;
      const relFrames = globalFrame - draggingSfx.beatStartFrame;
      const newOffsetMs = Math.max(
        0,
        Math.min(draggingSfx.beatDurationMs, Math.round((relFrames / fps) * 1000))
      );
      onUpdateSfxOffset(draggingSfx.beatId, draggingSfx.sfxIndex, newOffsetMs);
    };
    const handleUp = () => setDraggingSfx(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggingSfx, totalFrames, fps, onUpdateSfxOffset]);

  const scrubCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      scrubCleanupRef.current?.();
    };
  }, []);

  const scrubFromClientX = (clientX: number) => {
    const rect = trackContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(Math.round(ratio * Math.max(1, totalFrames - 1)));
  };

  const playheadPct =
    totalFrames > 0 ? Math.min(100, Math.max(0, (currentFrame / totalFrames) * 100)) : 0;
  const totalSec = totalFrames / fps;
  const tickCount = Math.max(4, Math.min(12, Math.ceil(totalSec / 2)));

  return (
    <div className="h-[244px] shrink-0 bg-[#141416] border-t border-[#26262a] flex flex-col select-none">
      {/* Timeline Header Bar */}
      <div className="h-8 px-3 border-b border-[#26262a] bg-[#161618] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-zinc-200">Dòng thời gian</span>
          <span className="font-mono text-zinc-500 tabular-nums">
            {storyboard.beats.length} cảnh · {totalFrames}f @ {fps}fps
          </span>
        </div>
        <button
          type="button"
          onClick={onAddBeat}
          className="studio-btn-ghost py-0.5 px-2 text-[11px]"
        >
          <Plus className="w-3 h-3 text-zinc-300" />
          <span>Thêm cảnh</span>
        </button>
      </div>

      {/* Tracks Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers */}
        <div className="w-[128px] shrink-0 border-r border-[#26262a] bg-[#141416] flex flex-col text-[11px] text-zinc-400">
          <div className="h-6 border-b border-[#222226] px-2.5 flex items-center text-[10px] font-mono text-zinc-500">
            TC
          </div>
          <div className="h-12 border-b border-[#222226] px-2.5 flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-500 w-4">V1</span>
            <Layers className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="truncate font-medium text-zinc-300">Scenes</span>
          </div>
          <div className="h-10 border-b border-[#222226] px-2.5 flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-500 w-4">T1</span>
            <Subtitles className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="truncate">Captions</span>
          </div>
          <div className="h-11 border-b border-[#222226] px-2.5 flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-500 w-4">A1</span>
            <Volume2 className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="truncate">Voiceover</span>
          </div>
          <div className="flex-1 px-2.5 flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-500 w-4">A2</span>
            <Music className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="truncate">SFX & BGM</span>
          </div>
        </div>

        {/* Right Timeline Lanes */}
        <div ref={trackContainerRef} className="flex-1 relative overflow-hidden bg-[#0f0f11]">
          {/* Ruler */}
          <div
            className="h-6 border-b border-[#222226] relative cursor-ew-resize bg-[#141416]"
            onPointerDown={(e) => {
              scrubCleanupRef.current?.();
              scrubFromClientX(e.clientX);
              const move = (ev: PointerEvent) => scrubFromClientX(ev.clientX);
              const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                scrubCleanupRef.current = null;
              };
              scrubCleanupRef.current = up;
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
            }}
          >
            {Array.from({ length: tickCount + 1 }).map((_, idx) => {
              const pct = (idx / tickCount) * 100;
              return (
                <div
                  key={idx}
                  style={{ left: `${pct}%` }}
                  className="absolute top-0 bottom-0 border-l border-[#26262a] pl-1 flex items-center text-[10px] font-mono text-zinc-500 tabular-nums"
                >
                  {formatSecTick((idx / tickCount) * totalSec)}
                </div>
              );
            })}
          </div>

          {/* Track V1: Scenes */}
          <div className="h-12 border-b border-[#222226] relative px-0.5 py-1">
            {effectiveBeats.map(({ beat, timing, idx }) => {
              const leftPct = (timing.startFrame / Math.max(1, totalFrames)) * 100;
              const widthPct = (timing.durationFrames / Math.max(1, totalFrames)) * 100;
              const color = beat.accentColor || BEAT_COLORS[idx % BEAT_COLORS.length];
              const isSelected = beat.id === selectedBeatId;
              const isCustom = Boolean(beat.customScene);

              return (
                <button
                  type="button"
                  key={`${beat.id}-${idx}`}
                  onClick={() => onSelectBeat(beat.id, timing.startFrame)}
                  style={{
                    left: `${leftPct}%`,
                    width: `calc(${widthPct}% - 2px)`,
                    borderLeftColor: color,
                  }}
                  className={`absolute top-1 bottom-1 rounded-[4px] border border-l-[3px] px-2 flex items-center justify-between gap-1.5 overflow-hidden text-left transition-colors ${
                    isSelected
                      ? 'bg-[#1e2433] border-blue-500/80 z-10'
                      : 'bg-[#1c1c1f] border-[#2c2c32] hover:bg-[#232327]'
                  }`}
                  title={`${beat.id}: ${beat.title} (${(timing.durationFrames / fps).toFixed(1)}s)`}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-zinc-100 truncate">
                      {idx + 1}. {beat.title}
                    </div>
                    <div className="text-[9px] font-mono text-zinc-400 tabular-nums truncate">
                      {(timing.durationFrames / fps).toFixed(1)}s
                    </div>
                  </div>
                  {isCustom && (
                    <span className="shrink-0 px-1 py-0.5 rounded-[3px] text-[9px] font-mono font-medium bg-[#111113] text-blue-300 border border-[#323238]">
                      TSX
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Track T1: Captions */}
          <div
            className="h-10 border-b border-[#222226] relative cursor-pointer"
            onClick={(e) => scrubFromClientX(e.clientX)}
          >
            {captionPhrases.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[10px] text-zinc-600 font-mono">
                Chạy "Đồng bộ Audio" để tạo timeline phụ đề từng từ
              </div>
            ) : (
              captionPhrases.map((phrase, idx) => {
                const leftPct = (phrase.startFrame / Math.max(1, totalFrames)) * 100;
                const widthPct = Math.max(
                  1.5,
                  ((phrase.endFrame - phrase.startFrame) / Math.max(1, totalFrames)) * 100
                );
                return (
                  <div
                    key={idx}
                    style={{ left: `${leftPct}%`, width: `calc(${widthPct}% - 2px)` }}
                    className="absolute top-1.5 bottom-1.5 rounded-[3px] bg-[#1a2230] border border-[#2d3b52] px-1.5 flex items-center text-[10px] text-zinc-200 truncate"
                    title={phrase.text}
                  >
                    {phrase.text}
                  </div>
                );
              })
            )}
          </div>

          {/* Track A1: Voiceover Waveform */}
          <div
            ref={waveWrapperRef}
            className="h-11 border-b border-[#222226] relative cursor-pointer"
            onClick={(e) => scrubFromClientX(e.clientX)}
          >
            <canvas ref={waveCanvasRef} className="w-full h-full block" />
          </div>

          {/* Track A2: SFX Cues & BGM Bed */}
          <div className="h-[52px] relative bg-[#0c0c0e]">
            {storyboard.bgm?.track && storyboard.bgm.track !== 'none' && (
              <div className="absolute inset-x-1 bottom-1 h-4 rounded-[3px] bg-[#14201b] border border-[#223b30] px-2 flex items-center justify-between text-[9px] font-mono text-emerald-300/85 pointer-events-none tabular-nums">
                <span>BGM: {storyboard.bgm.track}</span>
                <span>{Math.round((storyboard.bgm.volume ?? 0.16) * 100)}% · Sidechain -14 LUFS</span>
              </div>
            )}

            {effectiveBeats.map(({ beat, timing }) =>
              (beat.sfx || []).map((cue, sfxIdx) => {
                const cueFrame =
                  timing.startFrame + Math.round(((cue.offsetMs || 0) / 1000) * fps);
                const leftPct = Math.min(
                  97,
                  Math.max(0, (cueFrame / Math.max(1, totalFrames)) * 100)
                );
                const beatDurMs = Math.round((timing.durationFrames / fps) * 1000);
                return (
                  <div
                    key={`${beat.id}-sfx-${sfxIdx}`}
                    style={{ left: `${leftPct}%` }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingSfx({
                        beatId: beat.id,
                        sfxIndex: sfxIdx,
                        beatStartFrame: timing.startFrame,
                        beatDurationMs: beatDurMs,
                      });
                    }}
                    className="absolute top-1 z-20 cursor-grab active:cursor-grabbing inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] bg-[#261f12] border border-[#6b4f1d] text-[10px] font-mono text-amber-300 hover:bg-[#332917] whitespace-nowrap"
                    title={`Kéo ngang để dời offset (${cue.id} @ +${cue.offsetMs}ms)`}
                  >
                    <Zap className="w-2.5 h-2.5 shrink-0" />
                    <span>{cue.id}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Razor-sharp NLE Playhead */}
          <div
            style={{ left: `${playheadPct}%` }}
            className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
          >
            <div className="w-2.5 h-2.5 -ml-[4.5px] bg-red-500 [clip-path:polygon(0_0,100%_0,100%_45%,50%_100%,0_45%)]" />
          </div>
        </div>
      </div>
    </div>
  );
};
