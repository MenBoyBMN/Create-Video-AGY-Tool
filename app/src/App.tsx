import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Terminal, X } from 'lucide-react';
import type { StudioAppInfo, StudioProjectSummary } from './types/studio';
import { ProjectHub } from './components/ProjectHub';
import { StudioEditor } from './components/StudioEditor';
import { SettingsModal } from './components/SettingsModal';
import { VideoPreviewModal } from './components/VideoPreviewModal';

interface ToastState {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

export const App: React.FC = () => {
  const toastTimerRef = useRef<number | null>(null);
  const [appInfo, setAppInfo] = useState<StudioAppInfo | null>(null);
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewProject, setPreviewProject] = useState<StudioProjectSummary | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const hasBridge = typeof window !== 'undefined' && Boolean(window.agyStudio);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const notify = useCallback((message: string, tone: 'info' | 'success' | 'error' = 'info') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    const id = Date.now();
    setToast({ id, message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev && prev.id === id ? null : prev));
      toastTimerRef.current = null;
    }, 4200);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!hasBridge) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [info, list] = await Promise.all([
        window.agyStudio.getInfo(),
        window.agyStudio.listProjects(),
      ]);
      setAppInfo(info);
      setProjects(list);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [hasBridge, notify]);

  useEffect(() => {
    refreshAll();
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [refreshAll]);

  if (!hasBridge) {
    return (
      <div className="h-screen w-screen bg-[#111113] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg bg-[#161618] border border-[#26262a] p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-zinc-100 font-semibold text-sm">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span>Môi trường Electron Bridge chưa sẵn sàng</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Ứng dụng desktop yêu cầu chạy thông qua Electron (<code className="font-mono text-zinc-200">npm run dev</code> hoặc file thực thi đóng gói) để truy cập hệ thống tệp cục bộ, FFmpeg và Remotion Renderer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#111113] text-zinc-100">
      {activeProjectId ? (
        <StudioEditor
          projectId={activeProjectId}
          appInfo={appInfo}
          onBack={() => {
            setActiveProjectId(null);
            refreshAll();
          }}
          onNotify={notify}
        />
      ) : (
        <ProjectHub
          projects={projects}
          appInfo={appInfo}
          loading={loading}
          onRefresh={refreshAll}
          onOpenEditor={(id) => setActiveProjectId(id)}
          onPreviewExport={(proj) => setPreviewProject(proj)}
          onOpenSettings={() => setSettingsOpen(true)}
          onNotify={notify}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        appInfo={appInfo}
        onClose={() => setSettingsOpen(false)}
        onSaved={(msg) => {
          notify(msg, 'success');
          refreshAll();
        }}
        onError={(msg) => notify(msg, 'error')}
      />

      <VideoPreviewModal
        project={previewProject}
        onClose={() => setPreviewProject(null)}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[100] max-w-sm"
        >
          <div className="flex items-center gap-2.5 pl-3 pr-2.5 py-2.5 rounded-md bg-[#1c1c1f] border border-[#323238] shadow-2xl text-xs text-zinc-100 relative overflow-hidden">
            <span
              className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                toast.tone === 'success'
                  ? 'bg-emerald-500'
                  : toast.tone === 'error'
                    ? 'bg-red-500'
                    : 'bg-blue-500'
              }`}
            />
            {toast.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span className="leading-snug flex-1 font-medium">{toast.message}</span>
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Đóng thông báo"
              className="studio-icon-btn p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
