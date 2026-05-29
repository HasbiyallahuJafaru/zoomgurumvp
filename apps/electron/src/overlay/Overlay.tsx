import { useState, useEffect, useRef, type CSSProperties } from 'react';
import AnswerStream from './AnswerStream';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLocal extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLocal) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
}
type SpeechRecognitionCtorType = new () => SpeechRecognitionInstance;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Overlay() {
  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastImage, setLastImage] = useState('');

  const handleListenRef = useRef<() => void>(() => {});
  const handleScreenshotRef = useRef<() => void>(() => {});
  const handleClearRef = useRef<() => void>(() => {});

  // --- streaming ---

  async function streamAnswer(transcript: string): Promise<void> {
    setAnswer('');
    setIsStreaming(true);
    setLastTranscript(transcript);
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
    if (isStreaming || isListening) return;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setAnswer('⚠ Mic access denied. Allow microphone in system settings.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor = ((window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition) as SpeechRecognitionCtorType | undefined;
    if (!SpeechRecognitionCtor) {
      setAnswer('⚠ Speech recognition not available.');
      return;
    }
    setIsListening(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event: SpeechRecognitionEventLocal) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setIsListening(false);
      void streamAnswer(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  handleScreenshotRef.current = async () => {
    if (isStreaming) return;
    const imageBase64 = await window.zoomguru.captureScreen();
    setLastImage(imageBase64);
    await streamScreenshot(imageBase64);
  };

  handleClearRef.current = () => {
    setAnswer('');
    setIsStreaming(false);
    setLastTranscript('');
    setLastImage('');
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

  void lastTranscript;
  void lastImage;

  // --- render ---

  return (
    <div style={s.root}>
      <div style={s.header}>
        <span style={s.headerTitle}>ZoomGuru</span>
        <div style={s.headerRight}>
          {isListening && <span style={s.statusGreen}>● Listening...</span>}
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
        <button
          style={{
            ...s.footerBtn,
            ...(isListening ? s.footerBtnActive : {}),
            opacity: isStreaming || isListening ? 0.4 : 1,
          }}
          onClick={() => { void handleListenRef.current(); }}
          disabled={isStreaming || isListening}
          aria-label="Listen"
        >
          <span style={s.footerIcon}>🎤</span>
          <span style={s.footerLabel}>Listen</span>
          <span style={s.footerShortcut}>⌘⇧A</span>
        </button>

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
  footerBtnActive: {
    background: 'rgba(74, 222, 128, 0.12)',
    border: '1px solid rgba(74, 222, 128, 0.30)',
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
