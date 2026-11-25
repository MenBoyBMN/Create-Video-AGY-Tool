import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Code2,
  FileText,
  Film,
  Image as ImageIcon,
  Palette,
  Plus,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import type {
  BeatSpec,
  CameraMoveType,
  CaptionStyleId,
  PresetId,
  Storyboard,
  TransitionType,
} from '@agy/motion';
import type { ProjectAssetItem, StudioAppInfo } from '../types/studio';

interface InspectorProps {
  projectId: string;
  projectDir: string;
  assetBaseUrl: string;
  storyboard: Storyboard;
  selectedBeat: BeatSpec | null;
  selectedBeatIndex: number;
  assets: ProjectAssetItem[];
  appInfo: StudioAppInfo | null;
  onUpdateBeat: (beatId: string, updater: (beat: BeatSpec) => BeatSpec) => void;
  onMoveBeat: (beatId: string, direction: -1 | 1) => void;
  onDeleteBeat: (beatId: string) => void;
  onUpdateStoryboard: (updater: (sb: Storyboard) => Storyboard) => void;
  onImportAsset: (beatId: string) => void;
  onCopyAgyPrompt: (beat: BeatSpec, customNote: string) => void;
}

const ACCENT_SWATCHES = ['#38bdf8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

const CAMERA_MOVES: Array<{ id: CameraMoveType; label: string }> = [
  { id: 'slow_push_in', label: 'Slow Push In (Đẩy chậm 2.5D)' },
  { id: 'slow_pull_out', label: 'Slow Pull Out (Lùi mở khung)' },
  { id: 'impact_shake', label: 'Impact Shake (Rung chấn Hook)' },
  { id: 'orbit_tilt', label: 'Orbit Tilt (Nghiêng không gian 3D)' },
  { id: 'pan_left', label: 'Pan Left (Lia trái mượt)' },
  { id: 'pan_right', label: 'Pan Right (Lia phải mượt)' },
  { id: 'static', label: 'Static + Organic Drift' },
];

const TRANSITION_OPTIONS: Array<{ id: TransitionType; label: string }> = [
  { id: 'fade', label: 'Fade (Chuyển mờ êm)' },
  { id: 'slide-left', label: 'Slide Left (Trượt ngang)' },
  { id: 'slide-up', label: 'Slide Up (Trượt lên)' },
  { id: 'wipe', label: 'Wipe (Gạt khung)' },
  { id: 'whip-pan', label: 'Whip Pan (Lia nhanh có blur)' },
  { id: 'flash', label: 'Flash (Lóe sáng)' },
  { id: 'glitch', label: 'Glitch (Nhiễu RGB)' },
  { id: 'none', label: 'None (Cắt cứng)' },
];

const CAPTION_STYLE_OPTIONS: Array<{ id: CaptionStyleId; label: string }> = [
  { id: 'glass-dark', label: 'Glass Dark (Tối kính mờ)' },
  { id: 'editorial-light', label: 'Editorial Light (Nền giấy sáng)' },
  { id: 'hormozi-pop', label: 'Hormozi Pop (Chữ lớn viền đậm)' },
  { id: 'karaoke-glow', label: 'Karaoke Glow (Phát sáng theo nhịp)' },
  { id: 'minimal-cinematic', label: 'Minimal Cinematic (Điện ảnh)' },
  { id: 'typewriter-mono', label: 'Typewriter Mono (Kỹ thuật)' },
];

const FALLBACK_PRESETS = [
  { id: 'saas-motion', name: 'SaaS Motion (Glassmorphic UI)' },
  { id: 'explainer-editorial', name: 'Explainer Editorial (Biên tập)' },
  { id: 'shorts-kinetic', name: 'Shorts Kinetic (Tốc độ cao)' },
  { id: 'cinematic-broll', name: 'Cinematic B-Roll (Video/Ảnh điện ảnh)' },
  { id: 'whiteboard-sketch', name: 'Whiteboard Sketch (Vẽ tay Rough.js)' },
  { id: 'tech-3d-data', name: 'Tech 3D & Data (Three.js + Biểu đồ)' },
  { id: 'dialogue-podcast', name: 'Dialogue Podcast (Hội thoại 2 người)' },
];

function isImageAssetPath(relPath: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(relPath);
}

export const Inspector: React.FC<InspectorProps> = ({
  projectId,
  projectDir,
  assetBaseUrl,
  storyboard,
  selectedBeat,
  selectedBeatIndex,
  assets,
  appInfo,
  onUpdateBeat,
  onMoveBeat,
  onDeleteBeat,
  onUpdateStoryboard,
  onImportAsset,
  onCopyAgyPrompt,
}) => {
  const [tab, setTab] = useState<'content' | 'visual' | 'audio'>('content');
  const [agyModalOpen, setAgyModalOpen] = useState(false);
  const [agyNote, setAgyNote] = useState('');

  useEffect(() => {
    if (!agyModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAgyModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [agyModalOpen]);

  if (!selectedBeat) {
    return (
      <aside className="w-[340px] shrink-0 bg-[#161618] border-l border-[#26262a] flex items-center justify-center p-6 text-xs text-zinc-500">
        Chọn một cảnh trên Timeline để chỉnh sửa thuộc tính.
      </aside>
    );
  }

  const beat = selectedBeat;
  const totalBeats = storyboard.beats.length;
  const assetPreviewUrl = beat.asset
    ? `${assetBaseUrl.replace(/\/+$/, '')}/${beat.asset.replace(/^\/+/, '')}`
    : '';

  return (
    <aside className="w-[340px] shrink-0 bg-[#161618] border-l border-[#26262a] flex flex-col overflow-hidden">
      {/* Inspector Header */}
      <div className="px-3.5 py-2.5 border-b border-[#26262a] flex items-center justify-between gap-2 bg-[#111113]">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
              #{String(selectedBeatIndex + 1).padStart(2, '0')}
            </span>
            <span className="text-xs font-semibold text-zinc-100 truncate">
              {beat.title || beat.id}
            </span>
            {beat.customScene && (
              <span className="px-1 py-0.5 rounded-[3px] text-[9px] font-mono bg-[#1c1c1f] text-blue-300 border border-[#323238]">
                TSX
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">{beat.id}</div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            disabled={selectedBeatIndex <= 0}
            onClick={() => onMoveBeat(beat.id, -1)}
            aria-label="Đưa cảnh lên trước"
            className="studio-icon-btn"
            title="Đưa cảnh lên trước"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={selectedBeatIndex >= totalBeats - 1}
            onClick={() => onMoveBeat(beat.id, 1)}
            aria-label="Đưa cảnh xuống sau"
            className="studio-icon-btn"
            title="Đưa cảnh xuống sau"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          {totalBeats > 1 && (
            <button
              type="button"
              onClick={() => onDeleteBeat(beat.id)}
              aria-label="Xóa cảnh này"
              className="studio-icon-btn hover:text-red-400"
              title="Xóa cảnh này"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Inspector Tabs */}
      <div className="p-2 border-b border-[#26262a] bg-[#141416]">
        <div className="grid grid-cols-3 bg-[#111113] border border-[#26262a] rounded-[5px] p-0.5 text-[11px] font-medium">
          {(
            [
              { id: 'content', label: 'Nội dung', icon: FileText },
              { id: 'visual', label: 'Hình ảnh', icon: Palette },
              { id: 'audio', label: 'Âm thanh', icon: Volume2 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`py-1.5 rounded-[4px] flex items-center justify-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-[#232327] text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {tab === 'content' && (
          <>
            <div>
              <label htmlFor="beat-badge" className="studio-label">
                Nhãn mở đầu (Badge)
              </label>
              <input
                id="beat-badge"
                className="studio-input"
                placeholder="HOOK / CHAPTER 01 / CTA..."
                value={beat.badge || ''}
                onChange={(e) => onUpdateBeat(beat.id, (b) => ({ ...b, badge: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="beat-title" className="studio-label">
                Tiêu đề chính
              </label>
              <input
                id="beat-title"
                className="studio-input font-medium"
                value={beat.title || ''}
                onChange={(e) => onUpdateBeat(beat.id, (b) => ({ ...b, title: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="beat-subtitle" className="studio-label">
                Phụ đề mô tả
              </label>
              <textarea
                id="beat-subtitle"
                rows={2}
                className="studio-input resize-none"
                value={beat.subtitle || ''}
                onChange={(e) => onUpdateBeat(beat.id, (b) => ({ ...b, subtitle: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="beat-narration" className="studio-label">
                Lời thoại giọng đọc (Narration)
              </label>
              <textarea
                id="beat-narration"
                rows={4}
                className="studio-input leading-relaxed"
                value={beat.narration || ''}
                onChange={(e) => onUpdateBeat(beat.id, (b) => ({ ...b, narration: e.target.value }))}
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Sau khi sửa lời thoại, bấm Đồng bộ Audio để cập nhật giọng đọc và phụ đề.
              </p>
            </div>

            <div>
              <label htmlFor="beat-keywords" className="studio-label">
                Từ khóa nhấn màu (cách nhau dấu phẩy)
              </label>
              <input
                id="beat-keywords"
                className="studio-input"
                placeholder="60fps, AI, phòng thu"
                value={(beat.keywords || []).join(', ')}
                onChange={(e) =>
                  onUpdateBeat(beat.id, (b) => ({
                    ...b,
                    keywords: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>

            {/* Metrics Editor */}
            <div className="pt-3 border-t border-[#26262a]">
              <div className="flex items-center justify-between mb-2">
                <span className="studio-label mb-0">Số liệu nổi bật</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBeat(beat.id, (b) => ({
                      ...b,
                      metrics: [...(b.metrics || []), { value: '10x', label: 'Tốc độ', delta: '+100%' }],
                    }))
                  }
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Thêm
                </button>
              </div>
              <div className="space-y-1.5">
                {(beat.metrics || []).map((m, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      aria-label={`Giá trị số liệu ${idx + 1}`}
                      className="studio-input col-span-4 py-1 px-2 font-mono font-semibold text-blue-300 tabular-nums"
                      placeholder="60 FPS"
                      value={m.value}
                      onChange={(e) =>
                        onUpdateBeat(beat.id, (b) => ({
                          ...b,
                          metrics: (b.metrics || []).map((item, i) =>
                            i === idx ? { ...item, value: e.target.value } : item
                          ),
                        }))
                      }
                    />
                    <input
                      aria-label={`Nhãn số liệu ${idx + 1}`}
                      className="studio-input col-span-6 py-1 px-2"
                      placeholder="Nhãn chỉ số"
                      value={m.label}
                      onChange={(e) =>
                        onUpdateBeat(beat.id, (b) => ({
                          ...b,
                          metrics: (b.metrics || []).map((item, i) =>
                            i === idx ? { ...item, label: e.target.value } : item
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Xóa số liệu ${idx + 1}`}
                      onClick={() =>
                        onUpdateBeat(beat.id, (b) => ({
                          ...b,
                          metrics: (b.metrics || []).filter((_, i) => i !== idx),
                        }))
                      }
                      className="col-span-2 studio-icon-btn justify-center hover:text-red-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps Editor */}
            <div className="pt-3 border-t border-[#26262a]">
              <div className="flex items-center justify-between mb-2">
                <span className="studio-label mb-0">Danh sách ý / bước</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBeat(beat.id, (b) => ({
                      ...b,
                      steps: [...(b.steps || []), 'Bước mới...'],
                    }))
                  }
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Thêm
                </button>
              </div>
              <div className="space-y-1.5">
                {(beat.steps || []).map((step, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      aria-label={`Bước ${idx + 1}`}
                      className="studio-input py-1 px-2 flex-1"
                      value={step}
                      onChange={(e) =>
                        onUpdateBeat(beat.id, (b) => ({
                          ...b,
                          steps: (b.steps || []).map((s, i) => (i === idx ? e.target.value : s)),
                        }))
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Xóa bước ${idx + 1}`}
                      onClick={() =>
                        onUpdateBeat(beat.id, (b) => ({
                          ...b,
                          steps: (b.steps || []).filter((_, i) => i !== idx),
                        }))
                      }
                      className="studio-icon-btn hover:text-red-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'visual' && (
          <>
            {beat.customScene && (
              <div className="rounded-[5px] bg-[#111113] border border-[#323238] p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" />
                    Custom Scene đang bật
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateBeat(beat.id, (b) => {
                        const next = { ...b };
                        delete next.customScene;
                        return next;
                      })
                    }
                    className="text-[11px] text-zinc-400 hover:text-red-300 underline"
                  >
                    Dùng Preset
                  </button>
                </div>
                <div className="font-mono text-[11px] text-zinc-400 mt-1 truncate">
                  scenes/{beat.customScene}.tsx
                </div>
              </div>
            )}

            <div>
              <label htmlFor="beat-preset" className="studio-label">
                Preset hoạt ảnh 60fps
              </label>
              <select
                id="beat-preset"
                className="studio-input"
                value={beat.preset || 'saas-motion'}
                onChange={(e) =>
                  onUpdateBeat(beat.id, (b) => ({ ...b, preset: e.target.value as PresetId }))
                }
              >
                {(appInfo?.presets && appInfo.presets.length > 0 ? appInfo.presets : FALLBACK_PRESETS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="beat-transition" className="studio-label">
                  Chuyển cảnh vào Beat
                </label>
                <select
                  id="beat-transition"
                  className="studio-input"
                  value={beat.transition || storyboard.defaultTransition || 'fade'}
                  onChange={(e) =>
                    onUpdateBeat(beat.id, (b) => ({
                      ...b,
                      transition: e.target.value as TransitionType,
                    }))
                  }
                >
                  {TRANSITION_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sb-caption-style" className="studio-label">
                  Kiểu phụ đề (Toàn phim)
                </label>
                <select
                  id="sb-caption-style"
                  className="studio-input"
                  value={storyboard.captionStyle || 'glass-dark'}
                  onChange={(e) =>
                    onUpdateStoryboard((sb) => ({
                      ...sb,
                      captionStyle: e.target.value as CaptionStyleId,
                    }))
                  }
                >
                  {CAPTION_STYLE_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="studio-label">Màu nhấn cảnh</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {ACCENT_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Chọn màu ${hex}`}
                    onClick={() => onUpdateBeat(beat.id, (b) => ({ ...b, accentColor: hex }))}
                    style={{ backgroundColor: hex }}
                    className={`w-6 h-6 rounded-[4px] border transition-transform ${
                      (beat.accentColor || storyboard.theme.accentColor) === hex
                        ? 'border-white scale-105'
                        : 'border-black/40 opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Chọn màu nhấn tùy chỉnh"
                  value={beat.accentColor || storyboard.theme.accentColor || '#38bdf8'}
                  onChange={(e) => onUpdateBeat(beat.id, (b) => ({ ...b, accentColor: e.target.value }))}
                  className="w-7 h-6 rounded cursor-pointer bg-transparent border-0"
                />
              </div>
            </div>

            <div>
              <label htmlFor="beat-camera" className="studio-label">
                Chuyển động Camera 2.5D
              </label>
              <select
                id="beat-camera"
                className="studio-input"
                value={beat.cameraMove || 'slow_push_in'}
                onChange={(e) =>
                  onUpdateBeat(beat.id, (b) => ({
                    ...b,
                    cameraMove: e.target.value as CameraMoveType,
                  }))
                }
              >
                {CAMERA_MOVES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 border-t border-[#26262a]">
              <div className="flex items-center justify-between mb-2">
                <span className="studio-label mb-0">Tài nguyên B-Roll / Ảnh</span>
                <button
                  type="button"
                  onClick={() => onImportAsset(beat.id)}
                  className="studio-btn-ghost py-1 px-2 text-[11px]"
                >
                  <Upload className="w-3 h-3 text-zinc-300" />
                  <span>Tải lên</span>
                </button>
              </div>
              <select
                aria-label="Chọn tài nguyên cho cảnh"
                className="studio-input"
                value={beat.asset || ''}
                onChange={(e) =>
                  onUpdateBeat(beat.id, (b) => ({
                    ...b,
                    asset: e.target.value || undefined,
                  }))
                }
              >
                <option value="">Không dùng tài nguyên</option>
                {assets.map((a) => (
                  <option key={a.relPath} value={a.relPath}>
                    {a.name}
                  </option>
                ))}
              </select>

              {beat.asset && (
                <div className="mt-2 rounded-[5px] overflow-hidden border border-[#26262a] bg-[#111113]">
                  {isImageAssetPath(beat.asset) && assetPreviewUrl && (
                    <div className="aspect-video bg-[#0a0a0b] border-b border-[#26262a] overflow-hidden">
                      <img
                        src={assetPreviewUrl}
                        alt={beat.asset}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isImageAssetPath(beat.asset) ? (
                        <ImageIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      ) : (
                        <Film className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      )}
                      <span className="text-[11px] font-mono text-zinc-300 truncate">{beat.asset}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Gỡ tài nguyên khỏi cảnh"
                      onClick={() =>
                        onUpdateBeat(beat.id, (b) => ({
                          ...b,
                          asset: undefined,
                        }))
                      }
                      className="studio-icon-btn p-0.5 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'audio' && (
          <>
            <div>
              <label htmlFor="sb-voice" className="studio-label">
                Giọng đọc toàn dự án (TTS)
              </label>
              <select
                id="sb-voice"
                className="studio-input"
                value={storyboard.voice || 'vi-VN-HoaiMyNeural'}
                onChange={(e) =>
                  onUpdateStoryboard((sb) => ({ ...sb, voice: e.target.value }))
                }
              >
                {(appInfo?.voices || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label || v.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="beat-voice-style" className="studio-label">
                Chỉ đạo cảm xúc giọng đọc (Gemini TTS)
              </label>
              <input
                id="beat-voice-style"
                className="studio-input"
                placeholder="VD: Giọng trầm, dứt khoát như phim tài liệu..."
                value={beat.voiceStyle || ''}
                onChange={(e) =>
                  onUpdateBeat(beat.id, (b) => ({
                    ...b,
                    voiceStyle: e.target.value || undefined,
                  }))
                }
              />
            </div>

            <div>
              <label htmlFor="sb-bgm" className="studio-label">
                Nhạc nền BGM (Sidechain tự động)
              </label>
              <select
                id="sb-bgm"
                className="studio-input"
                value={storyboard.bgm?.track || 'bgm_ambient_tech'}
                onChange={(e) =>
                  onUpdateStoryboard((sb) => ({
                    ...sb,
                    bgm: { track: e.target.value, volume: sb.bgm?.volume ?? 0.16 },
                  }))
                }
              >
                <option value="none">Tắt nhạc nền</option>
                {(appInfo?.bgm || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sb-bgm-vol" className="studio-label tabular-nums">
                Âm lượng nhạc nền ({Math.round((storyboard.bgm?.volume ?? 0.16) * 100)}%)
              </label>
              <input
                id="sb-bgm-vol"
                type="range"
                min={0}
                max={0.4}
                step={0.01}
                value={storyboard.bgm?.volume ?? 0.16}
                onChange={(e) =>
                  onUpdateStoryboard((sb) => ({
                    ...sb,
                    bgm: {
                      track: sb.bgm?.track || 'bgm_ambient_tech',
                      volume: parseFloat(e.target.value),
                    },
                  }))
                }
                className="w-full accent-blue-500"
              />
            </div>

            {/* Per-beat SFX cues */}
            <div className="pt-3 border-t border-[#26262a]">
              <div className="flex items-center justify-between mb-2">
                <span className="studio-label mb-0">Hiệu ứng SFX của cảnh</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBeat(beat.id, (b) => ({
                      ...b,
                      sfx: [...(b.sfx || []), { id: 'whoosh_fast', offsetMs: 0, volume: 0.55 }],
                    }))
                  }
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Thêm SFX
                </button>
              </div>
              <div className="space-y-2">
                {(beat.sfx || []).map((cue, idx) => (
                  <div
                    key={idx}
                    className="rounded-[5px] bg-[#111113] border border-[#26262a] p-2.5 space-y-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label={`Chọn SFX ${idx + 1}`}
                        className="studio-input py-1 flex-1"
                        value={cue.id}
                        onChange={(e) =>
                          onUpdateBeat(beat.id, (b) => ({
                            ...b,
                            sfx: (b.sfx || []).map((c, i) =>
                              i === idx ? { ...c, id: e.target.value } : c
                            ),
                          }))
                        }
                      >
                        {(appInfo?.sfx || []).map((s) => (
                          <option key={s.id} value={s.id}>
                            [{s.layer}] {s.id}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`Xóa SFX ${idx + 1}`}
                        onClick={() =>
                          onUpdateBeat(beat.id, (b) => ({
                            ...b,
                            sfx: (b.sfx || []).filter((_, i) => i !== idx),
                          }))
                        }
                        className="studio-icon-btn hover:text-red-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-zinc-500">Offset (ms)</span>
                        <input
                          type="number"
                          step={50}
                          min={0}
                          aria-label={`Offset ms SFX ${idx + 1}`}
                          className="studio-input py-1 mt-0.5 font-mono tabular-nums"
                          value={cue.offsetMs}
                          onChange={(e) =>
                            onUpdateBeat(beat.id, (b) => ({
                              ...b,
                              sfx: (b.sfx || []).map((c, i) =>
                                i === idx ? { ...c, offsetMs: Math.max(0, Number(e.target.value) || 0) } : c
                              ),
                            }))
                          }
                        />
                      </div>
                      <div>
                        <span className="text-zinc-500 tabular-nums">
                          Volume ({Math.round((cue.volume ?? 0.55) * 100)}%)
                        </span>
                        <input
                          type="range"
                          min={0.1}
                          max={1}
                          step={0.05}
                          aria-label={`Âm lượng SFX ${idx + 1}`}
                          value={cue.volume ?? 0.55}
                          onChange={(e) =>
                            onUpdateBeat(beat.id, (b) => ({
                              ...b,
                              sfx: (b.sfx || []).map((c, i) =>
                                i === idx ? { ...c, volume: parseFloat(e.target.value) } : c
                              ),
                            }))
                          }
                          className="w-full accent-blue-500 mt-2"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Custom Scene Code Bridge Footer */}
      <div className="p-3 border-t border-[#26262a] bg-[#111113]">
        <button
          type="button"
          onClick={() => setAgyModalOpen(true)}
          className="studio-btn-ghost w-full justify-between py-2 px-3"
        >
          <span className="flex items-center gap-2 text-zinc-200">
            <Code2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Custom Scene Code (AGY)</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400 bg-[#111113] border border-[#26262a] px-1.5 py-0.5 rounded-[3px]">
            TSX
          </span>
        </button>
      </div>

      {/* Custom Scene Prompt Modal */}
      {agyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setAgyModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Gửi cảnh ${beat.id} cho AGY`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-lg bg-[#161618] border border-[#26262a] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#26262a] bg-[#111113]">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-[13px] font-semibold text-zinc-100">
                  Chỉnh cảnh "{beat.id}" bằng CustomScene TSX
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAgyModalOpen(false)}
                aria-label="Đóng"
                className="studio-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Mô tả hiệu ứng hoặc bố cục 60fps bạn muốn nâng cấp. Sau khi AGY Studio ghi tệp vào{' '}
                <code className="text-zinc-200 font-mono">scenes/</code>, trình phát sẽ tự động nạp lại.
              </p>
              <div className="rounded-[5px] bg-[#111113] border border-[#26262a] p-2.5 text-[11px] font-mono text-zinc-400 break-all">
                Project: {projectId} · Beat: {beat.id}
                <br />
                Dir: {projectDir}
              </div>
              <div>
                <label htmlFor="agy-custom-note" className="studio-label">
                  Yêu cầu chỉnh sửa
                </label>
                <textarea
                  id="agy-custom-note"
                  rows={4}
                  autoFocus
                  className="studio-input"
                  placeholder="Ví dụ: Tạo biểu đồ tăng trưởng 3 cột theo spring HEAVY_IMPACT, nền lưới 2.5D và highlight số liệu 10x..."
                  value={agyNote}
                  onChange={(e) => setAgyNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#26262a] bg-[#111113]">
              <button
                type="button"
                onClick={() => setAgyModalOpen(false)}
                className="studio-btn-ghost"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  onCopyAgyPrompt(beat, agyNote.trim());
                  setAgyModalOpen(false);
                  setAgyNote('');
                }}
                className="studio-btn-primary"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Copy Prompt cho AGY</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
