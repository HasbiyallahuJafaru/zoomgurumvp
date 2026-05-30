import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('zoomguru', {
  onTrigger: (event: string, callback: (...args: any[]) => void): void => {
    const channel = `trigger:${event}`;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, ...args) => callback(...args));
  },

  captureScreen: (): Promise<string> =>
    ipcRenderer.invoke('capture:screen'),

  getDeviceId: (): Promise<string> =>
    ipcRenderer.invoke('device:fingerprint'),

  hideWindow: (): Promise<void> =>
    ipcRenderer.invoke('window:hide'),

  quitApp: (): Promise<void> =>
    ipcRenderer.invoke('window:quit'),

  requestMicPermission: (): Promise<boolean> =>
    ipcRenderer.invoke('permissions:request-mic'),

  parseCV: (): Promise<{ text: string; filename: string } | { error: string } | null> =>
    ipcRenderer.invoke('cv:parse'),

  loadCV: (): Promise<{ text: string; filename: string } | null> =>
    ipcRenderer.invoke('cv:load'),

  clearCV: (): Promise<void> =>
    ipcRenderer.invoke('cv:clear'),

  getSystemAudioSourceId: (): Promise<string> =>
    ipcRenderer.invoke('capture:audio-source-id'),

  saveJD: (text: string): Promise<void> =>
    ipcRenderer.invoke('jd:save', text),

  loadJD: (): Promise<string | null> =>
    ipcRenderer.invoke('jd:load'),

  clearJD: (): Promise<void> =>
    ipcRenderer.invoke('jd:clear'),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('open-external', url),
});
