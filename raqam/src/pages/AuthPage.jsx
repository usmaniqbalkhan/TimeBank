import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TBLogo, I } from '../lib/icons';

export default function AuthPage({ type }) {
  const { authLoading, configured, login, signup } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(type === 'login' ? 'login' : 'signup');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      if (tab === 'signup') {
        await signup({ name: form.name, email: form.email, password: form.password });
      } else {
        await login(form.email, form.password);
      }
      navigate('/wallet');
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function switchTab(nextTab) {
    setTab(nextTab);
    setError('');
    navigate(nextTab === 'signup' ? '/signup' : '/login', { replace: true });
  }

  return (
    <div className="tb-screen">
      <div className="tb-status-spacer" />

      <div className="tb-app-bar">
        <Link to="/" className="tb-back">{I.arrowLeft()}</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TBLogo size={22} />
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>Timebank</span>
        </div>
        <div style={{ width: 40 }} />
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        <div className="tb-tabs">
          <button type="button" className={tab === 'signup' ? 'on' : ''} onClick={() => switchTab('signup')}>Create wallet</button>
          <button type="button" className={tab === 'login' ? 'on' : ''} onClick={() => switchTab('login')}>Log in</button>
        </div>

        <div style={{ marginTop: 4 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, margin: 0 }}>
            {tab === 'signup'
              ? <>Welcome.<br/>Let's get you a <span className="ital" style={{ color: 'var(--tb-violet-deep)' }}>code</span>.</>
              : <>Welcome <span className="ital" style={{ color: 'var(--tb-violet-deep)' }}>back</span>.</>}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--tb-muted)', marginTop: 8 }}>
            {tab === 'signup'
              ? 'A 4-digit identity, a fresh wallet and a live QR — all in under 20 seconds.'
              : 'Sign in to your wallet to send, receive, and review your activity.'}
          </p>
        </div>

        {!configured ? (
          <div className="tb-banner tb-banner--error" style={{ margin: 0 }}>
            Supabase keys are missing. Add <code className="mono">VITE_SUPABASE_URL</code> and <code className="mono">VITE_SUPABASE_ANON_KEY</code> in <code className="mono">.env</code>.
          </div>
        ) : null}

        {error ? <div className="tb-banner tb-banner--error" style={{ margin: 0 }}>{error}</div> : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tab === 'signup' && (
            <div>
              <label className="tb-input-label">Full name</label>
              <input
                className="tb-input"
                name="name"
                placeholder="Farha Ahmed"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
          )}
          <div>
            <label className="tb-input-label">Student email</label>
            <input
              className="tb-input"
              type="email"
              name="email"
              placeholder="you@campus.edu.pk"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="tb-input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="tb-input"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={handleChange}
                minLength="6"
                required
                style={{ paddingRight: 50 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--tb-muted)', padding: 6
                }}
              >
                {I.eye()}
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'signup' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: 'var(--tb-violet-soft)', borderRadius: 14, fontSize: 12, color: 'var(--tb-violet-deep)' }}>
              <span style={{ flex: '0 0 22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{I.shieldCheck({ width: 16, height: 16 })}</span>
              <span style={{ fontWeight: 500, lineHeight: 1.4 }}>
                Your wallet, 4-digit code and active QR are provisioned automatically.
              </span>
            </div>
          ) : null}
          <button className="tb-btn tb-btn--violet" type="submit" disabled={authLoading || !configured}>
            {authLoading
              ? 'Authenticating…'
              : <>{tab === 'signup' ? 'Create wallet' : 'Log in'} {I.arrowRight({ width: 16, height: 16 })}</>}
          </button>
        </div>

      </form>

      <div className="tb-home-spacer" />
    </div>
  );
}
