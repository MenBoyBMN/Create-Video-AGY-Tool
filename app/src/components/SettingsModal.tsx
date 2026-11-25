import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  KeyRound,
  Link2,
  RefreshCw,
  Save,
  Volume2,
  X,
} from 'lucide-react';
import type { AppSettingsPayload, StudioAppInfo } from '../types/studio';

interface SettingsModalProps {
  open: boolean;
  appInfo: StudioAppInfo | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError?: (msg: string) => void;
}

type SettingsTab = 'audio' | 'render' | 'api' | 'system';

const NAV_ITEMS: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'audio', label: 'Âm thanh mặc định', icon: Volume2 },
  { id: 'render', label: 'Render & GPU', icon: Cpu },
  { id: 'api', label: 'API & Nhà cung cấp', icon: KeyRound },
  { id: 'system', label: 'Hệ thống & Bridge', icon: Link2 },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  appInfo,
  onClose,
  onSaved,
  onError,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<AppSettingsPayload | null>(null);

  const [defaultVoice, setDefaultVoice] = useState('vi-VN-HoaiMyNeural');
  const [speechRate, setSpeechRate] = useState('+0%');
  const [defaultBgmTrack, setDefaultBgmTrack] = useState('bgm_ambient_tech');
  const [defaultBgmVolume, setDefaultBgmVolume] = useState(0.16);
  const [pythonPath, setPythonPath] = useState('python');
  const [ffmpegPath, setFfmpegPath] = useState('ffmpeg');
  const [chromePath, setChromePath] = useState('');

  const [elevenKey, setElevenKey] = useState('');
  const [elevenVoiceId, setElevenVoiceId] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiVoice, setOpenaiVoice] = useState('alloy');

  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-3.8-flash-tts');
  const [pexelsKey, setPexelsKey] = useState('');
  const [pixabayKey, setPixabayKey] = useState('');
  const [vieneuUrl, setVieneuUrl] = useState('');

  const [renderGl, setRenderGl] = useState('angle');
  const [hardwareAcceleration, setHardwareAcceleration] = useState('if-possible');
  const [renderConcurrency, setRenderConcurrency] = useState(3);
  const [wordAligner, setWordAligner] = useState('faster-whisper');
  const [whisperModel, setWhisperModel] = useState('small');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    window.agyStudio
      .getSettings()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setDefaultVoice(res.config.defaultVoice || 'vi-VN-HoaiMyNeural');
        setSpeechRate(res.config.speechRate || '+0%');
        setDefaultBgmTrack(res.config.defaultBgmTrack || 'bgm_ambient_tech');
        setDefaultBgmVolume(res.config.defaultBgmVolume ?? 0.16);
        setPythonPath(res.config.pythonPath || 'python');
        setFfmpegPath(res.config.ffmpegPath || 'ffmpeg');
        setChromePath(res.config.chromePath || '');
        setRenderGl(res.config.renderGl || 'angle');
        setHardwareAcceleration(res.config.hardwareAcceleration || 'if-possible');
        setRenderConcurrency(res.config.renderConcurrency ?? 3);
        setWordAligner(res.config.wordAligner || 'faster-whisper');
        setWhisperModel(res.config.whisperModel || 'small');
        setGeminiModel(res.env.GEMINI_TTS_MODEL || res.config.geminiTtsModel || 'gemini-3.8-flash-tts');
        setGeminiKey(res.env.GEMINI_API_KEY || '');
        setPexelsKey(res.env.PEXELS_API_KEY || '');
        setPixabayKey(res.env.PIXABAY_API_KEY || '');
        setVieneuUrl(res.env.VIENEU_TTS_URL || '');
        setElevenKey(res.env.ELEVENLABS_API_KEY || '');
        setElevenVoiceId(res.env.ELEVENLABS_VOICE_ID || '');
        setOpenaiKey(res.env.OPENAI_API_KEY || '');
        setOpenaiVoice(res.env.OPENAI_TTS_VOICE || 'alloy');
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);
        onError?.(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, onError]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.agyStudio.saveSettings({
        config: {
          defaultVoice,
          speechRate,
          defaultBgmTrack,
          defaultBgmVolume,
          pythonPath,
          ffmpegPath,
          chromePath,
          renderGl,
          hardwareAcceleration,
          renderConcurrency,
          wordAligner,
          whisperModel,
          geminiTtsModel: geminiModel.trim() || 'gemini-3.8-flash-tts',
        },
        env: {
          GEMINI_API_KEY: geminiKey.trim(),
          GEMINI_TTS_MODEL: geminiModel.trim() || 'gemini-3.8-flash-tts',
          PEXELS_API_KEY: pexelsKey.trim(),
          PIXABAY_API_KEY: pixabayKey.trim(),
          VIENEU_TTS_URL: vieneuUrl.trim(),
          ELEVENLABS_API_KEY: elevenKey.trim(),
          ELEVENLABS_VOICE_ID: elevenVoiceId.trim(),
          OPENAI_API_KEY: openaiKey.trim(),
          OPENAI_TTS_VOICE: openaiVoice.trim() || 'alloy',
        },
      });
      onSaved('Đã lưu cài đặt & đồng bộ đường dẫn AGY Skill.');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(msg);
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleResync = async () => {
    try {
      const sync = await window.agyStudio.syncSkillPath();
      setData((prev) => (prev ? { ...prev, skillSync: sync } : prev));
      onSaved('Đã cập nhật lại app-path.json cho AGY Skill.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    }
  };

  const skillSync = data?.skillSync || appInfo?.skillSync;
  const toolchain = appInfo?.toolchain;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt AGY Video Studio"
    >
      <div
        className="w-full max-w-3xl h-[560px] rounded-lg bg-[#161618] border border-[#26262a] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-[#26262a] bg-[#111113]">
          <h2 className="text-[13px] font-semibold text-zinc-100">Tùy chọn & Cấu hình hệ thống</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="studio-icon-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-Pane Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Category Sidebar */}
          <nav className="w-48 shrink-0 bg-[#111113] border-r border-[#26262a] p-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[5px] text-xs font-medium transition-colors duration-100 ${
                    active
                      ? 'bg-[#232327] text-zinc-100 border border-[#323238]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1c1f] border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Form Content */}
          <div className="flex-1 bg-[#161618] p-5 overflow-y-auto">
            {loadError && (
              <div className="mb-4 rounded-[5px] bg-red-950/50 border border-red-500/40 px-3 py-2 text-xs text-red-200">
                {loadError}
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center text-xs text-zinc-400">Đang tải cấu hình...</div>
            ) : (
              <>
                {activeTab === 'audio' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-100">Mặc định Giọng đọc & Nhạc nền</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Áp dụng khi khởi tạo dự án mới từ Desktop App hoặc CLI.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label htmlFor="cfg-default-voice" className="studio-label">
                          Giọng đọc mặc định
                        </label>
                        <select
                          id="cfg-default-voice"
                          className="studio-input"
                          value={defaultVoice}
                          onChange={(e) => setDefaultVoice(e.target.value)}
                        >
                          {(appInfo?.voices || []).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label || v.id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="cfg-speech-rate" className="studio-label">
                          Tốc độ đọc (Edge-TTS)
                        </label>
                        <select
                          id="cfg-speech-rate"
                          className="studio-input"
                          value={speechRate}
                          onChange={(e) => setSpeechRate(e.target.value)}
                        >
                          <option value="-10%">Chậm (-10%)</option>
                          <option value="+0%">Chuẩn (+0%)</option>
                          <option value="+8%">Nhanh nhẹ (+8%)</option>
                          <option value="+15%">Năng động (+15%)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="cfg-bgm-track" className="studio-label">
                          Nhạc nền BGM mặc định
                        </label>
                        <select
                          id="cfg-bgm-track"
                          className="studio-input"
                          value={defaultBgmTrack}
                          onChange={(e) => setDefaultBgmTrack(e.target.value)}
                        >
                          <option value="none">Không nhạc nền</option>
                          {(appInfo?.bgm || []).map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.id} — {b.description}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="cfg-bgm-vol" className="studio-label tabular-nums">
                          Âm lượng BGM mặc định ({Math.round(defaultBgmVolume * 100)}%)
                        </label>
                        <input
                          id="cfg-bgm-vol"
                          type="range"
                          min={0}
                          max={0.4}
                          step={0.01}
                          value={defaultBgmVolume}
                          onChange={(e) => setDefaultBgmVolume(parseFloat(e.target.value))}
                          className="w-full accent-blue-500 mt-2.5"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'render' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-100">Hiệu năng GPU & Đồng bộ phụ đề</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Điều chỉnh WebGL, NVENC và Faster-Whisper theo cấu hình phần cứng máy trạm.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label htmlFor="cfg-render-gl" className="studio-label">
                          Chromium WebGL Backend
                        </label>
                        <select
                          id="cfg-render-gl"
                          className="studio-input"
                          value={renderGl}
                          onChange={(e) => setRenderGl(e.target.value)}
                        >
                          <option value="angle">ANGLE (GPU DirectX — Khuyên dùng)</option>
                          <option value="swiftshader">SwiftShader (CPU Fallback)</option>
                          <option value="default">Mặc định Remotion</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="cfg-hw-accel" className="studio-label">
                          Mã hóa phần cứng (NVENC)
                        </label>
                        <select
                          id="cfg-hw-accel"
                          className="studio-input"
                          value={hardwareAcceleration}
                          onChange={(e) => setHardwareAcceleration(e.target.value)}
                        >
                          <option value="if-possible">Tự động NVENC (if-possible)</option>
                          <option value="disable">Tắt (CPU x264)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="cfg-concurrency" className="studio-label">
                          Số luồng Render (4GB VRAM: 2–4)
                        </label>
                        <input
                          id="cfg-concurrency"
                          type="number"
                          min={1}
                          max={8}
                          className="studio-input font-mono tabular-nums"
                          value={renderConcurrency}
                          onChange={(e) =>
                            setRenderConcurrency(Math.max(1, Math.min(8, Number(e.target.value) || 3)))
                          }
                        />
                      </div>
                      <div>
                        <label htmlFor="cfg-aligner" className="studio-label">
                          Bộ khớp phụ đề từng từ
                        </label>
                        <select
                          id="cfg-aligner"
                          className="studio-input"
                          value={wordAligner}
                          onChange={(e) => setWordAligner(e.target.value)}
                        >
                          <option value="faster-whisper">Faster-Whisper AI (CUDA/CPU)</option>
                          <option value="rms">Acoustic RMS 10ms (Siêu nhẹ)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="cfg-whisper-model" className="studio-label">
                          Model Whisper
                        </label>
                        <select
                          id="cfg-whisper-model"
                          className="studio-input"
                          value={whisperModel}
                          onChange={(e) => setWhisperModel(e.target.value)}
                        >
                          <option value="base">base (Siêu nhanh)</option>
                          <option value="small">small (Cân bằng 4GB VRAM)</option>
                          <option value="medium">medium (Độ chính xác cao)</option>
                        </select>
                      </div>
                      <div>
                        <span className="studio-label">Phần cứng phát hiện</span>
                        <div className="studio-input flex items-center justify-between bg-[#111113] tabular-nums">
                          <span className={toolchain?.gpu?.nvencAvailable ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                            NVENC: {toolchain?.gpu?.nvencAvailable ? 'Sẵn sàng' : 'Không'}
                          </span>
                          <span className={(toolchain?.gpu?.cudaWhisperDevices || 0) > 0 ? 'text-blue-400 font-medium' : 'text-zinc-500'}>
                            CUDA: {toolchain?.gpu?.cudaWhisperDevices || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'api' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-100">API Key cục bộ & Stock Media</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Lưu trực tiếp vào tệp <code className="font-mono text-zinc-300">.env</code> tại thư mục gốc ứng dụng.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                      <div>
                        <label htmlFor="env-gemini-key" className="studio-label">
                          GEMINI_API_KEY
                        </label>
                        <input
                          id="env-gemini-key"
                          type="password"
                          autoComplete="off"
                          className="studio-input font-mono"
                          placeholder="AIza..."
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="env-gemini-model" className="studio-label">
                          GEMINI_TTS_MODEL
                        </label>
                        <input
                          id="env-gemini-model"
                          type="text"
                          className="studio-input font-mono"
                          placeholder="gemini-3.8-flash-tts"
                          value={geminiModel}
                          onChange={(e) => setGeminiModel(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="env-pexels-key" className="studio-label">
                          PEXELS_API_KEY
                        </label>
                        <input
                          id="env-pexels-key"
                          type="password"
                          autoComplete="off"
                          className="studio-input font-mono"
                          placeholder="Tùy chọn..."
                          value={pexelsKey}
                          onChange={(e) => setPexelsKey(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="env-pixabay-key" className="studio-label">
                          PIXABAY_API_KEY
                        </label>
                        <input
                          id="env-pixabay-key"
                          type="password"
                          autoComplete="off"
                          className="studio-input font-mono"
                          placeholder="Tùy chọn..."
                          value={pixabayKey}
                          onChange={(e) => setPixabayKey(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="env-vieneu-url" className="studio-label">
                          VIENEU_TTS_URL (Local VieNeu-TTS Server)
                        </label>
                        <input
                          id="env-vieneu-url"
                          type="text"
                          className="studio-input font-mono"
                          placeholder="http://127.0.0.1:8008"
                          value={vieneuUrl}
                          onChange={(e) => setVieneuUrl(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="env-eleven-key" className="studio-label">
                          ELEVENLABS_API_KEY
                        </label>
                        <input
                          id="env-eleven-key"
                          type="password"
                          autoComplete="off"
                          className="studio-input font-mono"
                          placeholder="sk_..."
                          value={elevenKey}
                          onChange={(e) => setElevenKey(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="env-eleven-voice" className="studio-label">
                          ELEVENLABS_VOICE_ID
                        </label>
                        <input
                          id="env-eleven-voice"
                          type="text"
                          className="studio-input font-mono"
                          placeholder="21m00Tcm4TlvDq8ikWAM"
                          value={elevenVoiceId}
                          onChange={(e) => setElevenVoiceId(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="env-openai-key" className="studio-label">
                          OPENAI_API_KEY
                        </label>
                        <input
                          id="env-openai-key"
                          type="password"
                          autoComplete="off"
                          className="studio-input font-mono"
                          placeholder="sk-..."
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="env-openai-voice" className="studio-label">
                          OPENAI_TTS_VOICE
                        </label>
                        <input
                          id="env-openai-voice"
                          type="text"
                          className="studio-input font-mono"
                          placeholder="alloy / nova / onyx"
                          value={openaiVoice}
                          onChange={(e) => setOpenaiVoice(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'system' && (
                  <div className="space-y-5">
                    <div className="rounded-md border border-[#26262a] bg-[#111113] p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              skillSync?.synced ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span className="text-xs font-semibold text-zinc-100">
                            {skillSync?.synced
                              ? 'AGY Skill Bridge đã đồng bộ'
                              : 'AGY Skill Bridge chưa đồng bộ'}
                          </span>
                          {skillSync?.skillInstalled && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono break-all">
                          Root: {skillSync?.appRoot || appInfo?.appRoot}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono break-all">
                          Bridge: {skillSync?.appPathJson}
                        </div>
                      </div>
                      <button type="button" onClick={handleResync} className="studio-btn-ghost shrink-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Đồng bộ lại
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      <div className="rounded-md bg-[#111113] border border-[#26262a] p-3">
                        <div className="text-[11px] text-zinc-500">Python</div>
                        <div className={`mt-1 font-medium truncate ${toolchain?.python?.available ? 'text-emerald-400' : 'text-red-400'}`}>
                          {toolchain?.python?.available ? toolchain.python.version : 'Chưa tìm thấy'}
                        </div>
                      </div>
                      <div className="rounded-md bg-[#111113] border border-[#26262a] p-3">
                        <div className="text-[11px] text-zinc-500">FFmpeg</div>
                        <div className={`mt-1 font-medium truncate ${toolchain?.ffmpeg?.available ? 'text-emerald-400' : 'text-red-400'}`}>
                          {toolchain?.ffmpeg?.available ? 'Sẵn sàng (-14 LUFS)' : 'Chưa tìm thấy'}
                        </div>
                      </div>
                      <div className="rounded-md bg-[#111113] border border-[#26262a] p-3">
                        <div className="text-[11px] text-zinc-500">Node Engine</div>
                        <div className="mt-1 font-medium text-emerald-400 truncate">
                          {toolchain?.node?.version || 'Built-in'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="cfg-python-path" className="studio-label">
                          Python Executable
                        </label>
                        <input
                          id="cfg-python-path"
                          className="studio-input font-mono"
                          value={pythonPath}
                          onChange={(e) => setPythonPath(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="cfg-ffmpeg-path" className="studio-label">
                          FFmpeg Executable
                        </label>
                        <input
                          id="cfg-ffmpeg-path"
                          className="studio-input font-mono"
                          value={ffmpegPath}
                          onChange={(e) => setFfmpegPath(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="cfg-chrome-path" className="studio-label">
                          Chrome Path (tùy chọn)
                        </label>
                        <input
                          id="cfg-chrome-path"
                          className="studio-input font-mono"
                          placeholder="Auto-detect"
                          value={chromePath}
                          onChange={(e) => setChromePath(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 shrink-0 flex items-center justify-end gap-2 px-4 border-t border-[#26262a] bg-[#111113]">
          <button type="button" onClick={onClose} className="studio-btn-ghost">
            Hủy
          </button>
          <button type="button" onClick={handleSave} disabled={saving || loading} className="studio-btn-primary">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </div>
  );
};
