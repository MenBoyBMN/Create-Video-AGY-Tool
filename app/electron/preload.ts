import { contextBridge, ipcRenderer } from 'electron';

export interface JobProgressEvent {
  jobId: string;
  stage: string;
  percent: number;
  message: string;
}

export interface ProjectChangedEvent {
  projectId: string;
  changedFile: string;
  detail: Record<string, unknown>;
}

const api = {
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
  syncSkillPath: () => ipcRenderer.invoke('skill:sync'),

  listProjects: () => ipcRenderer.invoke('projects:list'),
  getProject: (projectId: string) => ipcRenderer.invoke('projects:get', projectId),
  watchProject: (projectId: string) => ipcRenderer.invoke('projects:watch', projectId),
  unwatchProject: () => ipcRenderer.invoke('projects:unwatch'),
  createProject: (opts: {
    id: string;
    title: string;
    aspect: '16:9' | '9:16';
    preset: string;
    voice: string;
  }) => ipcRenderer.invoke('projects:create', opts),
  duplicateProject: (projectId: string) => ipcRenderer.invoke('projects:duplicate', projectId),
  deleteProject: (projectId: string) => ipcRenderer.invoke('projects:delete', projectId),
  saveStoryboard: (projectId: string, storyboard: Record<string, unknown>) =>
    ipcRenderer.invoke('projects:saveStoryboard', projectId, storyboard),
  importAsset: (projectId: string) => ipcRenderer.invoke('projects:importAsset', projectId),

  runAudioJob: (jobId: string, projectId: string) =>
    ipcRenderer.invoke('jobs:audio', jobId, projectId),
  runQaJob: (jobId: string, projectId: string) =>
    ipcRenderer.invoke('jobs:qa', jobId, projectId),
  runExportJob: (jobId: string, projectId: string) =>
    ipcRenderer.invoke('jobs:export', jobId, projectId),
  cancelJob: (jobId: string) => ipcRenderer.invoke('jobs:cancel', jobId),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload: { config: Record<string, unknown>; env: Record<string, string> }) =>
    ipcRenderer.invoke('settings:save', payload),

  openExportsDir: () => ipcRenderer.invoke('shell:openExportsDir'),
  openProjectDir: (projectId: string) => ipcRenderer.invoke('shell:openProjectDir', projectId),
  openExportFile: (relPath: string) => ipcRenderer.invoke('shell:openExportFile', relPath),
  copyText: (text: string) => ipcRenderer.invoke('clipboard:write', text),

  onJobProgress: (cb: (ev: JobProgressEvent) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: JobProgressEvent) => cb(data);
    ipcRenderer.on('job:progress', listener);
    return () => ipcRenderer.removeListener('job:progress', listener);
  },

  onProjectChanged: (cb: (ev: ProjectChangedEvent) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: ProjectChangedEvent) => cb(data);
    ipcRenderer.on('project:changed', listener);
    return () => ipcRenderer.removeListener('project:changed', listener);
  },
};

contextBridge.exposeInMainWorld('agyStudio', api);
