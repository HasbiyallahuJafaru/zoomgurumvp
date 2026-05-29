import { useState, type CSSProperties } from 'react';

interface CvSetupProps {
  onDone: () => void;
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

export default function CvSetup({ onDone }: CvSetupProps) {
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');

  async function handleUpload(): Promise<void> {
    setError('');
    setUploading(true);
    try {
      const result = await window.zoomguru.parseCV();
      if (!result) return;
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setFilename(result.filename);
    } finally {
      setUploading(false);
    }
  }

  async function handleSkip(): Promise<void> {
    await window.zoomguru.clearCV();
    onDone();
  }

  return (
    <>
      <style>{`
        .zg-primary:hover:not(:disabled) {
          background: rgba(255,255,255,1.0) !important;
        }
        .zg-primary:active:not(:disabled) {
          transform: scale(0.98);
        }
        .zg-ghost:hover {
          color: rgba(255,255,255,0.45) !important;
        }
        .zg-close:hover {
          color: rgba(255,255,255,0.50) !important;
        }
      `}</style>

      <div style={s.root}>
        <button
          className="zg-close"
          style={s.closeBtn}
          onClick={() => { void window.zoomguru.quitApp(); }}
          aria-label="Close"
        >
          ×
        </button>

        <div style={s.content}>
          <div style={s.brand}>
            <span style={s.step}>2 of 2</span>
            <span style={s.title}>Upload your CV</span>
            <span style={s.subtitle}>
              We'll tailor every answer to your background.
            </span>
          </div>

          {filename && (
            <div style={s.fileRow}>
              <span style={s.fileCheck}>✓</span>
              <span style={s.fileName}>{filename}</span>
            </div>
          )}

          {error && <p style={s.error}>{error}</p>}

          <div style={s.actions}>
            {filename ? (
              <button
                className="zg-primary"
                style={s.primaryBtn}
                onClick={onDone}
              >
                Continue →
              </button>
            ) : (
              <button
                className="zg-primary"
                style={{ ...s.primaryBtn, ...(uploading ? s.disabledBtn : {}) }}
                onClick={() => { void handleUpload(); }}
                disabled={uploading}
              >
                {uploading ? 'Opening…' : 'Choose File'}
              </button>
            )}

            {!filename && (
              <button
                className="zg-ghost"
                style={s.ghostBtn}
                onClick={() => { void handleSkip(); }}
              >
                Skip for now
              </button>
            )}
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
    fontFamily: FONT,
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
    fontFamily: FONT,
  },
  content: {
    width: '100%',
    maxWidth: '290px',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  step: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: '-0.3px',
    fontFamily: FONT,
  },
  subtitle: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.28)',
    lineHeight: 1.55,
    fontFamily: FONT,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    paddingBottom: '12px',
  },
  fileCheck: {
    fontSize: '12px',
    color: '#10b981',
    fontFamily: FONT,
  },
  fileName: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: FONT,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  error: {
    margin: 0,
    fontSize: '11px',
    color: '#f43f5e',
    fontFamily: FONT,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  primaryBtn: {
    width: '100%',
    padding: '11px',
    background: 'rgba(255,255,255,0.88)',
    border: 'none',
    borderRadius: '6px',
    color: '#07070b',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
    transition: 'background 120ms ease, transform 100ms ease',
    letterSpacing: '-0.1px',
  },
  disabledBtn: {
    background: 'rgba(255,255,255,0.20)',
    cursor: 'not-allowed',
  },
  ghostBtn: {
    width: '100%',
    padding: '10px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: FONT,
    transition: 'color 120ms ease',
    letterSpacing: '0.1px',
  },
};
