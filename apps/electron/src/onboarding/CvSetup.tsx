import { useState, useEffect, type CSSProperties } from 'react';

interface CvSetupProps {
  onDone: () => void;
}

const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

export default function CvSetup({ onDone }: CvSetupProps) {
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState('');
  const [jdText, setJdText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void window.zoomguru.loadCV().then((stored) => {
      if (stored) setFilename(stored.filename);
    });
    void window.zoomguru.loadJD().then((stored) => {
      if (stored) setJdText(stored);
    });
  }, []);

  async function handleUpload(): Promise<void> {
    setError('');
    setUploading(true);
    try {
      const result = await window.zoomguru.parseCV();
      if (!result) return;
      if ('error' in result) { setError(result.error); return; }
      setFilename(result.filename);
    } finally {
      setUploading(false);
    }
  }

  async function handleContinue(): Promise<void> {
    if (jdText.trim()) {
      await window.zoomguru.saveJD(jdText.trim());
    } else {
      await window.zoomguru.clearJD();
    }
    onDone();
  }

  return (
    <>
      <style>{`
        .zg-primary:hover:not(:disabled) { opacity: 0.90; }
        .zg-primary:active:not(:disabled) { transform: scale(0.98); }
        .zg-ghost:hover { color: rgba(255,255,255,0.45) !important; }
        .zg-close:hover { color: rgba(255,255,255,0.50) !important; }
        .zg-jd:focus { outline: none; border-color: rgba(255,255,255,0.18) !important; }
      `}</style>

      <div style={s.root}>
        <button className="zg-close" style={s.closeBtn}
          onClick={() => { void window.zoomguru.quitApp(); }} aria-label="Close">
          ×
        </button>

        <div style={s.content}>
          <div style={s.brand}>
            <span style={s.step}>2 of 2</span>
            <span style={s.title}>Your Context</span>
            <span style={s.subtitle}>
              Tailor every answer to your background and role.
            </span>
          </div>

          {/* CV section */}
          <div style={s.section}>
            <span style={s.sectionLabel}>CV / Resume</span>
            {filename ? (
              <div style={s.fileRow}>
                <span style={s.fileCheck}>✓</span>
                <span style={s.fileName}>{filename}</span>
                <button
                  className="zg-ghost"
                  style={s.changeBtn}
                  onClick={() => { void handleUpload(); }}
                  disabled={uploading}
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                className="zg-primary"
                style={{ ...s.outlineBtn, ...(uploading ? s.disabledBtn : {}) }}
                onClick={() => { void handleUpload(); }}
                disabled={uploading}
              >
                {uploading ? 'Opening…' : 'Choose File'}
              </button>
            )}
          </div>

          {/* Job description section */}
          <div style={s.section}>
            <span style={s.sectionLabel}>Job Description</span>
            <textarea
              className="zg-jd"
              style={s.textarea}
              placeholder="Paste the job description here…"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={5}
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <div style={s.actions}>
            <button className="zg-primary" style={s.primaryBtn} onClick={() => { void handleContinue(); }}>
              Continue →
            </button>
            <button className="zg-ghost" style={s.ghostBtn} onClick={() => {
              void window.zoomguru.clearCV();
              void window.zoomguru.clearJD();
              onDone();
            }}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(7, 7, 11, 0.97)',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: SANS,
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '14px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '18px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '2px 4px',
    transition: 'color 120ms ease',
    fontFamily: SANS,
  },
  content: {
    width: '100%',
    maxWidth: '290px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '20px',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  step: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    color: 'rgba(255,255,255,0.20)',
    textTransform: 'uppercase',
    fontFamily: SANS,
    textAlign: 'center',
  },
  title: {
    fontSize: '26px',
    fontWeight: 400,
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: '0.2px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.28)',
    lineHeight: 1.55,
    fontFamily: SANS,
    textAlign: 'center',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionLabel: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.7px',
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontFamily: SANS,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
  },
  fileCheck: {
    fontSize: '12px',
    color: '#10b981',
    fontFamily: SANS,
    flexShrink: 0,
  },
  fileName: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: SANS,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  changeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.25)',
    fontSize: '10px',
    cursor: 'pointer',
    padding: '0',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    flexShrink: 0,
  },
  outlineBtn: {
    width: '100%',
    padding: '9px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.60)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'opacity 120ms ease, transform 100ms ease',
    textAlign: 'center',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.70)',
    fontSize: '11px',
    fontFamily: SANS,
    lineHeight: 1.55,
    resize: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 120ms ease',
  },
  error: {
    margin: 0,
    fontSize: '11px',
    color: '#f43f5e',
    fontFamily: SANS,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    padding: '11px',
    background: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    color: '#07070b',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'opacity 120ms ease, transform 100ms ease',
    letterSpacing: '-0.1px',
    textAlign: 'center',
  },
  disabledBtn: {
    background: 'rgba(255,255,255,0.20)',
    cursor: 'not-allowed',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  ghostBtn: {
    width: '100%',
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    letterSpacing: '0.1px',
    textAlign: 'center' as const,
  },
};
