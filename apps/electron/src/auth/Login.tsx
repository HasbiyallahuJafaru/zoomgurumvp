import { useState, type FormEvent, type CSSProperties } from 'react';

interface LoginProps {
  onLogin: (user: any) => void;
  onShowRegister: () => void;
}

interface LoginApiResponse {
  accessToken?: string;
  user?: unknown;
  message?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

export default function Login({ onLogin, onShowRegister }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const deviceId = await window.zoomguru.getDeviceId();
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({ email: identifier, password }),
      });
      const data: LoginApiResponse = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Invalid credentials');
        return;
      }
      localStorage.setItem('access_token', data.accessToken ?? '');
      onLogin(data.user);
    } catch {
      setError('Cannot reach backend. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .zg-field {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.88);
          font-size: 13px;
          font-family: ${FONT};
          padding: 11px 0;
          outline: none;
          transition: border-color 150ms ease;
          box-sizing: border-box;
        }
        .zg-field:focus {
          border-bottom-color: rgba(255,255,255,0.38);
        }
        .zg-field::placeholder {
          color: rgba(255,255,255,0.20);
        }
        .zg-submit:hover:not(:disabled) {
          background: rgba(255,255,255,1.0) !important;
        }
        .zg-submit:active:not(:disabled) {
          transform: scale(0.98);
        }
        .zg-link:hover {
          color: rgba(255,255,255,0.65) !important;
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
            <span style={s.brandName}>ZoomGuru</span>
            <span style={s.brandTag}>Your invisible interview edge</span>
          </div>

          <form onSubmit={(e) => { void handleSubmit(e); }} style={s.form}>
            <input
              className="zg-field"
              type="text"
              placeholder="Email or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
            <input
              className="zg-field"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />

            {error && <p style={s.error}>{error}</p>}

            <button
              className="zg-submit"
              type="submit"
              disabled={loading}
              style={{ ...s.submitBtn, ...(loading ? s.submitDisabled : {}) }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={s.switchText}>
            No account?{' '}
            <button className="zg-link" style={s.switchLink} onClick={onShowRegister}>
              Sign up
            </button>
          </p>
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
    gap: '32px',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  brandName: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: '-0.3px',
    fontFamily: FONT,
  },
  brandTag: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.28)',
    fontFamily: FONT,
    letterSpacing: '0.1px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  error: {
    margin: '0',
    fontSize: '11px',
    color: '#f43f5e',
    fontFamily: FONT,
    marginTop: '-8px',
  },
  submitBtn: {
    width: '100%',
    padding: '11px',
    marginTop: '4px',
    background: '#ffffff',
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
  submitDisabled: {
    background: 'rgba(255,255,255,0.20)',
    cursor: 'not-allowed',
  },
  switchText: {
    margin: 0,
    fontSize: '11px',
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    fontFamily: FONT,
  },
  switchLink: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: 0,
    transition: 'color 120ms ease',
    fontFamily: FONT,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
};
