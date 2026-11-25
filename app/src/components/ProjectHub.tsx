import React, { useEffect, useMemo, useState } from 'react';
import {
  Clapperboard,
  Copy,
  Film,
  FolderOpen,
  LayoutGrid,
  List,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import type { AspectRatio, PresetId } from '@agy/motion';
import type { StudioAppInfo, StudioProjectSummary } from '../types/studio';

interface ProjectHubProps {
  projects: StudioProjectSummary[];
  appInfo: StudioAppInfo | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenEditor: (projectId: string) => void;
  onPreviewExport: (project: StudioProjectSummary) => void;
  onOpenSettings: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}

function isProjectRendered(project: StudioProjectSummary): boolean {
  return project.status === 'rendered' && Boolean(project.exportExists);
}

function formatDuration(sec?: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function toSlug(input: string): string {
  const datePrefix = new Date().toISOString().slice(0, 10);
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  return `${datePrefix}_${base || 'video-project'}`;
}

const FALLBACK_PRESETS = [
  { id: 'saas-motion', name: 'SaaS Motion' },
  { id: 'explainer-editorial', name: 'Explainer Editorial' },
  { id: 'shorts-kinetic', name: 'Shorts Kinetic' },
  { id: 'cinematic-broll', name: 'Cinematic B-Roll' },
  { id: 'whiteboard-sketch', name: 'Whiteboard Sketch' },
  { id: 'tech-3d-data', name: 'Tech 3D & Data' },
  { id: 'dialogue-podcast', name: 'Dialogue Podcast' },
];

export const ProjectHub: React.FC<ProjectHubProps> = ({
  projects,
  appInfo,
  loading,
  onRefresh,
  onOpenEditor,
  onPreviewExport,
  onOpenSettings,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'rendered'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [newAspect, setNewAspect] = useState<AspectRatio>('16:9');
  const [newPreset, setNewPreset] = useState<PresetId>('saas-motion');
  const [newVoice, setNewVoice] = useState('vi-VN-HoaiMyNeural');
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<StudioProjectSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null);
        else if (createOpen) setCreateOpen(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [createOpen, deleteTarget]);

  const counts = useMemo(() => {
    const rendered = projects.filter(isProjectRendered).length;
    return {
      all: projects.length,
      draft: projects.length - rendered,
      rendered,
    };
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      const rendered = isProjectRendered(p);
      if (filter === 'rendered' && !rendered) return false;
      if (filter === 'draft' && rendered) return false;
      if (q) {
        return (
          p.title.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.preset || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, filter, search]);

  const resetCreateForm = () => {
    setNewTitle('');
    setNewSlug('');
    setSlugTouched(false);
    setNewAspect('16:9');
    setNewPreset('saas-motion');
    setNewVoice('vi-VN-HoaiMyNeural');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || 'Dự án Video Mới';
    const id = (newSlug.trim() || toSlug(title)).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    setCreating(true);
    try {
      await window.agyStudio.createProject({
        id,
        title,
        aspect: newAspect,
        preset: newPreset,
        voice: newVoice,
      });
      setCreateOpen(false);
      resetCreateForm();
      onRefresh();
      onNotify(`Đã tạo dự án "${title}"`, 'success');
      onOpenEditor(id);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (project: StudioProjectSummary) => {
    try {
      await window.agyStudio.duplicateProject(project.id);
      onRefresh();
      onNotify(`Đã nhân bản "${project.title}"`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await window.agyStudio.deleteProject(deleteTarget.id);
      const removedTitle = deleteTarget.title;
      setDeleteTarget(null);
      onRefresh();
      onNotify(`Đã xóa dự án "${removedTitle}"`, 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const synced = appInfo?.skillSync?.synced;
  const toolchain = appInfo?.toolchain;

  const filterTitle =
    filter === 'all' ? 'Tất cả dự án' : filter === 'draft' ? 'Bản nháp' : 'Đã xuất MP4';

  return (
    <div className="h-full flex bg-[#0d0d0f] overflow-hidden">
      {/* Left Desktop Navigation Sidebar */}
      <aside className="w-[224px] shrink-0 bg-[#111113] border-r border-[#26262a] flex flex-col">
        {/* Brand Header */}
        <div className="h-12 shrink-0 px-3.5 border-b border-[#26262a] flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-[5px] bg-[#1c1c1f] border border-[#323238] flex items-center justify-center shrink-0">
            <Clapperboard className="w-3.5 h-3.5 text-zinc-200 stroke-[1.75]" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-zinc-100 truncate">
            AGY Video Studio
          </span>
        </div>

        {/* Primary Action */}
        <div className="p-3 border-b border-[#26262a]">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="studio-btn-primary w-full justify-center py-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Dự án mới
          </button>
        </div>

        {/* Library Filters */}
        <nav className="flex-1 p-2.5 space-y-4 overflow-y-auto">
          <div className="space-y-0.5">
            <div className="px-2 py-1 text-[11px] font-medium text-zinc-500">Thư viện</div>
            {(
              [
                { id: 'all', label: 'Tất cả dự án', count: counts.all },
                { id: 'draft', label: 'Bản nháp', count: counts.draft },
                { id: 'rendered', label: 'Đã xuất MP4', count: counts.rendered },
              ] as const
            ).map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[5px] text-xs transition-colors duration-100 ${
                    active
                      ? 'bg-[#232327] text-zinc-100 font-medium border border-[#323238]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1c1f] border border-transparent'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-[11px] font-mono tabular-nums text-zinc-500">
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-0.5 pt-2 border-t border-[#26262a]">
            <div className="px-2 py-1 text-[11px] font-medium text-zinc-500">Công cụ</div>
            <button
              type="button"
              onClick={() => window.agyStudio.openExportsDir()}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1c1f] transition-colors duration-100"
            >
              <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
              <span>Thư mục exports/</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1c1f] transition-colors duration-100"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-500" />
              <span>Cài đặt</span>
            </button>
          </div>
        </nav>

        {/* System Status Footer */}
        <div className="shrink-0 p-3 border-t border-[#26262a] bg-[#0e0e10] space-y-2">
          <button
            type="button"
            onClick={onOpenSettings}
            title={appInfo?.skillSync?.appPathJson || ''}
            className="w-full flex items-center justify-between text-[11px] text-zinc-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2 truncate">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  synced ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="truncate">AGY Skill Bridge</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {synced ? 'OK' : 'SYNC'}
            </span>
          </button>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-[#1e1e22]">
            <span className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  toolchain?.python?.available ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              PY
            </span>
            <span className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  toolchain?.ffmpeg?.available ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              FFMPEG
            </span>
            <span className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  toolchain?.gpu?.nvencAvailable ? 'bg-blue-500' : 'bg-zinc-600'
                }`}
              />
              NVENC
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Bar */}
        <header className="h-12 shrink-0 px-5 border-b border-[#26262a] bg-[#111113] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-[13px] font-semibold text-zinc-100 truncate">{filterTitle}</h1>
            <span className="text-xs font-mono tabular-nums text-zinc-500">
              {filtered.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Tìm kiếm dự án"
                className="studio-input pl-8 pr-7 py-1 text-xs"
                placeholder="Tìm tên dự án, slug, preset..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center bg-[#161618] border border-[#26262a] rounded-[5px] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Xem dạng lưới"
                className={`p-1 rounded-[3px] transition-colors ${
                  viewMode === 'grid' ? 'bg-[#232327] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="Xem dạng bảng"
                className={`p-1 rounded-[3px] transition-colors ${
                  viewMode === 'list' ? 'bg-[#232327] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              aria-label="Làm mới danh sách dự án"
              className="studio-btn-ghost py-1.5 px-2"
              title="Làm mới danh sách từ projects/"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-11 h-11 rounded-md bg-[#161618] border border-[#26262a] flex items-center justify-center mb-3.5">
                <Film className="w-5 h-5 text-zinc-400 stroke-[1.5]" />
              </div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {search.trim() ? 'Không tìm thấy dự án phù hợp' : 'Chưa có dự án video nào'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                {search.trim() ? (
                  'Thử thay đổi từ khóa tìm kiếm hoặc chuyển bộ lọc ở thanh bên.'
                ) : (
                  <>
                    Tạo dự án mới trực tiếp hoặc chạy{' '}
                    <code className="px-1.5 py-0.5 rounded bg-[#1c1c1f] border border-[#26262a] text-zinc-200 font-mono text-[11px]">
                      /agy-video-studio
                    </code>{' '}
                    trong AGY Studio để khởi tạo kịch bản tự động.
                  </>
                )}
              </p>
              {!search.trim() && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="studio-btn-primary mt-4 px-4 py-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tạo dự án đầu tiên
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((project) => {
                const rendered = isProjectRendered(project);
                return (
                  <div
                    key={project.id}
                    className="group rounded-lg bg-[#161618] border border-[#26262a] hover:border-[#3f3f46] transition-colors duration-100 overflow-hidden flex flex-col"
                  >
                    {/* Thumbnail Frame */}
                    <div
                      className="relative aspect-video bg-[#0a0a0b] overflow-hidden cursor-pointer border-b border-[#26262a]"
                      onClick={() => onOpenEditor(project.id)}
                    >
                      {project.thumbnailUrl ? (
                        <img
                          src={project.thumbnailUrl}
                          alt={project.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-zinc-600">
                          <Film className="w-6 h-6 stroke-[1.5]" />
                          <span className="text-[10px] font-mono text-zinc-500">
                            {project.preset || 'saas-motion'}
                          </span>
                        </div>
                      )}

                      <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-zinc-200 border border-white/10">
                        {project.aspect === '9:16' ? (
                          <Smartphone className="w-2.5 h-2.5 text-zinc-400" />
                        ) : (
                          <Monitor className="w-2.5 h-2.5 text-zinc-400" />
                        )}
                        {project.aspect}
                      </div>

                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums bg-black/80 text-zinc-200 border border-white/10">
                        {formatDuration(project.durationSec)}
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              rendered ? 'bg-emerald-500' : 'bg-zinc-500'
                            }`}
                            title={rendered ? 'Đã xuất MP4' : 'Bản nháp'}
                          />
                          <h3
                            onClick={() => onOpenEditor(project.id)}
                            className="text-[13px] font-semibold text-zinc-100 truncate hover:text-blue-400 cursor-pointer transition-colors"
                            title={project.title}
                          >
                            {project.title}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono tabular-nums">
                          <span className="truncate max-w-[65%]" title={project.id}>
                            {project.id}
                          </span>
                          <span>{formatDate(project.updatedAt || project.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-2.5 border-t border-[#222226]">
                        <button
                          type="button"
                          onClick={() => onOpenEditor(project.id)}
                          className="flex-1 studio-btn-ghost py-1.5 text-[11px]"
                        >
                          Mở bàn dựng
                        </button>

                        {rendered && (
                          <button
                            type="button"
                            onClick={() => onPreviewExport(project)}
                            aria-label={`Xem MP4 của ${project.title}`}
                            className="studio-icon-btn text-emerald-400 hover:text-emerald-300 border border-[#26262a]"
                            title="Xem MP4 đã xuất"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDuplicate(project)}
                          aria-label={`Nhân bản ${project.title}`}
                          className="studio-icon-btn border border-[#26262a]"
                          title="Nhân bản dự án"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(project)}
                          aria-label={`Xóa ${project.title}`}
                          className="studio-icon-btn border border-[#26262a] hover:text-red-400 hover:border-red-500/40"
                          title="Xóa dự án"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-[#26262a] bg-[#161618] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#26262a] bg-[#111113] text-[11px] font-medium text-zinc-400">
                    <th className="py-2.5 px-4">Dự án</th>
                    <th className="py-2.5 px-3">Khung hình</th>
                    <th className="py-2.5 px-3">Preset</th>
                    <th className="py-2.5 px-3">Thời lượng</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3">Cập nhật</th>
                    <th className="py-2.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222226]">
                  {filtered.map((project) => {
                    const rendered = isProjectRendered(project);
                    return (
                      <tr
                        key={project.id}
                        className="hover:bg-[#1c1c1f] transition-colors duration-75"
                      >
                        <td className="py-2.5 px-4 max-w-[280px]">
                          <button
                            type="button"
                            onClick={() => onOpenEditor(project.id)}
                            className="text-left group block w-full"
                          >
                            <div className="font-medium text-zinc-100 group-hover:text-blue-400 truncate">
                              {project.title}
                            </div>
                            <div className="text-[11px] font-mono text-zinc-500 truncate">
                              {project.id}
                            </div>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-300 tabular-nums">
                          {project.aspect}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-400">
                          {project.preset || 'saas-motion'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-300 tabular-nums">
                          {formatDuration(project.durationSec)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                rendered ? 'bg-emerald-500' : 'bg-zinc-500'
                              }`}
                            />
                            {rendered ? 'Đã xuất' : 'Bản nháp'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-400 tabular-nums">
                          {formatDate(project.updatedAt || project.createdAt)}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenEditor(project.id)}
                              className="studio-btn-ghost py-1 px-2 text-[11px]"
                            >
                              Mở
                            </button>
                            {rendered && (
                              <button
                                type="button"
                                onClick={() => onPreviewExport(project)}
                                aria-label={`Xem MP4 của ${project.title}`}
                                className="studio-icon-btn text-emerald-400"
                                title="Xem MP4"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDuplicate(project)}
                              aria-label={`Nhân bản ${project.title}`}
                              className="studio-icon-btn"
                              title="Nhân bản"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(project)}
                              aria-label={`Xóa ${project.title}`}
                              className="studio-icon-btn hover:text-red-400"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Create Project Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setCreateOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Tạo dự án video mới"
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg bg-[#161618] border border-[#26262a] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#26262a] bg-[#111113]">
              <h2 className="text-[13px] font-semibold text-zinc-100">Tạo dự án video mới</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Đóng hộp thoại tạo dự án"
                className="studio-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div>
                <label htmlFor="new-project-title" className="studio-label">
                  Tên dự án
                </label>
                <input
                  id="new-project-title"
                  required
                  autoFocus
                  className="studio-input"
                  placeholder="Ví dụ: Ra mắt sản phẩm AI 2026"
                  value={newTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewTitle(val);
                    if (!slugTouched) {
                      setNewSlug(toSlug(val));
                    }
                  }}
                />
              </div>

              <div>
                <label htmlFor="new-project-slug" className="studio-label">
                  Thư mục dự án (projects/...)
                </label>
                <input
                  id="new-project-slug"
                  className="studio-input font-mono"
                  placeholder="2026-11-25_ra-mat-san-pham"
                  value={newSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setNewSlug(e.target.value);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="studio-label">Tỷ lệ khung hình</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['16:9', '9:16'] as const).map((asp) => (
                      <button
                        type="button"
                        key={asp}
                        onClick={() => {
                          setNewAspect(asp);
                          if (asp === '9:16') setNewPreset('shorts-kinetic');
                        }}
                        className={`py-1.5 rounded-[5px] text-xs font-mono font-medium border transition-colors ${
                          newAspect === asp
                            ? 'bg-[#2563eb]/20 text-blue-300 border-blue-500/60'
                            : 'bg-[#111113] text-zinc-400 border-[#26262a] hover:border-[#323238]'
                        }`}
                      >
                        {asp}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="new-project-preset" className="studio-label">
                    Preset khởi đầu
                  </label>
                  <select
                    id="new-project-preset"
                    className="studio-input"
                    value={newPreset}
                    onChange={(e) => setNewPreset(e.target.value as PresetId)}
                  >
                    {(appInfo?.presets && appInfo.presets.length > 0
                      ? appInfo.presets
                      : FALLBACK_PRESETS
                    ).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="new-project-voice" className="studio-label">
                  Giọng đọc TTS
                </label>
                <select
                  id="new-project-voice"
                  className="studio-input"
                  value={newVoice}
                  onChange={(e) => setNewVoice(e.target.value)}
                >
                  {(appInfo?.voices || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label || v.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#26262a] bg-[#111113]">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="studio-btn-ghost"
              >
                Hủy
              </button>
              <button type="submit" disabled={creating} className="studio-btn-primary">
                {creating ? 'Đang tạo...' : 'Tạo & Mở bàn dựng'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận xóa dự án"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg bg-[#161618] border border-[#26262a] shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[#26262a] bg-[#111113] flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-zinc-100">Xác nhận xóa dự án</h2>
              <button
                type="button"
                onClick={() => !deleting && setDeleteTarget(null)}
                aria-label="Hủy xóa"
                className="studio-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs text-zinc-300 leading-relaxed">
                Bạn có chắc muốn xóa vĩnh viễn dự án{' '}
                <strong className="text-white">{deleteTarget.title}</strong>?
              </p>
              <div className="text-[11px] font-mono text-zinc-500 bg-[#111113] border border-[#26262a] rounded px-2.5 py-1.5 truncate">
                projects/{deleteTarget.id}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#26262a] bg-[#111113]">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="studio-btn-ghost"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="studio-btn-danger"
              >
                {deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
