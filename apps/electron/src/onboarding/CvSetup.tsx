import { useState, type CSSProperties } from 'react';

interface CvSetupProps {
  onDone: () => void;
}

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
    <div style={s.root}>
      <button
        style={s.closeBtn}
        onClick={() => { void window.zoomguru.quitApp(); }}
        aria-label="Close"
      >
        ✕
      </button>

      <div style={s.card}>
        <p style={s.eyebrow}>Setup</p>
        <h1 style={s.title}>Upload your CV</h1>
        <p style={s.subtitle}>
          We'll tailor every answer to your background and experience.
        </p>

        {filename ? (
          <div style={s.successBlock}>
            <span style={s.successIcon}>✓</span>
            <span style={s.successName}>{filename}</span>
          </div>
        ) : null}

        {error ? <p style={s.errorText}>{error}</p> : null}

        <div style={s.actions}>
          {filename ? (
            <button style={s.primaryBtn} onClick={onDone}>
              Continue →
            </button>
          ) : (
            <button
              style={{ ...s.primaryBtn, ...(uploading ? s.disabledBtn : {}) }}
              onClick={() => { void handleUpload(); }}
              disabled={uploading}
            >
              {uploading ? 'Opening…' : 'Upload CV'}
            </button>
          )}

          {!filename && (
            <button style={s.skipBtn} onClick={() => { void handleSkip(); }}>
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(8, 8, 14, 0.97)',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: '16px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  card: {
    width: '100%',
    maxWidth: '360px',
    padding: '32px 24px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    boxSizing: 'border-box',
  },
  eyebrow: {
    margin: '0 0 8px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    color: 'rgba(255, 255, 255, 0.3)',
    fontFamily: 'system-ui, sans-serif',
  },
  title: {
    margin: '0 0 6px',
    fontSize: '22px',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.3px',
    fontFamily: 'system-ui, sans-serif',
  },
  subtitle: {
    margin: '0 0 24px',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.4)',
    lineHeight: 1.5,
    fontFamily: 'system-ui, sans-serif',
  },
  successBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: 'rgba(74, 222, 128, 0.08)',
    border: '1px solid rgba(74, 222, 128, 0.2)',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  successIcon: {
    fontSize: '13px',
    color: '#4ade80',
  },
  successName: {
    fontSize: '12px',
    color: '#4ade80',
    fontFamily: 'system-ui, sans-serif',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  errorText: {
    margin: '0 0 12px',
    fontSize: '12px',
    color: '#f87171',
    fontFamily: 'system-ui, sans-serif',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  primaryBtn: {
    width: '100%',
    padding: '11px',
    background: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    borderRadius: '8px',
    color: '#08080e',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
  disabledBtn: {
    background: 'rgba(255, 255, 255, 0.25)',
    cursor: 'not-allowed',
  },
  skipBtn: {
    width: '100%',
    padding: '10px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
};
