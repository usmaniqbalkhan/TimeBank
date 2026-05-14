import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TBLogo, I } from '../lib/icons';

export default function LandingPage() {
  const { configured } = useAuth();

  return (
    <div className="tb-screen tb-landing-screen">
      <div className="tb-status-spacer" />

      {/* mobile-only ambient glows */}
      <div style={{ position: 'absolute', top: 60, right: -100, width: 320, height: 320,
        background: 'radial-gradient(circle, rgba(111,63,245,0.4) 0%, transparent 60%)',
        filter: 'blur(20px)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -100, width: 280, height: 280,
        background: 'radial-gradient(circle, rgba(58,21,154,0.3) 0%, transparent 60%)',
        filter: 'blur(20px)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Mobile-only top brand row */}
      <div className="tb-landing-mobile-brand"
        style={{ position: 'relative', zIndex: 2, padding: '32px 28px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <TBLogo size={36} />
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Timebank</span>
      </div>

      {/* Hero — turns into a 2-col grid on desktop via .tb-landing-hero */}
      <div className="tb-landing-hero" style={{ flex: 1, position: 'relative', zIndex: 2, padding: '0 28px 28px',
        display: 'flex', flexDirection: 'column' }}>

        <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          {/* Mobile-only centered floating logo */}
          <div className="tb-landing-mobile-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -30, background: 'radial-gradient(circle, rgba(111,63,245,0.35) 0%, transparent 70%)', filter: 'blur(12px)', borderRadius: '50%' }} />
              <TBLogo size={120} />
            </div>
          </div>

          <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.04em',
            lineHeight: 0.98, margin: 0, textAlign: 'center' }}>
            Your money.<br />In <span className="ital" style={{ color: 'var(--tb-violet-deep)' }}>four</span> digits.
          </h1>
          <p className="tb-landing-hero__sub" style={{ fontSize: 16, color: 'var(--tb-muted)', lineHeight: 1.45,
            textAlign: 'center', marginTop: 18, padding: '0 12px' }}>
            A campus wallet built around speed and certainty. Settle a coffee, a hostel bill or a split tab in milliseconds.
          </p>

          <div className="tb-landing-cta-row" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
            {!configured ? (
              <div className="tb-banner tb-banner--info" style={{ margin: '0 0 4px' }}>
                Add your Supabase keys in <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>.env</code> before signing in.
              </div>
            ) : null}
            <Link to="/signup" style={{ display: 'block' }}>
              <button className="tb-btn tb-btn--violet">
                Create wallet {I.arrowRight({ width: 16, height: 16 })}
              </button>
            </Link>
            <Link to="/login" style={{ display: 'block' }}>
              <button className="tb-btn tb-btn--ghost">I have an account</button>
            </Link>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--tb-muted)', marginTop: 6 }}>
              By continuing, you agree to our <span style={{ color: 'var(--tb-ink)', fontWeight: 600 }}>Terms</span> and <span style={{ color: 'var(--tb-ink)', fontWeight: 600 }}>Privacy</span>.
            </p>
          </div>
        </div>

        {/* Desktop-only visual: a phone-shaped balance preview */}
        <div className="tb-landing-hero__visual" aria-hidden="true">
          <div className="tb-landing-hero__phone">
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
              Available balance
            </div>
            <div style={{ marginTop: 10, fontSize: 56, fontWeight: 700, letterSpacing: '-0.035em', display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 22, opacity: 0.6, fontWeight: 500 }}>PKR</span>
              12,480
              <span style={{ fontSize: 26, opacity: 0.55, fontWeight: 600 }}>.00</span>
            </div>
            <div style={{ marginTop: 22, display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--tb-green)', boxShadow: '0 0 0 3px rgba(25,192,142,0.25)' }} />
              Code · <span className="mono">0421</span>
            </div>

            <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Send', icon: I.arrowUp() },
                { label: 'Receive', icon: I.arrowDown() },
                { label: 'Scan', icon: I.qr({ width: 18, height: 18 }) },
                { label: 'You', icon: I.user({ width: 18, height: 18 }) },
              ].map((a) => (
                <div key={a.label} style={{
                  background: 'rgba(255,255,255,0.1)', borderRadius: 14,
                  padding: '12px 6px 10px', textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.18)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    {a.icon}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{a.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop-only feature grid */}
      <section className="tb-landing-features">
        <div className="tb-landing-feature">
          <div className="tb-landing-feature__ic">{I.hash({ width: 22, height: 22 })}</div>
          <h3>4-digit codes</h3>
          <p>No account numbers. Each wallet has a four-digit address that's easy to share by voice, text or QR.</p>
        </div>
        <div className="tb-landing-feature">
          <div className="tb-landing-feature__ic">{I.zap()}</div>
          <h3>Instant settlement</h3>
          <p>Transfers commit in under a second on an atomic ledger. No pending state, no double-debits.</p>
        </div>
        <div className="tb-landing-feature">
          <div className="tb-landing-feature__ic">{I.shieldCheck({ width: 22, height: 22 })}</div>
          <h3>Idempotent &amp; safe</h3>
          <p>Every send is locked with an idempotency key. Retries can never duplicate a charge.</p>
        </div>
      </section>

      <div className="tb-home-spacer" />
    </div>
  );
}
