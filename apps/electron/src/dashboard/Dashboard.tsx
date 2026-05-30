import { useState, useEffect, type CSSProperties } from 'react';

interface DashboardProps {
  onContinue: () => void;
  onLogout: () => void;
}

type SubStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

interface SubData {
  status: SubStatus;
  plan: 'monthly' | 'lifetime' | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
}

interface PaystackResponse {
  reference: string;
}

interface PaystackHandler {
  openIframe(): void;
}

interface PaystackSetupConfig {
  key: string;
  email: string;
  plan?: string;
  amount?: number;
  ref: string;
  onClose(): void;
  callback(response: PaystackResponse): void;
}

interface PaystackPopInterface {
  setup(config: PaystackSetupConfig): PaystackHandler;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

function getEmailFromJwt(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { email: string };
    return payload.email;
  } catch {
    return '';
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('paystack-inline')) { resolve(); return; }
    const script = document.createElement('script');
    script.id = 'paystack-inline';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.head.appendChild(script);
  });
}

export default function Dashboard({ onContinue, onLogout }: DashboardProps) {
  const [sub, setSub] = useState<SubData | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'lifetime'>('monthly');

  useEffect(() => {
    void (async () => {
      try {
        const token = localStorage.getItem('access_token') || '';
        const deviceId = await window.zoomguru.getDeviceId();
        const res = await fetch(`${API_URL}/subscription/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Device-ID': deviceId,
          },
        });
        if (res.status === 401) { onLogout(); return; }
        if (res.ok) {
          const data = await res.json() as SubData;
          setSub(data);
        }
      } finally {
        setLoadingSub(false);
      }
    })();
  }, []);

  async function handleSubscribe(): Promise<void> {
    const token = localStorage.getItem('access_token') || '';
    const email = getEmailFromJwt(token);
    const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string;
    const isLifetime = selectedPlan === 'lifetime';
    const planCode = isLifetime ? null : (import.meta.env.VITE_PAYSTACK_PLAN_MONTHLY as string);

    if (!pubKey || !email) return;
    if (!isLifetime && !planCode) return;

    setCheckingOut(true);

    try {
      await loadPaystackScript();
    } catch {
      setCheckingOut(false);
      return;
    }

    // PaystackPop has no npm package — injected via script tag at runtime
    const pop = (window as unknown as { PaystackPop: PaystackPopInterface }).PaystackPop;

    const payConfig: PaystackSetupConfig = {
      key: pubKey,
      email,
      ref: `zg_${Date.now()}`,
      onClose: () => {
        setCheckingOut(false);
      },
      callback: (response) => {
        setCheckingOut(false);
        setVerifying(true);
        void (async () => {
          try {
            const deviceId = await window.zoomguru.getDeviceId();
            const res = await fetch(`${API_URL}/subscription/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'X-Device-ID': deviceId,
              },
              body: JSON.stringify({ reference: response.reference }),
            });
            if (res.status === 401) { onLogout(); return; }
            if (!res.ok) return;
            const statusRes = await fetch(`${API_URL}/subscription/status`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Device-ID': deviceId,
              },
            });
            if (statusRes.ok) {
              const data = await statusRes.json() as SubData;
              setSub(data);
            }
          } finally {
            setVerifying(false);
          }
        })();
      },
    };

    if (isLifetime) {
      payConfig.amount = 100_000_000;
    } else {
      payConfig.plan = planCode as string;
    }

    pop.setup(payConfig).openIframe();
  }

  function statusBadgeStyle(): CSSProperties {
    if (sub?.status === 'active') {
      return { ...s.statusBadge, color: 'rgba(52,211,153,0.9)', background: 'rgba(52,211,153,0.12)' };
    }
    if (sub?.status === 'past_due') {
      return { ...s.statusBadge, color: 'rgba(248,113,113,0.9)', background: 'rgba(248,113,113,0.12)' };
    }
    return s.statusBadge;
  }

  function statusLabel(): string {
    if (loadingSub) return 'Loading…';
    if (!sub) return '—';
    if (sub.status === 'active') return 'Active';
    if (sub.status === 'past_due') return 'Payment overdue';
    if (sub.status === 'cancelled') return 'Cancelled';
    return 'No active plan';
  }

  function daysLabel(): string {
    if (loadingSub) return 'Loading…';
    if (!sub || sub.daysRemaining === null) return '—';
    if (sub.plan === 'lifetime') return 'Lifetime';
    if (sub.daysRemaining === 0) return 'Expired';
    return `${sub.daysRemaining} days`;
  }

  function billingLabel(): string {
    if (loadingSub) return 'Loading…';
    if (!sub || !sub.plan) return '—';
    return sub.plan === 'monthly' ? 'Monthly' : 'Lifetime';
  }

  const isSubscribeDisabled = loadingSub || sub?.status === 'active' || checkingOut || verifying;

  function subscribeLabel(): string {
    if (loadingSub) return 'Loading…';
    if (sub?.status === 'active') return 'Active subscription';
    if (verifying) return 'Verifying…';
    if (checkingOut) return 'Opening checkout…';
    return 'Subscribe';
  }

  return (
    <>
      <style>{`
        .zg-primary:hover:not(:disabled) { opacity: 0.90; }
        .zg-primary:active:not(:disabled) { transform: scale(0.98); }
        .zg-ghost:hover { color: rgba(255,255,255,0.45) !important; }
        .zg-close:hover { color: rgba(255,255,255,0.50) !important; }
        .zg-plan:hover { opacity: 0.85; }
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
              <span style={statusBadgeStyle()}>{statusLabel()}</span>
            </div>

            <div style={s.divider} />

            <div style={s.cardRow}>
              <span style={s.cardLabel}>Days remaining</span>
              <span style={s.cardValue}>{daysLabel()}</span>
            </div>

            <div style={s.divider} />

            <div style={s.cardRow}>
              <span style={s.cardLabel}>Billing</span>
              <span style={s.cardValue}>{billingLabel()}</span>
            </div>
          </div>

          {/* Plan selector — hidden when active */}
          {sub?.status !== 'active' && (
            <div style={s.planSelector}>
              <button
                className="zg-plan"
                style={selectedPlan === 'monthly' ? s.planBtnActive : s.planBtn}
                onClick={() => setSelectedPlan('monthly')}
              >
                Monthly
              </button>
              <button
                className="zg-plan"
                style={selectedPlan === 'lifetime' ? s.planBtnActive : s.planBtn}
                onClick={() => setSelectedPlan('lifetime')}
              >
                Lifetime
              </button>
            </div>
          )}

          {/* Subscribe button */}
          <button
            className="zg-primary"
            style={{
              ...s.subscribeBtn,
              ...(isSubscribeDisabled ? s.subscribeBtnDisabled : s.subscribeBtnEnabled),
            }}
            disabled={isSubscribeDisabled}
            onClick={() => { void handleSubscribe(); }}
          >
            {subscribeLabel()}
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
    gap: '16px',
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
  planSelector: {
    display: 'flex',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  planBtn: {
    flex: 1,
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: SANS,
    letterSpacing: '0.1px',
    transition: 'opacity 120ms ease',
    textAlign: 'center',
  },
  planBtnActive: {
    flex: 1,
    padding: '8px',
    background: 'rgba(255,255,255,0.92)',
    border: 'none',
    color: '#07070b',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: SANS,
    letterSpacing: '0.1px',
    transition: 'opacity 120ms ease',
    textAlign: 'center',
  },
  subscribeBtn: {
    width: '100%',
    padding: '11px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: SANS,
    letterSpacing: '0.1px',
    textAlign: 'center',
    transition: 'opacity 120ms ease, transform 100ms ease',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  subscribeBtnEnabled: {
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.80)',
    cursor: 'pointer',
  },
  subscribeBtnDisabled: {
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.28)',
    cursor: 'not-allowed',
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
