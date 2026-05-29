import { useState, type FormEvent, type CSSProperties } from 'react';

interface LoginProps {
  onLogin: (user: any) => void;
}

interface LoginApiResponse {
  accessToken?: string;
  user?: unknown;
  message?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Login({ onLogin }: LoginProps) {
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
        setError(data.message ?? 'Login failed');
        return;
      }
      localStorage.setItem('access_token', data.accessToken ?? '');
      onLogin(data.user);
    } catch {
      setError('Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
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
        <h1 style={s.title}>ZoomGuru</h1>
        <p style={s.subtitle}>Your invisible interview edge</p>
        <form onSubmit={(e) => { void handleSubmit(e); }} style={s.form}>
          <input
            style={s.input}
            type="text"
            placeholder="Email or username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading}
            autoComplete="username"
          />
          <input
            style={s.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
          {error && <p style={s.error}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ ...s.submitBtn, ...(loading ? s.submitDisabled : {}) }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
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
  title: {
    margin: '0 0 6px',
    fontSize: '22px',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: '0 0 24px',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  error: {
    margin: '0',
    fontSize: '12px',
    color: '#ff5c5c',
  },
  submitBtn: {
    width: '100%',
    padding: '11px',
    background: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    borderRadius: '8px',
    color: '#08080e',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  submitDisabled: {
    background: 'rgba(255, 255, 255, 0.25)',
    cursor: 'not-allowed',
  },
};
