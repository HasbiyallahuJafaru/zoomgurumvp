import { useState, type FormEvent, type CSSProperties } from 'react';

interface RegisterProps {
  onRegistered: () => void;
  onShowLogin: () => void;
}

interface RegisterApiResponse {
  accessToken?: string;
  message?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

export default function Register({ onRegistered, onShowLogin }: RegisterProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const deviceId = await window.zoomguru.getDeviceId();
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
        body: JSON.stringify({ email, name, password }),
      });
      const data: RegisterApiResponse = await res.json();
      if (!res.ok) { setError(data.message ?? 'Registration failed'); return; }
      localStorage.setItem('access_token', data.accessToken ?? '');
      onRegistered();
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
          font-family: ${SANS};
          padding: 11px 0;
          outline: none;
          text-align: center;
          transition: border-color 150ms ease;
          box-sizing: border-box;
        }
        .zg-field:focus { border-bottom-color: rgba(255,255,255,0.38); }
        .zg-field::placeholder { color: rgba(255,255,255,0.22); }
        .zg-submit:hover:not(:disabled) { opacity: 0.90; }
        .zg-submit:active:not(:disabled) { transform: scale(0.98); }
        .zg-link:hover { color: rgba(255,255,255,0.65) !important; }
        .zg-close:hover { color: rgba(255,255,255,0.50) !important; }
      `}</style>

      <div style={s.root}>
        <button className="zg-close" style={s.closeBtn}
          onClick={() => { void window.zoomguru.quitApp(); }} aria-label="Close">
          ×
        </button>

        <div style={s.content}>
          <div style={s.brand}>
            <span style={s.brandName}>ZoomGuru</span>
            <span style={s.brandTag}>Create your account</span>
          </div>

          <form onSubmit={(e) => { void handleSubmit(e); }} style={s.form}>
            <input className="zg-field" type="text" placeholder="Full name"
              value={name} onChange={(e) => setName(e.target.value)}
              disabled={loading} autoComplete="name" required />
            <input className="zg-field" type="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={loading} autoComplete="email" required />
            <input className="zg-field" type="password" placeholder="Password — 8 characters min"
              value={password} onChange={(e) => setPassword(e.target.value)}
              disabled={loading} autoComplete="new-password" required />

            {error && <p style={s.error}>{error}</p>}

            <button className="zg-submit" type="submit" disabled={loading}
              style={{ ...s.submitBtn, ...(loading ? s.submitDisabled : {}) }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p style={s.switchText}>
            Already have an account?{' '}
            <button className="zg-link" style={s.switchLink} onClick={onShowLogin}>
              Sign in
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
    alignItems: 'center',
    gap: '32px',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '7px',
  },
  brandName: {
    fontSize: '28px',
    fontWeight: 400,
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: '0.2px',
    textAlign: 'center',
  },
  brandTag: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.28)',
    fontFamily: SANS,
    letterSpacing: '0.2px',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  error: {
    margin: 0,
    fontSize: '11px',
    color: '#f43f5e',
    fontFamily: SANS,
    textAlign: 'center',
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
    fontFamily: SANS,
    transition: 'opacity 120ms ease, transform 100ms ease',
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
    fontFamily: SANS,
  },
  switchLink: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: 0,
    transition: 'color 120ms ease',
    fontFamily: SANS,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
};
