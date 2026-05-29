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
});
