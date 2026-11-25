import React, { useEffect } from 'react';
import { ExternalLink, FolderOpen, X } from 'lucide-react';
import type { StudioProjectSummary } from '../types/studio';

interface VideoPreviewModalProps {
  project: StudioProjectSummary | null;
  onClose: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({ project, onClose }) => {
  useEffect(() => {
    if (!project) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [project, onClose]);

  if (!project || !project.exportUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Xem video ${project.title}`}
    >
      <div
        className="w-full max-w-5xl rounded-lg bg-[#161618] border border-[#26262a] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#26262a] bg-[#111113]">
          <div className="min-w-0 pr-4">
            <div className="text-[13px] font-semibold text-zinc-100 truncate">{project.title}</div>
            <div className="text-[11px] font-mono text-zinc-400 truncate">{project.exportPath}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.agyStudio.openExportsDir()}
              className="studio-btn-ghost"
            >
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              Mở thư mục exports/
            </button>
            {project.exportPath && (
              <button
                type="button"
                onClick={() => window.agyStudio.openExportFile(project.exportPath!)}
                className="studio-btn-ghost"
              >
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                Trình phát mặc định
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ xem trước"
              className="studio-icon-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-[#0a0a0b] flex items-center justify-center p-4 max-h-[76vh]">
          <video
            src={project.exportUrl}
            controls
            autoPlay
            className="max-h-[70vh] max-w-full rounded border border-[#26262a]"
          />
        </div>
      </div>
    </div>
  );
};
