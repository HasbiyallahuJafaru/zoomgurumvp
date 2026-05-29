import { useState, useEffect, useRef, type CSSProperties } from 'react';
import AnswerStream from './AnswerStream';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SESSION_CAP = 40;
const VAD_THRESHOLD = 0.015;
const SILENCE_MS = 1500;
const MIN_SPEECH_MS = 2500;
const MIN_BLOB_BYTES = 15_000;
const MIN_WORDS = 4;

let _deviceId: string | null = null;
async function getCachedDeviceId(): Promise<string> {
  if (!_deviceId) _deviceId = await window.zoomguru.getDeviceId();
  return _deviceId;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Overlay() {
  // --- state ---
  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [micGranted, setMicGranted] = useState(true);
  const [cvText, setCvText] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isAutoListening, setIsAutoListening] = useState(false);

  const sessionCapped = questionCount >= SESSION_CAP;

  // --- refs (manual listen) ---
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const handleListenRef = useRef<() => void>(() => {});
  const handleScreenshotRef = useRef<() => void>(() => {});
  const handleClearRef = useRef<() => void>(() => {});

  // --- refs (auto VAD) ---
  const questionCountRef = useRef(0);
  const isAutoModeRef = useRef(false);
  const vadStateRef = useRef<'idle' | 'recording' | 'processing'>('idle');
  const speechStartRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStreamRef = useRef<MediaStream | null>(null);
  const autoContextRef = useRef<AudioContext | null>(null);
  const autoAnalyserRef = useRef<AnalyserNode | null>(null);
  const autoRecorderRef = useRef<MediaRecorder | null>(null);
  const autoChunksRef = useRef<BlobPart[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Updated each render so callbacks always have fresh cvText + streamAnswer
  const startSegmentRef = useRef<() => void>(() => {});
  const processSegmentRef = useRef<(mimeType: string) => Promise<void>>(async () => {});

  // Keep questionCountRef in sync for use inside async VAD callbacks
  useEffect(() => { questionCountRef.current = questionCount; }, [questionCount]);

  // --- streaming ---

  async function streamAnswer(transcript: string): Promise<void> {
    setAnswer('');
    setIsStreaming(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const deviceId = await getCachedDeviceId();
      const response = await fetch(`${API_URL}/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({
          transcript,
          ...(cvText ? { cvText } : {}),
        }),
      });
      if (response.status === 429) {
        const data = await response.json() as { retryAfter?: number };
        setAnswer(`⚠ Slow down — limit is 3 answers/min. Try again in ${data.retryAfter ?? 60}s.`);
        return;
      }
      setQuestionCount((prev) => prev + 1);
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
      const deviceId = await getCachedDeviceId();
      const response = await fetch(`${API_URL}/ai/screenshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({
          image: imageBase64,
          ...(cvText ? { cvText } : {}),
        }),
      });
      if (response.status === 429) {
        const data = await response.json() as { retryAfter?: number };
        setAnswer(`⚠ Slow down — limit is 3 answers/min. Try again in ${data.retryAfter ?? 60}s.`);
        return;
      }
      setQuestionCount((prev) => prev + 1);
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

  // --- auto VAD ---

  function stopAutoMode(): void {
    isAutoModeRef.current = false;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (autoRecorderRef.current?.state === 'recording') {
      autoRecorderRef.current.stop();
    }
    autoStreamRef.current?.getTracks().forEach((t) => t.stop());
    void autoContextRef.current?.close();
    autoStreamRef.current = null;
    autoContextRef.current = null;
    autoAnalyserRef.current = null;
    autoRecorderRef.current = null;
    vadStateRef.current = 'idle';
    setIsAutoMode(false);
    setIsAutoListening(false);
  }

  // Updated each render — captures latest cvText via streamAnswer closure
  processSegmentRef.current = async (mimeType: string): Promise<void> => {
    vadStateRef.current = 'processing';
    setIsAutoListening(false);

    const duration = Date.now() - speechStartRef.current;
    const blob = new Blob(autoChunksRef.current, { type: mimeType });

    // Gate 1: duration
    if (duration < MIN_SPEECH_MS) { vadStateRef.current = 'idle'; return; }
    // Gate 2: blob size
    if (blob.size < MIN_BLOB_BYTES) { vadStateRef.current = 'idle'; return; }

    try {
      const token = localStorage.getItem('access_token') || '';
      const [base64, deviceId] = await Promise.all([
        blobToBase64(blob),
        getCachedDeviceId(),
      ]);
      const res = await fetch(`${API_URL}/ai/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({ audio: base64 }),
      });
      if (!res.ok) { vadStateRef.current = 'idle'; return; }

      const data = await res.json() as { transcript?: string };
      const transcript = data.transcript?.trim() ?? '';

      // Gate 3: word count
      if (transcript.split(/\s+/).filter(Boolean).length < MIN_WORDS) {
        vadStateRef.current = 'idle';
        return;
      }

      if (questionCountRef.current >= SESSION_CAP) {
        stopAutoMode();
        return;
      }

      await streamAnswer(transcript);

      // Stop auto if session cap hit after this answer
      if (questionCountRef.current >= SESSION_CAP) {
        stopAutoMode();
      }
    } catch {
      // discard failed segments silently in auto mode
    } finally {
      if (vadStateRef.current === 'processing') vadStateRef.current = 'idle';
    }
  };

  // Updated each render — creates recorder with onstop → processSegmentRef.current
  startSegmentRef.current = (): void => {
    if (!autoStreamRef.current) return;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(autoStreamRef.current, { mimeType });
    autoChunksRef.current = [];
    speechStartRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) autoChunksRef.current.push(e.data);
    };
    recorder.onstop = () => { void processSegmentRef.current(mimeType); };

    autoRecorderRef.current = recorder;
    vadStateRef.current = 'recording';
    setIsAutoListening(true);
    recorder.start(100);
  };

  async function startAutoMode(): Promise<void> {
    if (sessionCapped) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicGranted(false);
      return;
    }

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);

    autoStreamRef.current = stream;
    autoContextRef.current = context;
    autoAnalyserRef.current = analyser;
    vadStateRef.current = 'idle';
    isAutoModeRef.current = true;
    setIsAutoMode(true);

    const dataArray = new Uint8Array(analyser.fftSize);

    pollIntervalRef.current = setInterval(() => {
      if (!isAutoModeRef.current || !autoAnalyserRef.current) return;
      if (vadStateRef.current === 'processing') return;

      autoAnalyserRef.current.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sum += norm * norm;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const speaking = rms > VAD_THRESHOLD;

      if (speaking && vadStateRef.current === 'idle') {
        startSegmentRef.current();
      } else if (!speaking && vadStateRef.current === 'recording') {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            if (vadStateRef.current === 'recording') {
              autoRecorderRef.current?.stop();
            }
          }, SILENCE_MS);
        }
      } else if (speaking && vadStateRef.current === 'recording') {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
    }, 80);
  }

  // --- handler refs ---

  handleListenRef.current = async () => {
    if (sessionCapped || isAutoMode) return;
    if (isListening && recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    if (isStreaming) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicGranted(false);
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

        const token = localStorage.getItem('access_token') || '';
        let base64: string;
        let deviceId: string;
        try {
          [base64, deviceId] = await Promise.all([blobToBase64(blob), getCachedDeviceId()]);
        } catch {
          setAnswer('⚠ Audio encoding error. Try again.');
          return;
        }

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
          if (!res.ok) {
            setAnswer('⚠ Transcription failed. Check backend logs.');
            return;
          }
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

    const autoStop = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 30_000);
    recorder.addEventListener('stop', () => clearTimeout(autoStop), { once: true });
  };

  handleScreenshotRef.current = async () => {
    if (sessionCapped) return;
    if (isStreaming) return;
    const imageBase64 = await window.zoomguru.captureScreen();
    await streamScreenshot(imageBase64);
  };

  handleClearRef.current = () => {
    stopAutoMode();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setAnswer('');
    setIsStreaming(false);
    setIsListening(false);
    setQuestionCount(0);
    chunksRef.current = [];
  };

  // --- mount ---

  useEffect(() => {
    void getCachedDeviceId();

    void window.zoomguru.loadCV().then((stored) => {
      if (stored) setCvText(stored.text);
    });

    void window.zoomguru.requestMicPermission().then((osGranted) => {
      if (!osGranted) {
        setMicGranted(false);
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((s) => { s.getTracks().forEach((t) => t.stop()); setMicGranted(true); })
        .catch(() => setMicGranted(false));
    });

    window.zoomguru.onTrigger('listen', () => { void handleListenRef.current(); });
    window.zoomguru.onTrigger('screenshot', () => { void handleScreenshotRef.current(); });
    window.zoomguru.onTrigger('clear', () => handleClearRef.current());

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      stopAutoMode();
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
          {isAutoMode && !isAutoListening && !isStreaming && (
            <span style={s.statusAuto}>◉ Listening</span>
          )}
          {(isListening || isAutoListening) && (
            <span style={s.statusGreen}>● Recording...</span>
          )}
          {isStreaming && <span style={s.statusBlue}>● Thinking...</span>}
          {!micGranted && <span style={s.statusRed}>⚠ Mic denied</span>}
          {!isOnline && <span style={s.statusRed}>⚠ No connection</span>}
          {questionCount > 0 && !sessionCapped && (
            <span style={s.sessionCount}>{questionCount}/{SESSION_CAP}</span>
          )}
          <button
            style={s.closeBtn}
            onClick={() => { void window.zoomguru.quitApp(); }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {sessionCapped ? (
        <div style={s.capNotice}>
          <span style={s.capCount}>40 / 40</span>
          <p style={s.capMessage}>Session limit reached</p>
          <p style={s.capSub}>Start a new session to continue.</p>
          <button style={s.newSessionBtn} onClick={() => handleClearRef.current()}>
            New Session
          </button>
        </div>
      ) : (
        <AnswerStream answer={answer} isStreaming={isStreaming} />
      )}

      <div style={s.footer}>
        <button
          style={{
            ...s.footerBtn,
            ...(isListening ? s.footerBtnRecording : {}),
            opacity: isStreaming || sessionCapped || isAutoMode ? 0.4 : 1,
          }}
          onClick={() => { void handleListenRef.current(); }}
          disabled={isStreaming || sessionCapped || isAutoMode}
          aria-label={isListening ? 'Stop recording' : 'Start listening'}
        >
          <span style={s.footerIcon}>{isListening ? '⏹' : '🎤'}</span>
          <span style={s.footerLabel}>{isListening ? 'Stop' : 'Listen'}</span>
          <span style={s.footerShortcut}>⌘⇧A</span>
        </button>

        <button
          style={{
            ...s.footerBtn,
            opacity: isStreaming || sessionCapped ? 0.4 : 1,
          }}
          onClick={() => { void handleScreenshotRef.current(); }}
          disabled={isStreaming || sessionCapped}
          aria-label="Screenshot"
        >
          <span style={s.footerIcon}>🖥</span>
          <span style={s.footerLabel}>Screen</span>
          <span style={s.footerShortcut}>⌘⇧S</span>
        </button>

        <button
          style={{
            ...s.footerBtn,
            ...(isAutoListening ? s.footerBtnRecording : {}),
            ...(isAutoMode && !isAutoListening ? s.footerBtnAutoOn : {}),
            opacity: sessionCapped ? 0.4 : 1,
          }}
          onClick={() => {
            if (isAutoMode) { stopAutoMode(); } else { void startAutoMode(); }
          }}
          disabled={sessionCapped}
          aria-label={isAutoMode ? 'Stop auto mode' : 'Start auto mode'}
        >
          <span style={s.footerIcon}>{isAutoMode ? '⏹' : '◉'}</span>
          <span style={s.footerLabel}>{isAutoMode ? 'Auto On' : 'Auto'}</span>
          <span style={s.footerShortcut}>⌘⇧D</span>
        </button>

        <button
          style={s.footerBtn}
          onClick={() => handleClearRef.current()}
          aria-label="Clear"
        >
          <span style={s.footerIcon}>✕</span>
          <span style={s.footerLabel}>{sessionCapped ? 'Reset' : 'Clear'}</span>
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
    background: 'rgba(8, 8, 14, 0.82)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
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
  statusAuto: {
    fontSize: '11px',
    color: '#34d399',
    fontFamily: 'system-ui, sans-serif',
  },
  sessionCount: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'system-ui, sans-serif',
    letterSpacing: '0.2px',
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
  capNotice: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '16px',
  },
  capCount: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'system-ui, sans-serif',
    letterSpacing: '0.5px',
  },
  capMessage: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'system-ui, sans-serif',
  },
  capSub: {
    margin: '0 0 12px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'system-ui, sans-serif',
  },
  newSessionBtn: {
    padding: '8px 20px',
    background: 'rgba(255,255,255,0.9)',
    border: 'none',
    borderRadius: '8px',
    color: '#08080e',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
  footer: {
    height: '60px',
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '0 8px 8px',
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
    padding: '6px 12px',
    transition: 'opacity 0.15s ease',
    WebkitAppRegion: 'no-drag',
  },
  footerBtnRecording: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.40)',
  },
  footerBtnAutoOn: {
    background: 'rgba(52, 211, 153, 0.10)',
    border: '1px solid rgba(52, 211, 153, 0.35)',
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
