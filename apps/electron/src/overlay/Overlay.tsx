import { useState, useEffect, useRef, type CSSProperties } from 'react';
import AnswerStream from './AnswerStream';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FONT  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";
const SESSION_CAP = 40;
const VAD_THRESHOLD = 0.015;
const SILENCE_MS = 1500;
const MIN_SPEECH_MS = 2500;
const MIN_BLOB_BYTES = 25_000;
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

export default function Overlay({ onLogout }: { onLogout: () => void }) {
  // --- state ---
  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [micGranted, setMicGranted] = useState(true);
  const [cvText, setCvText] = useState('');
  const [jdText, setJdText] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isAutoListening, setIsAutoListening] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const sessionCapped = questionCount >= SESSION_CAP;

  // --- refs (manual listen) ---
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const handleListenRef = useRef<() => void>(() => {});
  const handleScreenshotRef = useRef<() => void>(() => {});
  const handleClearRef = useRef<() => void>(() => {});
  const handleAutoRef = useRef<() => void>(() => {});

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
  const startSegmentRef = useRef<() => void>(() => {});
  const processSegmentRef = useRef<(mimeType: string) => Promise<void>>(async () => {});

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
          ...(jdText ? { jdText } : {}),
        }),
      });
      if (response.status === 401) { onLogout(); return; }
      if (response.status === 429) {
        const data = await response.json() as { retryAfter?: number };
        setAnswer(`Rate limited. Try again in ${data.retryAfter ?? 60}s.`);
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
      setAnswer('Connection error. Check backend.');
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
          ...(jdText ? { jdText } : {}),
        }),
      });
      if (response.status === 401) { onLogout(); return; }
      if (response.status === 429) {
        const data = await response.json() as { retryAfter?: number };
        setAnswer(`Rate limited. Try again in ${data.retryAfter ?? 60}s.`);
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
      setAnswer('Connection error. Check backend.');
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

  processSegmentRef.current = async (mimeType: string): Promise<void> => {
    vadStateRef.current = 'processing';
    setIsAutoListening(false);

    const duration = Date.now() - speechStartRef.current;
    const blob = new Blob(autoChunksRef.current, { type: mimeType });

    if (duration < MIN_SPEECH_MS) { vadStateRef.current = 'idle'; return; }
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
      if (res.status === 401) { stopAutoMode(); onLogout(); return; }
      if (!res.ok) { vadStateRef.current = 'idle'; return; }

      const data = await res.json() as { transcript?: string };
      const transcript = data.transcript?.trim() ?? '';

      if (transcript.split(/\s+/).filter(Boolean).length < MIN_WORDS) {
        vadStateRef.current = 'idle';
        return;
      }

      if (questionCountRef.current >= SESSION_CAP) {
        stopAutoMode();
        return;
      }

      await streamAnswer(transcript);

      if (questionCountRef.current >= SESSION_CAP) {
        stopAutoMode();
      }
    } catch {
      // discard failed segments silently in auto mode
    } finally {
      if (vadStateRef.current === 'processing') vadStateRef.current = 'idle';
    }
  };

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
      // Use Electron's desktopCapturer source ID to grab system audio (WASAPI
      // loopback on Windows) without any OS picker dialog. Video is required
      // by the underlying Chrome capture pipeline but discarded immediately.
      const sourceId = await window.zoomguru.getSystemAudioSourceId();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // chromeMediaSource is an Electron/Chrome extension not in DOM types
          mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
        } as unknown as MediaTrackConstraints,
        video: {
          mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
        } as unknown as MediaTrackConstraints,
      });
      stream.getVideoTracks().forEach((t) => t.stop());
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
      setAnswer('Mic access denied. Allow microphone in system settings.');
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
          setAnswer('No audio captured. Speak and try again.');
          return;
        }

        const token = localStorage.getItem('access_token') || '';
        let base64: string;
        let deviceId: string;
        try {
          [base64, deviceId] = await Promise.all([blobToBase64(blob), getCachedDeviceId()]);
        } catch {
          setAnswer('Audio encoding error. Try again.');
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
          if (res.status === 401) { onLogout(); return; }
          if (!res.ok) {
            setAnswer('Transcription failed. Check backend logs.');
            return;
          }
          const data = await res.json() as { transcript?: string };
          if (data.transcript?.trim()) {
            void streamAnswer(data.transcript);
          } else {
            setAnswer('No speech detected. Speak clearly and try again.');
          }
        } catch {
          setAnswer('Transcription error. Check your connection.');
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

  handleAutoRef.current = () => {
    if (isAutoModeRef.current) { stopAutoMode(); } else { void startAutoMode(); }
  };

  // --- mount ---

  useEffect(() => {
    void getCachedDeviceId();

    void window.zoomguru.loadCV().then((stored) => {
      if (stored) setCvText(stored.text);
    });

    void window.zoomguru.loadJD().then((stored) => {
      if (stored) setJdText(stored);
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
    window.zoomguru.onTrigger('auto', () => { void handleAutoRef.current(); });

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

  // --- helpers ---

  const isRec = isListening || isAutoListening;
  const isGen = isStreaming;
  const isAutoOn = isAutoMode && !isAutoListening;

  function fbg(id: string, activeColor?: string): CSSProperties {
    const isH = hovered === id;
    if (activeColor) {
      return { background: isH ? activeColor.replace('0.07', '0.12') : activeColor };
    }
    return { background: isH ? 'rgba(255,255,255,0.05)' : 'transparent' };
  }

  // --- render ---

  return (
    <>
      <style>{`
        @keyframes zg-pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.3 }
        }
        .zg-fbtn:active:not([disabled]) {
          transform: scale(0.96) !important;
        }
        .zg-ibtn:hover {
          background: rgba(255,255,255,0.07) !important;
          color: rgba(255,255,255,0.60) !important;
        }
      `}</style>

      <div style={s.root}>

        {/* ── Header ── */}
        <div style={s.header}>
          <span style={s.wordmark}>ZoomGuru</span>

          <div style={s.headerRight}>
            {/* Status */}
            {isRec && (
              <span style={s.statusRec}>
                <span style={s.recDot} />
                REC
              </span>
            )}
            {isAutoOn && !isGen && (
              <span style={s.statusAuto}>AUTO</span>
            )}
            {isGen && (
              <span style={s.statusGen}>GEN</span>
            )}
            {!micGranted && <span style={s.statusWarn}>no mic</span>}
            {!isOnline && <span style={s.statusWarn}>offline</span>}
            {questionCount > 0 && !sessionCapped && (
              <span style={s.sessionCount}>{questionCount}/{SESSION_CAP}</span>
            )}

            {/* Buttons */}
            <button
              className="zg-ibtn"
              style={s.logoutBtn}
              onClick={() => { stopAutoMode(); onLogout(); }}
              aria-label="Log out"
            >
              Logout
            </button>
            <button
              className="zg-ibtn"
              style={s.iconBtn}
              onClick={() => { void window.zoomguru.quitApp(); }}
              aria-label="Quit"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {sessionCapped ? (
          <div style={s.capNotice}>
            <span style={s.capCount}>40 / 40</span>
            <p style={s.capMessage}>Session complete</p>
            <p style={s.capSub}>Start a new session to continue.</p>
            <button style={s.newSessionBtn} onClick={() => handleClearRef.current()}>
              New Session
            </button>
          </div>
        ) : (
          <AnswerStream answer={answer} isStreaming={isStreaming} />
        )}

        {/* ── Footer ── */}
        <div style={s.footer}>
          <button
            className="zg-fbtn"
            style={{
              ...s.footerBtn,
              ...(isListening
                ? { borderTop: '2px solid #f43f5e', ...fbg('listen', 'rgba(244,63,94,0.07)') }
                : fbg('listen')
              ),
              opacity: isStreaming || sessionCapped || isAutoMode ? 0.35 : 1,
            }}
            onMouseEnter={() => setHovered('listen')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { void handleListenRef.current(); }}
            disabled={isStreaming || sessionCapped || isAutoMode}
            aria-label={isListening ? 'Stop recording' : 'Start listening'}
          >
            <span style={s.btnLabel}>{isListening ? 'Stop' : 'Listen'}</span>
            <span style={s.btnHint}>⌘⇧A</span>
          </button>

          <button
            className="zg-fbtn"
            style={{
              ...s.footerBtn,
              ...fbg('screen'),
              opacity: isStreaming || sessionCapped ? 0.35 : 1,
            }}
            onMouseEnter={() => setHovered('screen')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { void handleScreenshotRef.current(); }}
            disabled={isStreaming || sessionCapped}
            aria-label="Screenshot"
          >
            <span style={s.btnLabel}>Screen</span>
            <span style={s.btnHint}>⌘⇧S</span>
          </button>

          <button
            className="zg-fbtn"
            style={{
              ...s.footerBtn,
              ...(isAutoListening
                ? { borderTop: '2px solid #f43f5e', ...fbg('auto', 'rgba(244,63,94,0.07)') }
                : isAutoMode
                ? { borderTop: '2px solid #10b981', ...fbg('auto', 'rgba(16,185,129,0.07)') }
                : fbg('auto')
              ),
              opacity: sessionCapped ? 0.35 : 1,
            }}
            onMouseEnter={() => setHovered('auto')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { if (isAutoMode) { stopAutoMode(); } else { void startAutoMode(); } }}
            disabled={sessionCapped}
            aria-label={isAutoMode ? 'Stop auto mode' : 'Start auto mode'}
          >
            <span style={s.btnLabel}>{isAutoMode ? 'Auto On' : 'Auto'}</span>
            <span style={s.btnHint}>⌘⇧D</span>
          </button>

          <button
            className="zg-fbtn"
            style={{ ...s.footerBtn, ...fbg('clear'), borderRight: 'none' }}
            onMouseEnter={() => setHovered('clear')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleClearRef.current()}
            aria-label="Clear"
          >
            <span style={s.btnLabel}>{sessionCapped ? 'Reset' : 'Clear'}</span>
            <span style={s.btnHint}>⌘⇧C</span>
          </button>
        </div>

      </div>
    </>
  );
}

const s: Record<string, ElectronStyle> = {
  root: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(7, 7, 11, 0.60)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.07)',
    fontFamily: FONT,
    overflow: 'hidden',
  },

  // Header
  header: {
    height: '40px',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px 0 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    WebkitAppRegion: 'drag',
    flexShrink: 0,
  },
  wordmark: {
    fontSize: '15px',
    fontWeight: 400,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: '0.1px',
    fontFamily: SERIF,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    WebkitAppRegion: 'no-drag',
  },

  // Status labels
  statusRec: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    color: '#f43f5e',
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  recDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#f43f5e',
    display: 'inline-block',
    animation: 'zg-pulse 1.2s ease-in-out infinite',
  },
  statusGen: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    color: '#6366f1',
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  statusAuto: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    color: '#10b981',
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  statusWarn: {
    fontSize: '9px',
    fontWeight: 500,
    letterSpacing: '0.3px',
    color: 'rgba(255,255,255,0.30)',
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  sessionCount: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.18)',
    letterSpacing: '0.3px',
    fontFamily: FONT,
  },

  // Icon buttons (header)
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.25)',
    fontSize: '14px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '3px 5px',
    borderRadius: '4px',
    transition: 'background 120ms ease, color 120ms ease',
    WebkitAppRegion: 'no-drag',
    fontFamily: FONT,
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.28)',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.2px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '3px 6px',
    borderRadius: '4px',
    transition: 'background 120ms ease, color 120ms ease',
    WebkitAppRegion: 'no-drag',
    fontFamily: FONT,
  },

  // Session cap
  capNotice: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '16px',
  },
  capCount: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.14)',
    letterSpacing: '0.5px',
    fontFamily: FONT,
  },
  capMessage: {
    margin: '4px 0 0',
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.60)',
    fontFamily: FONT,
  },
  capSub: {
    margin: '2px 0 16px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.22)',
    fontFamily: FONT,
  },
  newSessionBtn: {
    padding: '8px 22px',
    background: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    color: '#07070b',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
    transition: 'background 120ms ease',
  },

  // Footer
  footer: {
    height: '52px',
    minHeight: '52px',
    display: 'flex',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    WebkitAppRegion: 'no-drag',
    flexShrink: 0,
  },
  footerBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    border: 'none',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    borderTop: '2px solid transparent',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 120ms ease, transform 100ms ease',
    WebkitAppRegion: 'no-drag',
  },
  btnLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: '1',
    fontFamily: FONT,
    letterSpacing: '0.1px',
  },
  btnHint: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.18)',
    lineHeight: '1',
    fontFamily: FONT,
  },
};
