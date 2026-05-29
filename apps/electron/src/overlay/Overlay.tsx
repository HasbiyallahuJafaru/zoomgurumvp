import { useState, useEffect, useRef, type CSSProperties } from 'react';
import AnswerStream from './AnswerStream';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Overlay() {
  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const handleListenRef = useRef<() => void>(() => {});
  const handleScreenshotRef = useRef<() => void>(() => {});
  const handleClearRef = useRef<() => void>(() => {});

  // --- streaming ---

  async function streamAnswer(transcript: string): Promise<void> {
    setAnswer('');
    setIsStreaming(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const deviceId = await window.zoomguru.getDeviceId();
      const response = await fetch(`${API_URL}/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({ transcript }),
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          const data: { chunk?: string; done?: boolean } = JSON.parse(raw);
          if (data.done) return;
          if (data.chunk) setAnswer((prev) => prev + data.chunk);
        }
      }
    } catch {
      setAnswer('⚠ Connection error. Try again.');
    } finally {
      setIsStreaming(false);
    }
  }

  async function streamScreenshot(imageBase64: string): Promise<void> {
    setAnswer('');
    setIsStreaming(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const deviceId = await window.zoomguru.getDeviceId();
      const response = await fetch(`${API_URL}/ai/screenshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({ image: imageBase64 }),
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          const data: { chunk?: string; done?: boolean } = JSON.parse(raw);
          if (data.done) return;
          if (data.chunk) setAnswer((prev) => prev + data.chunk);
        }
      }
    } catch {
      setAnswer('⚠ Connection error. Try again.');
    } finally {
      setIsStreaming(false);
    }
  }

  // --- handlers (updated every render so refs always hold current state) ---

  handleListenRef.current = async () => {
    // If already recording, stop → triggers onstop → transcription
    if (isListening && recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }

    if (isStreaming) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setAnswer('⚠ Mic access denied. Allow microphone in system settings.');
      return;
    }

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setIsListening(false);

      void (async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setAnswer('⚠ No audio captured. Speak and try again.');
          return;
        }

        let base64: string;
        try {
          base64 = await blobToBase64(blob);
        } catch {
          setAnswer('⚠ Audio encoding error. Try again.');
          return;
        }

        const token = localStorage.getItem('access_token') || '';
        const deviceId = await window.zoomguru.getDeviceId();

        try {
          const res = await fetch(`${API_URL}/ai/transcribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'X-Device-ID': deviceId,
            },
            body: JSON.stringify({ audio: base64 }),
          });
          const data = await res.json() as { transcript?: string };
          if (data.transcript?.trim()) {
            void streamAnswer(data.transcript);
          } else {
            setAnswer('⚠ No speech detected. Speak clearly and try again.');
          }
        } catch {
          setAnswer('⚠ Transcription error. Check your connection.');
        }
      })();
    };

    recorderRef.current = recorder;
    setIsListening(true);
    recorder.start();

    // Safety auto-stop after 30 seconds
    const autoStop = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 30_000);
    recorder.addEventListener('stop', () => clearTimeout(autoStop), { once: true });
  };

  handleScreenshotRef.current = async () => {
    if (isStreaming) return;
    const imageBase64 = await window.zoomguru.captureScreen();
    await streamScreenshot(imageBase64);
  };

  handleClearRef.current = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setAnswer('');
    setIsStreaming(false);
    setIsListening(false);
    chunksRef.current = [];
  };

  // --- mount-only effect ---

  useEffect(() => {
    window.zoomguru.onTrigger('listen', () => { void handleListenRef.current(); });
    window.zoomguru.onTrigger('screenshot', () => { void handleScreenshotRef.current(); });
    window.zoomguru.onTrigger('clear', () => handleClearRef.current());

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // --- render ---

  return (
    <div style={s.root}>
      <div style={s.header}>
        <span style={s.headerTitle}>ZoomGuru</span>
        <div style={s.headerRight}>
          {isListening && <span style={s.statusGreen}>● Recording...</span>}
          {isStreaming && <span style={s.statusBlue}>● Thinking...</span>}
          {!isOnline && <span style={s.statusRed}>⚠ No connection</span>}
          <button
            style={s.closeBtn}
            onClick={() => { void window.zoomguru.hideWindow(); }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <AnswerStream answer={answer} isStreaming={isStreaming} />

      <div style={s.footer}>
        {/* Listen / Stop recording */}
        <button
          style={{
            ...s.footerBtn,
            ...(isListening ? s.footerBtnRecording : {}),
            opacity: isStreaming ? 0.4 : 1,
          }}
          onClick={() => { void handleListenRef.current(); }}
          disabled={isStreaming}
          aria-label={isListening ? 'Stop recording' : 'Start listening'}
        >
          <span style={s.footerIcon}>{isListening ? '⏹' : '🎤'}</span>
          <span style={s.footerLabel}>{isListening ? 'Stop' : 'Listen'}</span>
          <span style={s.footerShortcut}>⌘⇧A</span>
        </button>

        {/* Screenshot */}
        <button
          style={{
            ...s.footerBtn,
            opacity: isStreaming ? 0.4 : 1,
          }}
          onClick={() => { void handleScreenshotRef.current(); }}
          disabled={isStreaming}
          aria-label="Screenshot"
        >
          <span style={s.footerIcon}>🖥</span>
          <span style={s.footerLabel}>Screen</span>
          <span style={s.footerShortcut}>⌘⇧S</span>
        </button>

        {/* Clear */}
        <button
          style={s.footerBtn}
          onClick={() => handleClearRef.current()}
          aria-label="Clear"
        >
          <span style={s.footerIcon}>✕</span>
          <span style={s.footerLabel}>Clear</span>
          <span style={s.footerShortcut}>⌘⇧C</span>
        </button>
      </div>
    </div>
  );
}

const s: Record<string, ElectronStyle> = {
  root: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(8, 8, 14, 0.20)',
    backdropFilter: 'blur(4px)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  header: {
    height: '40px',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    WebkitAppRegion: 'drag',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#ffffff',
    fontFamily: 'system-ui, sans-serif',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    WebkitAppRegion: 'no-drag',
  },
  statusGreen: {
    fontSize: '11px',
    color: '#4ade80',
    fontFamily: 'system-ui, sans-serif',
  },
  statusBlue: {
    fontSize: '11px',
    color: '#60a5fa',
    fontFamily: 'system-ui, sans-serif',
  },
  statusRed: {
    fontSize: '11px',
    color: '#f87171',
    fontFamily: 'system-ui, sans-serif',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '14px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    WebkitAppRegion: 'no-drag',
  },
  footer: {
    height: '60px',
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '0 12px 8px',
    WebkitAppRegion: 'no-drag',
  },
  footerBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    cursor: 'pointer',
    padding: '6px 16px',
    transition: 'opacity 0.15s ease',
    WebkitAppRegion: 'no-drag',
  },
  footerBtnRecording: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.40)',
  },
  footerIcon: {
    fontSize: '14px',
    lineHeight: '1',
  },
  footerLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'system-ui, sans-serif',
    letterSpacing: '0.1px',
  },
  footerShortcut: {
    fontSize: '8px',
    color: 'rgba(255,255,255,0.22)',
    fontFamily: 'system-ui, sans-serif',
    letterSpacing: '0.2px',
  },
};
