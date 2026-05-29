interface ZoomGuruBridge {
  onTrigger(event: string, callback: (...args: any[]) => void): void;
  captureScreen(): Promise<string>;
  getDeviceId(): Promise<string>;
  hideWindow(): Promise<void>;
  requestMicPermission(): Promise<boolean>;
}

declare global {
  interface Window {
    zoomguru: ZoomGuruBridge;
  }
}

export {};
