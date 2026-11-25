import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FolderOpen,
  Grid,
  Loader2,
  Maximize2,
  Monitor,
  Pause,
  Play,
  SkipBack,
  Smartphone,
  Subtitles,
  Volume2,
  X,
} from 'lucide-react';
import {
  ASPECT_DIMS,
  resolveEffectiveBeatTimings,
  type AspectRatio,
  type BeatSpec,
  type CompositionInputProps,
  type Storyboard,
} from '@agy/motion';
import { CompositionRoot } from '@agy/runtime';
import type { JobProgressEvent, StudioAppInfo, StudioProjectDetail } from '../types/studio';
import { Timeline } from './Timeline';
import { Inspector } from './Inspector';

interface StudioEditorProps {
  projectId: string;
  appInfo: StudioAppInfo | null;
  onBack: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}

function formatTimecode(frame: number, fps: number): string {
  const safeFrame = Math.max(0, Math.floor(frame));
  const totalSec = Math.floor(safeFrame / fps);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const f = safeFrame % fps;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export const StudioEditor: React.FC<StudioEditorProps> = ({
  projectId,
  appInfo,
  onBack,
  onNotify,
}) => {
  const playerRef = useRef<PlayerRef | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hotReloadTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const lastSelfSaveAtRef = useRef(0);
  const storyboardRef = useRef<Storyboard | null>(null);
  const currentFrameRef = useRef(0);
  const totalFramesRef = useRef(180);

  const [detail, setDetail] = useState<StudioProjectDetail | null>(null);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string>('');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hotReloadBadge, setHotReloadBadge] = useState<string | null>(null);
  const [cancelingJob, setCancelingJob] = useState(false);

  const [activeJob, setActiveJob] = useState<{
    id: string;
    kind: 'audio' | 'qa' | 'export';
    percent: number;
    message: string;
  } | null>(null);

  storyboardRef.current = storyboard;
  currentFrameRef.current = currentFrame;

  const setDirtyState = useCallback((nextDirty: boolean) => {
    dirtyRef.current = nextDirty;
    setDirty(nextDirty);
  }, []);

  const loadDetail = useCallback(async () => {
    const res = await window.agyStudio.getProject(projectId);
    setDetail(res);
    setStoryboard(res.storyboard);
    setSelectedBeatId((prev) =>
      res.storyboard?.beats?.some((b) => b.id === prev)
        ? prev
        : res.storyboard?.beats?.[0]?.id || ''
    );
  }, [projectId]);

  useEffect(() => {
    loadDetail().catch((err) => onNotify(err instanceof Error ? err.message : String(err), 'error'));
    window.agyStudio.watchProject(projectId);

    const offChanged = window.agyStudio.onProjectChanged((ev) => {
      if (ev.projectId !== projectId) return;
      const isSelfStoryboardSave =
        (ev.changedFile.endsWith('storyboard.json') || ev.changedFile.endsWith('project.json')) &&
        Date.now() - lastSelfSaveAtRef.current < 900;
      if (isSelfStoryboardSave) {
        return;
      }

      setDetail(ev.detail);
      if (!dirtyRef.current || ev.changedFile.includes('scenes') || ev.changedFile.includes('timings')) {
        if (ev.detail.storyboard) setStoryboard(ev.detail.storyboard);
      }
      setHotReloadBadge(ev.changedFile);
      if (hotReloadTimerRef.current) window.clearTimeout(hotReloadTimerRef.current);
      hotReloadTimerRef.current = window.setTimeout(() => setHotReloadBadge(null), 2400);
    });

    const offProgress = window.agyStudio.onJobProgress((ev: JobProgressEvent) => {
      setActiveJob((prev) =>
        prev && prev.id === ev.jobId
          ? { ...prev, percent: ev.percent, message: ev.message }
          : prev
      );
    });

    return () => {
      offChanged();
      offProgress();
      window.agyStudio.unwatchProject();
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (hotReloadTimerRef.current) window.clearTimeout(hotReloadTimerRef.current);
    };
  }, [projectId, loadDetail, onNotify]);

  // Sync Remotion Player frame & play state
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setCurrentFrame(e.detail.frame);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [detail?.revision, storyboard?.aspect]);

  const resolvedTimings = useMemo(() => {
    if (!storyboard) {
      return { beats: [], totalFrames: 180, fps: 60 };
    }
    return resolveEffectiveBeatTimings(storyboard, detail?.timings);
  }, [storyboard, detail?.timings]);

  const fps = resolvedTimings.fps;
  const totalFrames = resolvedTimings.totalFrames;
  totalFramesRef.current = totalFrames;

  const activeBeatIndex = useMemo(() => {
    const idx = resolvedTimings.beats.findIndex(
      (entry) => currentFrame >= entry.timing.startFrame && currentFrame < entry.timing.endFrame
    );
    return idx >= 0 ? idx : 0;
  }, [resolvedTimings.beats, currentFrame]);

  const seekToFrame = useCallback((targetFrame: number) => {
    const clamped = Math.max(0, Math.min(Math.max(0, totalFramesRef.current - 1), targetFrame));
    playerRef.current?.seekTo(clamped);
    setCurrentFrame(clamped);
  }, []);

  const persistStoryboard = useCallback(
    (next: Storyboard, immediate = false) => {
      setStoryboard(next);
      setDirtyState(true);
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const runSave = async () => {
        lastSelfSaveAtRef.current = Date.now();
        await window.agyStudio.saveStoryboard(projectId, next);
        setDirtyState(false);
      };
      if (immediate) {
        runSave().catch((err) => onNotify(err instanceof Error ? err.message : String(err), 'error'));
      } else {
        saveTimerRef.current = window.setTimeout(() => {
          saveTimerRef.current = null;
          runSave().catch((err) => onNotify(err instanceof Error ? err.message : String(err), 'error'));
        }, 420);
      }
    },
    [projectId, onNotify, setDirtyState]
  );

  // Stable global keyboard shortcuts (never re-binds at 60fps)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (storyboardRef.current) {
          persistStoryboard(storyboardRef.current, true);
          onNotify('Đã lưu storyboard', 'success');
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        playerRef.current?.toggle();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        seekToFrame(currentFrameRef.current - step);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        seekToFrame(currentFrameRef.current + step);
      } else if (e.code === 'Home') {
        e.preventDefault();
        seekToFrame(0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [persistStoryboard, seekToFrame, onNotify]);

  const handleUpdateStoryboard = useCallback(
    (updater: (sb: Storyboard) => Storyboard) => {
      if (!storyboard) return;
      persistStoryboard(updater(storyboard));
    },
    [storyboard, persistStoryboard]
  );

  const handleUpdateBeat = useCallback(
    (beatId: string, updater: (beat: BeatSpec) => BeatSpec) => {
      if (!storyboard) return;
      persistStoryboard({
        ...storyboard,
        beats: storyboard.beats.map((b) => (b.id === beatId ? updater(b) : b)),
      });
    },
    [storyboard, persistStoryboard]
  );

  const handleAddBeat = useCallback(() => {
    if (!storyboard) return;
    const existingIds = new Set(storyboard.beats.map((b) => b.id));
    let n = storyboard.beats.length + 1;
    while (existingIds.has(`beat-${n}`)) {
      n += 1;
    }
    const newId = `beat-${n}`;
    const newBeat: BeatSpec = {
      id: newId,
      badge: `SCENE ${String(n).padStart(2, '0')}`,
      title: `Cảnh mới ${n}`,
      subtitle: 'Mô tả ngắn gọn nội dung cảnh này',
      narration: 'Nhập lời thoại cho cảnh mới tại đây.',
      preset: storyboard.beats[0]?.preset || 'saas-motion',
      accentColor: storyboard.theme.accentColor || '#38bdf8',
      cameraMove: 'slow_push_in',
      sfx: [{ id: 'whoosh_soft', offsetMs: 0, volume: 0.45 }],
      durationHintSec: 3.5,
    };
    persistStoryboard({ ...storyboard, beats: [...storyboard.beats, newBeat] }, true);
    setSelectedBeatId(newId);
  }, [storyboard, persistStoryboard]);

  const handleMoveBeat = useCallback(
    (beatId: string, direction: -1 | 1) => {
      if (!storyboard) return;
      const idx = storyboard.beats.findIndex((b) => b.id === beatId);
      const targetIdx = idx + direction;
      if (idx < 0 || targetIdx < 0 || targetIdx >= storyboard.beats.length) return;
      const nextBeats = [...storyboard.beats];
      const [moved] = nextBeats.splice(idx, 1);
      nextBeats.splice(targetIdx, 0, moved);
      persistStoryboard({ ...storyboard, beats: nextBeats }, true);
    },
    [storyboard, persistStoryboard]
  );

  const handleDeleteBeat = useCallback(
    (beatId: string) => {
      if (!storyboard || storyboard.beats.length <= 1) return;
      const remaining = storyboard.beats.filter((b) => b.id !== beatId);
      persistStoryboard({ ...storyboard, beats: remaining }, true);
      if (selectedBeatId === beatId) {
        setSelectedBeatId(remaining[0]?.id || '');
      }
    },
    [storyboard, selectedBeatId, persistStoryboard]
  );

  const handleUpdateSfxOffset = useCallback(
    (beatId: string, sfxIndex: number, newOffsetMs: number) => {
      handleUpdateBeat(beatId, (b) => ({
        ...b,
        sfx: (b.sfx || []).map((c, i) => (i === sfxIndex ? { ...c, offsetMs: newOffsetMs } : c)),
      }));
    },
    [handleUpdateBeat]
  );

  const handleImportAsset = useCallback(
    async (beatId: string) => {
      const res = await window.agyStudio.importAsset(projectId);
      if (res.canceled || !res.relPath) return;
      handleUpdateBeat(beatId, (b) => ({ ...b, asset: res.relPath }));
      await loadDetail();
      onNotify(`Đã nhập tài nguyên ${res.name}`, 'success');
    },
    [projectId, handleUpdateBeat, loadDetail, onNotify]
  );

  const handleCopyAgyPrompt = useCallback(
    async (beat: BeatSpec, customNote: string) => {
      if (!detail || !storyboard) return;
      const sceneName =
        beat.customScene ||
        `${beat.id
          .replace(/[^a-zA-Z0-9]+/g, ' ')
          .trim()
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join('')}Scene`;

      const prompt = [
        `Hãy giúp tôi chỉnh sửa / nâng cấp hoạt ảnh 60fps bằng code cho cảnh sau trong AGY Video Studio:`,
        `- Project ID: ${projectId}`,
        `- Beat ID: ${beat.id} ("${beat.title}")`,
        `- Aspect: ${storyboard.aspect} (${fps}fps)`,
        `- Storyboard: ${detail.projectDir}\\storyboard.json`,
        `- Target CustomScene file: ${detail.projectDir}\\scenes\\${sceneName}.tsx`,
        `- Khai báo trong storyboard.json cho beat "${beat.id}": "customScene": "${sceneName}"`,
        `- Import dùng được: react, remotion, @agy/motion (SPRINGS, EASINGS, Camera25DRig, ParallaxLayer, SAFE_ZONES, MediaLayer, RoughBox, RoughArrow, DeviceMockup3D, CodeWindow, AnimatedBarChart, HighlighterText, CrtVhsOverlay, PaperTextureOverlay, LightLeakOverlay, getAdaptivePalette), lucide-react, @remotion/paths, @remotion/shapes, @remotion/noise, @remotion/motion-blur, @remotion/three, three, roughjs, recharts`,
        `- Nội dung hiện tại của beat:`,
        '```json',
        JSON.stringify(beat, null, 2),
        '```',
        customNote
          ? `- Yêu cầu thiết kế của tôi: ${customNote}`
          : `- Yêu cầu: Viết hoạt ảnh 60fps giàu chiều sâu 2.5D, không dùng linear easing, tôn trọng Safe Zone ${storyboard.aspect}.`,
      ].join('\n');

      await window.agyStudio.copyText(prompt);
      onNotify('Đã copy prompt ngữ cảnh cho AGY Studio', 'success');
    },
    [detail, storyboard, projectId, fps, onNotify]
  );

  const handleSceneErrorCopy = useCallback(
    async (payload: {
      projectId: string;
      beatId: string;
      sceneName: string;
      errorMessage: string;
      stack?: string;
    }) => {
      const prompt = [
        `Cảnh CustomScene trong AGY Video Studio đang bị lỗi, hãy sửa giúp tôi:`,
        `- Project ID: ${payload.projectId}`,
        `- Beat ID: ${payload.beatId}`,
        `- File: ${detail?.projectDir}\\scenes\\${payload.sceneName}.tsx`,
        `- Error: ${payload.errorMessage}`,
        payload.stack ? `\nDetails:\n${payload.stack}` : '',
      ].join('\n');
      await window.agyStudio.copyText(prompt);
      onNotify('Đã copy chi tiết lỗi CustomScene', 'success');
    },
    [detail, onNotify]
  );

  const runJob = async (kind: 'audio' | 'qa' | 'export') => {
    if (!storyboard) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (dirtyRef.current) {
      lastSelfSaveAtRef.current = Date.now();
      await window.agyStudio.saveStoryboard(projectId, storyboard);
      setDirtyState(false);
    }

    const jobId = `${kind}-${Date.now()}`;
    const labelMap = {
      audio: 'Đang tạo TTS, căn chỉnh RMS/Whisper & Master -14 LUFS...',
      qa: 'Đang chụp keyframe PNG & tạo thumbnail QA...',
      export: 'Đang render MP4 60fps (H.264 yuv420p)...',
    };
    setCancelingJob(false);
    setActiveJob({ id: jobId, kind, percent: 5, message: labelMap[kind] });
    try {
      if (kind === 'audio') {
        await window.agyStudio.runAudioJob(jobId, projectId);
        await loadDetail();
        onNotify('Đã cập nhật âm thanh -14 LUFS & timings.json 60fps', 'success');
      } else if (kind === 'qa') {
        await window.agyStudio.runQaJob(jobId, projectId);
        await loadDetail();
        onNotify('Đã chụp xong keyframe Visual QA & cập nhật thumbnail', 'success');
      } else {
        const res = await window.agyStudio.runExportJob(jobId, projectId);
        await loadDetail();
        onNotify(`Xuất MP4 thành công: ${String(res.relativeExportPath || 'exports/')}`, 'success');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActiveJob(null);
      setCancelingJob(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob || cancelingJob) return;
    setCancelingJob(true);
    try {
      await window.agyStudio.cancelJob(activeJob.id);
      onNotify('Đã yêu cầu hủy tác vụ đang chạy', 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err), 'error');
      setCancelingJob(false);
    }
  };

  if (!detail || !storyboard) {
    return (
      <div className="h-full flex items-center justify-center bg-[#111113] text-zinc-400 text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span>Đang tải dự án {projectId}...</span>
      </div>
    );
  }

  const aspect: AspectRatio = storyboard.aspect || '16:9';
  const dims = ASPECT_DIMS[aspect] || ASPECT_DIMS['16:9'];
  const selectedBeatIndex = storyboard.beats.findIndex((b) => b.id === selectedBeatId);
  const selectedBeat =
    (selectedBeatIndex >= 0 ? storyboard.beats[selectedBeatIndex] : storyboard.beats[0]) || null;

  const inputProps: CompositionInputProps = {
    projectId,
    storyboard,
    timings: detail.timings || {
      fps,
      totalFrames,
      totalDurationSec: totalFrames / fps,
      waveformPeaks: [],
      beats: [],
    },
    assetBaseUrl: detail.assetBaseUrl,
    compiledScenes: detail.compiledScenes,
    showSafeZones,
    enableAudio: true,
    onSceneErrorCopy: handleSceneErrorCopy,
  };

  return (
    <div className="h-full flex flex-col bg-[#111113] overflow-hidden">
      {/* 1. TOP NLE WORKBENCH TOOLBAR */}
      <header className="h-11 shrink-0 px-3 border-b border-[#26262a] bg-[#161618] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="studio-btn-ghost py-1 px-2 text-[11px]"
            title="Quay lại thư viện dự án"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dự án</span>
          </button>

          <div className="h-4 w-px bg-[#26262a]" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-zinc-100 truncate max-w-[240px]">
              {storyboard.title}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                dirty ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              title={dirty ? 'Đang lưu thay đổi...' : 'Đã lưu'}
            />
            {hotReloadBadge && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c1f] text-zinc-300 border border-[#323238] truncate max-w-[180px]">
                Reload: {hotReloadBadge}
              </span>
            )}
          </div>
        </div>

        {/* Center Viewport & Overlay Toggles */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#111113] border border-[#26262a] rounded-[5px] p-0.5">
            {(['16:9', '9:16'] as const).map((asp) => (
              <button
                type="button"
                key={asp}
                onClick={() => handleUpdateStoryboard((sb) => ({ ...sb, aspect: asp }))}
                className={`px-2 py-0.5 rounded-[3px] text-[11px] font-mono font-medium flex items-center gap-1 transition-colors ${
                  aspect === asp
                    ? 'bg-[#232327] text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {asp === '16:9' ? (
                  <Monitor className="w-3 h-3" />
                ) : (
                  <Smartphone className="w-3 h-3" />
                )}
                {asp}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowSafeZones((v) => !v)}
            className={`studio-btn py-1 px-2 text-[11px] border ${
              showSafeZones
                ? 'bg-[#232327] text-zinc-100 border-blue-500/60'
                : 'bg-[#1c1c1f] text-zinc-400 border-[#26262a] hover:text-zinc-200'
            }`}
            title="Bật/tắt khung lưới Safe Zone"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Safe Zone</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleUpdateStoryboard((sb) => ({
                ...sb,
                showCaptions: sb.showCaptions === false ? true : false,
              }))
            }
            className={`studio-btn py-1 px-2 text-[11px] border ${
              storyboard.showCaptions !== false
                ? 'bg-[#232327] text-zinc-100 border-blue-500/60'
                : 'bg-[#1c1c1f] text-zinc-400 border-[#26262a] hover:text-zinc-200'
            }`}
            title="Bật/tắt phụ đề trên khung hình"
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span>Phụ đề</span>
          </button>
        </div>

        {/* Right Pipeline Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => window.agyStudio.openProjectDir(projectId)}
            aria-label="Mở thư mục dự án"
            className="studio-btn-ghost py-1 px-2"
            title="Mở thư mục dự án"
          >
            <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          <button
            type="button"
            disabled={Boolean(activeJob)}
            onClick={() => runJob('audio')}
            className="studio-btn-ghost py-1 px-2.5 text-[11px]"
          >
            <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Đồng bộ Audio</span>
          </button>

          <button
            type="button"
            disabled={Boolean(activeJob)}
            onClick={() => runJob('qa')}
            className="studio-btn-ghost py-1 px-2.5 text-[11px]"
            title="Chụp keyframe QA & tạo Thumbnail"
          >
            <Camera className="w-3.5 h-3.5 text-zinc-400" />
            <span>Chụp QA</span>
          </button>

          <button
            type="button"
            disabled={Boolean(activeJob)}
            onClick={() => runJob('export')}
            className="studio-btn-primary py-1 px-3 text-[11px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất MP4</span>
          </button>
        </div>
      </header>

      {/* Active Job Progress Strip */}
      {activeJob && (
        <div className="shrink-0 px-4 py-1.5 bg-[#161618] border-b border-[#26262a] flex items-center gap-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium text-zinc-200 truncate">{activeJob.message}</span>
              <span className="font-mono tabular-nums text-zinc-300">{activeJob.percent}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-[#0a0a0b] overflow-hidden">
              <div
                style={{ width: `${Math.max(4, activeJob.percent)}%` }}
                className="h-full bg-blue-500 transition-all duration-150"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={cancelingJob}
            onClick={handleCancelJob}
            className="studio-btn-danger py-0.5 px-2 text-[11px]"
          >
            <X className="w-3 h-3" />
            <span>{cancelingJob ? 'Đang hủy...' : 'Hủy'}</span>
          </button>
        </div>
      )}

      {/* MIDDLE AREA: Center Monitor + Right Inspector */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 2. CENTER PROGRAM MONITOR */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0b]">
          <div className="h-7 shrink-0 px-4 border-b border-[#1c1c1f] bg-[#111113] flex items-center justify-between text-[11px] font-mono text-zinc-500 tabular-nums">
            <span>
              MONITOR · {dims.width}×{dims.height} · {fps}fps
            </span>
            <span>
              Cảnh {activeBeatIndex + 1}/{storyboard.beats.length}
            </span>
          </div>

          <div className="flex-1 min-h-0 p-4 flex items-center justify-center overflow-hidden">
            <div
              className="relative rounded overflow-hidden ring-1 ring-[#26262a] shadow-[0_20px_60px_rgba(0,0,0,0.85)] bg-black flex items-center justify-center"
              style={{
                aspectRatio: aspect === '9:16' ? '9 / 16' : '16 / 9',
                height: aspect === '9:16' ? '100%' : 'auto',
                width: aspect === '9:16' ? 'auto' : '100%',
                maxHeight: '100%',
                maxWidth: '100%',
              }}
            >
              <Player
                ref={playerRef}
                component={CompositionRoot as unknown as React.FC<Record<string, unknown>>}
                inputProps={inputProps as unknown as Record<string, unknown>}
                durationInFrames={totalFrames}
                fps={fps}
                compositionWidth={dims.width}
                compositionHeight={dims.height}
                style={{ width: '100%', height: '100%' }}
                controls={false}
                loop
                acknowledgeRemotionLicense
              />
            </div>
          </div>

          {/* Transport Bar */}
          <div className="h-10 shrink-0 px-4 border-t border-[#26262a] bg-[#161618] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
              <span className="text-zinc-100 font-medium">{formatTimecode(currentFrame, fps)}</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400">{formatTimecode(totalFrames, fps)}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => seekToFrame(0)}
                aria-label="Về đầu dòng thời gian"
                className="studio-icon-btn"
                title="Về đầu (Home)"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => seekToFrame(currentFrame - 5)}
                aria-label="Lùi 5 frame"
                className="studio-btn-ghost py-1 px-2 text-[11px] font-mono tabular-nums"
                title="Lùi 5 frame"
              >
                <ChevronsLeft className="w-3 h-3" />
                5f
              </button>
              <button
                type="button"
                onClick={() => seekToFrame(currentFrame - 1)}
                aria-label="Lùi 1 frame"
                className="studio-btn-ghost py-1 px-2 text-[11px] font-mono tabular-nums"
                title="Lùi 1 frame (←)"
              >
                <ChevronLeft className="w-3 h-3" />
                1f
              </button>

              <button
                type="button"
                onClick={() => playerRef.current?.toggle()}
                aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                className="mx-1 w-8 h-7 rounded-[5px] bg-[#2563eb] hover:bg-[#3b82f6] text-white flex items-center justify-center transition-colors active:scale-[0.97]"
                title="Phát / Tạm dừng (Space)"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => seekToFrame(currentFrame + 1)}
                aria-label="Tiến 1 frame"
                className="studio-btn-ghost py-1 px-2 text-[11px] font-mono tabular-nums"
                title="Tiến 1 frame (→)"
              >
                1f
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => seekToFrame(currentFrame + 5)}
                aria-label="Tiến 5 frame"
                className="studio-btn-ghost py-1 px-2 text-[11px] font-mono tabular-nums"
                title="Tiến 5 frame"
              >
                5f
                <ChevronsRight className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                F{currentFrame}
              </span>
              <button
                type="button"
                onClick={() => playerRef.current?.requestFullscreen()}
                aria-label="Phóng to toàn màn hình"
                className="studio-icon-btn"
                title="Toàn màn hình"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 4. RIGHT INSPECTOR */}
        <Inspector
          projectId={projectId}
          projectDir={detail.projectDir}
          assetBaseUrl={detail.assetBaseUrl}
          storyboard={storyboard}
          selectedBeat={selectedBeat}
          selectedBeatIndex={selectedBeatIndex >= 0 ? selectedBeatIndex : 0}
          assets={detail.assets}
          appInfo={appInfo}
          onUpdateBeat={handleUpdateBeat}
          onMoveBeat={handleMoveBeat}
          onDeleteBeat={handleDeleteBeat}
          onUpdateStoryboard={handleUpdateStoryboard}
          onImportAsset={handleImportAsset}
          onCopyAgyPrompt={handleCopyAgyPrompt}
        />
      </div>

      {/* 3. BOTTOM MULTI-TRACK TIMELINE */}
      <Timeline
        storyboard={storyboard}
        timings={detail.timings}
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        fps={fps}
        selectedBeatId={selectedBeatId}
        onSeek={seekToFrame}
        onSelectBeat={(beatId, seekFrame) => {
          setSelectedBeatId(beatId);
          seekToFrame(seekFrame);
        }}
        onAddBeat={handleAddBeat}
        onUpdateSfxOffset={handleUpdateSfxOffset}
      />
    </div>
  );
};
