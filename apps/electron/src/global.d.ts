interface ZoomGuruBridge {
  onTrigger(event: string, callback: (...args: any[]) => void): void;
  captureScreen(): Promise<string>;
  getDeviceId(): Promise<string>;
  hideWindow(): Promise<void>;
}

declare global {
  interface Window {
    zoomguru: ZoomGuruBridge;
  }
}

export {};
