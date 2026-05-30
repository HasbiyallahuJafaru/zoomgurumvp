interface CvResult {
  text: string;
  filename: string;
}

interface CvError {
  error: string;
}

interface ZoomGuruBridge {
  onTrigger(event: string, callback: (...args: any[]) => void): void;
  captureScreen(): Promise<string>;
  getDeviceId(): Promise<string>;
  hideWindow(): Promise<void>;
  quitApp(): Promise<void>;
  requestMicPermission(): Promise<boolean>;
  parseCV(): Promise<CvResult | CvError | null>;
  loadCV(): Promise<CvResult | null>;
  clearCV(): Promise<void>;
  getSystemAudioSourceId(): Promise<string>;
  saveJD(text: string): Promise<void>;
  loadJD(): Promise<string | null>;
  clearJD(): Promise<void>;
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    zoomguru: ZoomGuruBridge;
  }
}

export {};
