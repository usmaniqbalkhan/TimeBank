import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchWalletDashboard } from '../lib/supabase';
import { getInitials } from '../lib/formatters';
import { TBLogo, I } from '../lib/icons';

function format(paisa) {
  return new Intl.NumberFormat('en-PK').format(Math.round(Number(paisa || 0) / 100));
}

const AVATAR_COLORS = ['#d46a4a', '#6f3ff5', '#2da37a', '#0a0a0c', '#e89f1a'];

export default function PaymentsDashboard() {
  const { profile, session, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [selectedBank, setSelectedBank] = useState(0);
  const [recipient, setRecipient] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    let active = true;
    async function load() {
      try {
        const next = await fetchWalletDashboard(session.access_token);
        if (active) setDashboard(next);
      } catch {
        // soft-fail; the page still renders with placeholders
      }
    }
    load();
    const id = setInterval(load, 10000);
    return () => { active = false; clearInterval(id); };
  }, [session]);

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  }

  const wallet = dashboard?.wallet;
  const txs = dashboard?.recent_transactions || [];
  const userName = dashboard?.profile?.name || profile?.name || 'Student';
  const firstName = userName.split(' ')[0];

  // Recent unique contacts — used in Send Money card and as "bank" rows
  const contacts = [];
  const seen = new Set();
  for (const tx of txs) {
    const code = tx.counterpart_wallet_code;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    contacts.push({ code, name: tx.counterpart_name || `Code ${code}` });
    if (contacts.length >= 5) break;
  }

  // Donut split: money in vs money out (last activity window)
  const moneyIn = txs.filter((t) => t.direction === 'credit').reduce((s, t) => s + Number(t.amount_paisa || 0), 0);
  const moneyOut = txs.filter((t) => t.direction === 'debit').reduce((s, t) => s + Number(t.amount_paisa || 0), 0);
  const total = moneyIn + moneyOut || 1;
  const inPct = Math.round((moneyIn / total) * 100);
  const outPct = 100 - inPct;

  function handleSubmitRecipient(event) {
    event.preventDefault();
    const cleaned = recipient.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length === 4) navigate(`/send?recipient=${cleaned}`);
    else navigate('/send');
  }

  function handleNextStep() {
    const target = contacts[selectedBank];
    if (target) navigate(`/send?recipient=${target.code}`);
    else navigate('/send');
  }

  return (
    <div className="tb-screen tb-screen--app tb-screen--payments">
      <div className="tb-status-spacer" />

      <div className="tb-pay-shell">

        {/* ───── Sidebar ───── */}
        <aside className="tb-pay-sidebar">
          <Link to="/" className="tb-pay-brand">
            <TBLogo size={28} />
            <span>Timebank</span>
          </Link>

          <nav className="tb-pay-nav">
            <Link to="/wallet" className="tb-pay-nav__item">
              <span className="tb-pay-nav__left">
                <span className="tb-pay-nav__icon">{I.home({ width: 18, height: 18 })}</span>
                Summary
              </span>
            </Link>
            <button type="button" className="tb-pay-nav__item" onClick={() => navigate('/wallet', { state: { openActivity: true } })}>
              <span className="tb-pay-nav__left">
                <span className="tb-pay-nav__icon">{I.history({ width: 18, height: 18 })}</span>
                Activity
              </span>
            </button>
            <Link to="/send" className="tb-pay-nav__item">
              <span className="tb-pay-nav__left">
                <span className="tb-pay-nav__icon">{I.zap()}</span>
                Send &amp; Request
              </span>
            </Link>
            <button type="button" className="tb-pay-nav__item is-active">
              <span className="tb-pay-nav__left">
                <span className="tb-pay-nav__icon">{I.cards({ width: 18, height: 18 })}</span>
                Wallet
              </span>
              <span className="tb-pay-nav__dots">•••</span>
            </button>
            <Link to="/receive" className="tb-pay-nav__item">
              <span className="tb-pay-nav__left">
                <span className="tb-pay-nav__icon">{I.qr({ width: 18, height: 18 })}</span>
                Receive
              </span>
            </Link>
            <Link to="/scan" className="tb-pay-nav__item">
              <span className="tb-pay-nav__left">
                <span className="tb-pay-nav__icon">{I.shield({ width: 18, height: 18 })}</span>
                Scan QR
              </span>
            </Link>
          </nav>

          {/* Send Money widget */}
          <form onSubmit={handleSubmitRecipient} className="tb-pay-send">
            <h3>Send Money <span aria-hidden="true">💸</span></h3>
            <input
              className="tb-pay-send__input"
              placeholder="4-digit code"
              inputMode="numeric"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            {contacts.length > 0 ? (
              <div className="tb-pay-send__avatars">
                {contacts.slice(0, 4).map((c, i) => (
                  <button
                    type="button"
                    key={c.code}
                    title={`Send to ${c.name}`}
                    onClick={() => navigate(`/send?recipient=${c.code}`)}
                    className="tb-pay-send__avatar"
                    style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                  >
                    {getInitials(c.name) || '?'}
                  </button>
                ))}
              </div>
            ) : null}
            {contacts[0] ? (
              <>
                <div className="tb-pay-send__name">{contacts[0].name}</div>
                <div className="tb-pay-send__email">Code · {contacts[0].code}</div>
              </>
            ) : (
              <div className="tb-pay-send__empty">No recent contacts</div>
            )}
            <button type="submit" className="tb-pay-send__btn">
              Next Step {I.arrowRight({ width: 12, height: 12 })}
            </button>
          </form>

          <button type="button" className="tb-pay-logout" onClick={handleLogout} disabled={loggingOut}>
            <span className="tb-pay-logout__dot" />
            {loggingOut ? 'Logging out…' : 'Log out'}
            <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </aside>

        {/* ───── Main ───── */}
        <main className="tb-pay-main">
          <div className="tb-pay-greet">
            <span aria-hidden="true">👋</span>
            Good evening, <span className="ital">{firstName}!</span>
          </div>

          <h1 className="tb-pay-title">Payment <span className="ital">Methods</span></h1>

          <div className="tb-pay-methods">

            {/* Balance card */}
            <div className="tb-pay-balance">
              <div>
                <div className="tb-pay-balance__head">
                  <div className="tb-pay-balance__logo">
                    <TBLogo size={28} monoLight />
                  </div>
                  <div>
                    <div className="tb-pay-balance__label">Timebank Balance</div>
                    <div className="tb-pay-balance__amt">
                      <span className="curr">PKR</span>
                      {wallet ? format(wallet.balance_paisa) : '—'}
                      <span className="frac">.00</span>
                    </div>
                    <div className="tb-pay-balance__sub">Available</div>
                  </div>
                </div>
              </div>
              <div className="tb-pay-balance__actions">
                <button type="button" className="tb-pay-pill tb-pay-pill--light" onClick={() => navigate('/send')}>
                  Transfer Funds
                </button>
                <button type="button" className="tb-pay-pill tb-pay-pill--violet" onClick={() => navigate('/receive')}>
                  Receive
                </button>
              </div>
            </div>

            {/* Bank-style card showing wallet code */}
            <div className="tb-pay-bank-card">
              <div className="tb-pay-bank-card__ic">
                {I.hash({ width: 26, height: 26 })}
              </div>
              <div className="tb-pay-bank-card__body">
                <div className="tb-pay-bank-card__name">Your wallet code</div>
                <div className="tb-pay-bank-card__amt mono">{wallet?.wallet_code || '....'}</div>
              </div>
            </div>

            {/* Link / Scan card with illustration */}
            <button type="button" className="tb-pay-link-card" onClick={() => navigate('/scan')}>
              <div className="tb-pay-illu">
                <div className="tb-pay-illu__emoji" aria-hidden="true">📱</div>
                <div className="tb-pay-illu__label">Tap to scan</div>
              </div>
              <h3>Scan a QR code</h3>
              <p>Point at a friend's QR or enter a 4-digit code</p>
            </button>

          </div>

          {/* Estimated total */}
          <div className="tb-pay-totals">
            <div className="tb-pay-totals__head">
              <h2 className="tb-pay-totals__title">
                Estimated total of
                <span className="ital">all flows</span>
              </h2>
              <button type="button" className="tb-pay-totals__cta" onClick={() => navigate('/send')}>
                Transfer Funds
              </button>
            </div>
            <hr className="tb-pay-totals__divider" />

            <div className="tb-pay-totals__layout">
              <div>
                <p className="tb-pay-totals__copy">
                  Use your balance to send, receive or split tabs — settled atomically across the campus ledger.
                </p>

                <div className="tb-pay-ccy">
                  <div className="tb-pay-ccy__flag">🇵🇰</div>
                  <div className="tb-pay-ccy__code">PKR</div>
                  <div className="tb-pay-ccy__tag">Primary</div>
                  <div className="tb-pay-ccy__amt">{wallet ? format(wallet.balance_paisa) : '—'}.00</div>
                </div>
                <div className="tb-pay-ccy">
                  <div className="tb-pay-ccy__flag" style={{ background: 'rgba(25,192,142,0.12)' }}>💸</div>
                  <div className="tb-pay-ccy__code">Money in</div>
                  <div></div>
                  <div className="tb-pay-ccy__amt" style={{ color: 'var(--tb-green-deep)' }}>+{format(moneyIn)}</div>
                </div>
                <div className="tb-pay-ccy">
                  <div className="tb-pay-ccy__flag" style={{ background: 'rgba(255,87,87,0.10)' }}>⚡</div>
                  <div className="tb-pay-ccy__code">Money out</div>
                  <div></div>
                  <div className="tb-pay-ccy__amt">−{format(moneyOut)}</div>
                </div>
              </div>

              {/* Donut */}
              <div className="tb-pay-donut-wrap">
                <div
                  className="tb-pay-donut"
                  style={{
                    background: `conic-gradient(var(--tb-violet) 0deg ${(inPct / 100) * 360}deg, var(--tb-violet-soft) ${(inPct / 100) * 360}deg 360deg)`,
                  }}
                >
                  <div className="tb-pay-donut__center">
                    <div className="tb-pay-donut__label">Net flow</div>
                    <div className="tb-pay-donut__value">{txs.length}</div>
                    <div className="tb-pay-donut__sub">tx</div>
                  </div>
                </div>
                <div className="tb-pay-donut__legend">
                  <div className="tb-pay-legend-row">
                    <span className="tb-pay-legend-dot in" /> In · {inPct}%
                  </div>
                  <div className="tb-pay-legend-row">
                    <span className="tb-pay-legend-dot out" /> Out · {outPct}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ───── Right Rail ───── */}
        <aside className="tb-pay-rail">
          <div className="tb-pay-rail__top">
            <div className="tb-pay-rail__icons">
              <button type="button" className="tb-pay-rail__ic" title="Filter" onClick={() => navigate('/wallet')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M6 12h12M10 18h4" />
                </svg>
              </button>
              <button type="button" className="tb-pay-rail__ic" title="Notifications" onClick={() => navigate('/wallet')}>
                {I.bell()}
              </button>
            </div>
            <div className="tb-pay-balance-pill">PKR {wallet ? format(wallet.balance_paisa) : '—'}</div>
          </div>

          <h2 className="tb-pay-rail__title">
            Quick transfer<br/>
            <span className="ital">to a contact</span>
          </h2>
          <div className="tb-pay-rail__sub">Settles atomically in milliseconds</div>

          <div className="tb-pay-banks">
            {contacts.length === 0 ? (
              <div className="tb-pay-rail__empty">
                No recent contacts yet. Send your first transfer to populate this list.
              </div>
            ) : contacts.map((c, i) => (
              <button
                key={c.code}
                type="button"
                className={'tb-pay-bank-row' + (i === selectedBank ? ' is-selected' : '')}
                onClick={() => setSelectedBank(i)}
              >
                <div className="tb-pay-bank-row__radio" />
                <div className="tb-pay-bank-row__body">
                  <div className="tb-pay-bank-row__name">{c.name}</div>
                  <div className="tb-pay-bank-row__num mono">Code · • • {c.code}</div>
                </div>
                <span className="tb-pay-bank-row__dots">•••</span>
              </button>
            ))}
          </div>

          <Link to="/send" className="tb-pay-rail__missing">Don't see your contact? Send to a code instead</Link>

          <button type="button" className="tb-pay-rail__cta" onClick={handleNextStep} disabled={contacts.length === 0}>
            Next Step
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>

          <div className="tb-pay-illu-block">
            <div className="tb-pay-illu-block__emoji" aria-hidden="true">🎓</div>
            <div className="tb-pay-illu-block__label">Campus wallet</div>
          </div>
        </aside>
      </div>

      <div className="tb-home-spacer" />
    </div>
  );
}
