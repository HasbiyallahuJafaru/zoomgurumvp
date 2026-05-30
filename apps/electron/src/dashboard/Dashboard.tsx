import { type CSSProperties } from 'react';

interface DashboardProps {
  onContinue: () => void;
  onLogout: () => void;
}

const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

export default function Dashboard({ onContinue, onLogout }: DashboardProps) {
  return (
    <>
      <style>{`
        .zg-primary:hover:not(:disabled) { opacity: 0.90; }
        .zg-primary:active:not(:disabled) { transform: scale(0.98); }
        .zg-ghost:hover { color: rgba(255,255,255,0.45) !important; }
        .zg-close:hover { color: rgba(255,255,255,0.50) !important; }
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
          {/* Wordmark */}
          <div style={s.brand}>
            <span style={s.brandName}>ZoomGuru</span>
            <span style={s.brandTag}>Your invisible interview edge</span>
          </div>

          {/* Subscription card */}
          <div style={s.card}>
            <div style={s.cardRow}>
              <span style={s.cardLabel}>Status</span>
              <span style={s.statusBadge}>No active plan</span>
            </div>

            <div style={s.divider} />

            <div style={s.cardRow}>
              <span style={s.cardLabel}>Days remaining</span>
              <span style={s.cardValue}>—</span>
            </div>

            <div style={s.divider} />

            <div style={s.cardRow}>
              <span style={s.cardLabel}>Billing</span>
              <span style={s.cardValue}>Monthly / Annual</span>
            </div>
          </div>

          {/* Subscribe button — payment provider not yet wired */}
          <button className="zg-primary" style={s.subscribeBtn} disabled>
            Subscribe — Coming soon
          </button>

          {/* Continue to app */}
          <div style={s.actions}>
            <button
              className="zg-primary"
              style={s.continueBtn}
              onClick={onContinue}
            >
              Continue →
            </button>
            <button
              className="zg-ghost"
              style={s.logoutBtn}
              onClick={onLogout}
            >
              Log out
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
    gap: '7px',
    marginBottom: '4px',
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
  card: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 14px',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
  },
  cardLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.30)',
    fontFamily: SANS,
    letterSpacing: '0.1px',
  },
  cardValue: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: SANS,
  },
  statusBadge: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.2px',
    color: 'rgba(255,255,255,0.28)',
    background: 'rgba(255,255,255,0.06)',
    padding: '3px 8px',
    borderRadius: '4px',
    fontFamily: SANS,
  },
  subscribeBtn: {
    width: '100%',
    padding: '11px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.28)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'not-allowed',
    fontFamily: SANS,
    letterSpacing: '0.1px',
    textAlign: 'center',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  continueBtn: {
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
  logoutBtn: {
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
