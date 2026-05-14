import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TBLogo, I } from '../lib/icons';

export default function LandingPage() {
  const { configured } = useAuth();

  return (
    <div className="tb-screen">
      <div className="tb-status-spacer" />

      <div style={{ position: 'absolute', top: 60, right: -100, width: 320, height: 320,
        background: 'radial-gradient(circle, rgba(111,63,245,0.4) 0%, transparent 60%)',
        filter: 'blur(20px)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -100, width: 280, height: 280,
        background: 'radial-gradient(circle, rgba(58,21,154,0.3) 0%, transparent 60%)',
        filter: 'blur(20px)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ flex: 1, position: 'relative', zIndex: 2, padding: '32px 28px',
        display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TBLogo size={36} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Timebank</span>
        </div>

        <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -30, background: 'radial-gradient(circle, rgba(111,63,245,0.35) 0%, transparent 70%)', filter: 'blur(12px)', borderRadius: '50%' }} />
              <TBLogo size={120} />
            </div>
          </div>

          <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.04em',
            lineHeight: 0.98, margin: 0, textAlign: 'center' }}>
            Your money.<br />In <span className="ital" style={{ color: 'var(--tb-violet-deep)' }}>four</span> digits.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--tb-muted)', lineHeight: 1.45,
            textAlign: 'center', marginTop: 18, padding: '0 12px' }}>
            A campus wallet built around speed and certainty. Settle a coffee, a hostel bill or a split tab in milliseconds.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

      <div className="tb-home-spacer" />
    </div>
  );
}
