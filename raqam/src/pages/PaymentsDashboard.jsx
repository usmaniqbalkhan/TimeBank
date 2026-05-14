import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchWalletDashboard } from '../lib/supabase';
import { getInitials } from '../lib/formatters';
import { TBLogo, I } from '../lib/icons';

function format(paisa) {
  return new Intl.NumberFormat('en-PK').format(Math.round(Number(paisa || 0) / 100));
}

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 5) return { text: 'Still up', emoji: '🌙' };
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '👋' };
  return { text: 'Good evening', emoji: '🌆' };
}

const AVATAR_COLORS = ['#d46a4a', '#6f3ff5', '#2da37a', '#0a0a0c', '#e89f1a'];

export default function PaymentsDashboard() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [selectedContact, setSelectedContact] = useState(0);
  const [recipient, setRecipient] = useState('');

  useEffect(() => {
    if (!session?.access_token) return;
    let active = true;
    async function load() {
      try {
        const next = await fetchWalletDashboard(session.access_token);
        if (active) setDashboard(next);
      } catch {
        // soft-fail
      }
    }
    load();
    const id = setInterval(load, 10000);
    return () => { active = false; clearInterval(id); };
  }, [session]);

  const wallet = dashboard?.wallet;
  const txs = dashboard?.recent_transactions || [];
  const userName = dashboard?.profile?.name || profile?.name || 'Student';
  const firstName = userName.split(' ')[0];
  const greet = timeOfDayGreeting();

  // Recent unique contacts — used in the Quick transfer rows
  const contacts = [];
  const seen = new Set();
  for (const tx of txs) {
    const code = tx.counterpart_wallet_code;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    contacts.push({ code, name: tx.counterpart_name || `Code ${code}` });
    if (contacts.length >= 4) break;
  }

  // In/out donut split
  const moneyIn = txs.filter((t) => t.direction === 'credit').reduce((s, t) => s + Number(t.amount_paisa || 0), 0);
  const moneyOut = txs.filter((t) => t.direction === 'debit').reduce((s, t) => s + Number(t.amount_paisa || 0), 0);
  const total = moneyIn + moneyOut || 1;
  const inPct = Math.round((moneyIn / total) * 100);
  const outPct = 100 - inPct;

  function handleSubmitRecipient(event) {
    event.preventDefault();
    const cleaned = recipient.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length === 4) {
      navigate(`/send?recipient=${cleaned}`);
    } else if (contacts[selectedContact]) {
      navigate(`/send?recipient=${contacts[selectedContact].code}`);
    } else {
      navigate('/send');
    }
  }

  return (
    <div className="tb-screen tb-screen--app tb-screen--payments">
      <div className="tb-status-spacer" />

      <div className="tb-pay-page">

        {/* Page header */}
        <header className="tb-pay-header">
          <div>
            <div className="tb-pay-greet">
              <span className="tb-pay-greet__sticker" aria-hidden="true">{greet.emoji}</span>
              {greet.text}, <strong>{firstName}</strong>
            </div>
            <h1 className="tb-pay-title">Payment <span className="ital">methods</span></h1>
            <p className="tb-pay-sub">Manage your balance, code and quick transfers — all in one place.</p>
          </div>
          <div className="tb-pay-balance-pill" title="Live balance">
            PKR {wallet ? format(wallet.balance_paisa) : '—'}
          </div>
        </header>

        {/* 2-column layout: main + right rail */}
        <div className="tb-pay-grid">

          {/* ───── Main column ───── */}
          <main className="tb-pay-main">

            {/* Methods grid */}
            <div className="tb-pay-methods">

              {/* Balance card (violet gradient) */}
              <div className="tb-pay-balance-card">
                <div>
                  <div className="tb-pay-balance-card__head">
                    <div className="tb-pay-balance-card__logo">
                      <TBLogo size={28} monoLight />
                    </div>
                    <div>
                      <div className="tb-pay-balance-card__label">Timebank balance</div>
                      <div className="tb-pay-balance-card__amt">
                        <span className="curr">PKR</span>
                        {wallet ? format(wallet.balance_paisa) : '—'}
                        <span className="frac">.00</span>
                      </div>
                      <div className="tb-pay-balance-card__sub">Available · live</div>
                    </div>
                  </div>
                </div>
                <div className="tb-pay-balance-card__actions">
                  <button type="button" className="tb-pay-pill tb-pay-pill--light" onClick={() => navigate('/send')}>
                    Transfer funds
                  </button>
                  <button type="button" className="tb-pay-pill tb-pay-pill--violet" onClick={() => navigate('/receive')}>
                    Receive
                  </button>
                </div>
              </div>

              {/* Wallet code (peach) */}
              <div className="tb-pay-code-card">
                <div className="tb-pay-code-card__ic">
                  {I.hash({ width: 26, height: 26 })}
                </div>
                <div className="tb-pay-code-card__body">
                  <div className="tb-pay-code-card__name">Your wallet code</div>
                  <div className="tb-pay-code-card__amt mono">{wallet?.wallet_code || '....'}</div>
                </div>
              </div>

              {/* Scan card */}
              <button type="button" className="tb-pay-link-card" onClick={() => navigate('/scan')}>
                <div className="tb-pay-illu">
                  <div className="tb-pay-illu__emoji" aria-hidden="true">📱</div>
                  <div className="tb-pay-illu__label">Tap to scan</div>
                </div>
                <h3>Scan a QR code</h3>
                <p>Point your camera or enter a 4-digit code</p>
              </button>

            </div>

            {/* Estimated total + currency rows + donut */}
            <section className="tb-pay-totals">
              <div className="tb-pay-totals__head">
                <div>
                  <h2 className="tb-pay-totals__title">
                    Estimated total of <span className="ital">all flows</span>
                  </h2>
                  <p className="tb-pay-totals__copy">
                    Use your balance to send, receive or split tabs — settled atomically across the campus ledger.
                  </p>
                </div>
                <button type="button" className="tb-pay-totals__cta" onClick={() => navigate('/send')}>
                  Transfer funds
                </button>
              </div>

              <div className="tb-pay-totals__layout">
                <div className="tb-pay-ccy-list">
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
                    <div className="tb-pay-legend-row"><span className="tb-pay-legend-dot in" /> In · {inPct}%</div>
                    <div className="tb-pay-legend-row"><span className="tb-pay-legend-dot out" /> Out · {outPct}%</div>
                  </div>
                </div>
              </div>
            </section>
          </main>

          {/* ───── Right rail: merged Quick Transfer ───── */}
          <aside className="tb-pay-rail">
            <h2 className="tb-pay-rail__title">
              Quick transfer<br/>
              <span className="ital">to a contact</span>
            </h2>
            <p className="tb-pay-rail__sub">Settles atomically in milliseconds.</p>

            <form onSubmit={handleSubmitRecipient} className="tb-pay-quick">
              <label className="tb-pay-quick__label">Send to a 4-digit code</label>
              <input
                className="tb-pay-quick__input"
                placeholder="0000"
                inputMode="numeric"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />

              {contacts.length > 0 ? (
                <>
                  <div className="tb-pay-quick__divider"><span>or pick a recent contact</span></div>

                  <div className="tb-pay-quick__avatars">
                    {contacts.map((c, i) => (
                      <button
                        type="button"
                        key={c.code}
                        title={`Send to ${c.name}`}
                        onClick={() => navigate(`/send?recipient=${c.code}`)}
                        className="tb-pay-quick__avatar"
                        style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      >
                        {getInitials(c.name) || '?'}
                      </button>
                    ))}
                  </div>

                  <div className="tb-pay-banks">
                    {contacts.map((c, i) => (
                      <button
                        key={c.code}
                        type="button"
                        className={'tb-pay-bank-row' + (i === selectedContact ? ' is-selected' : '')}
                        onClick={() => setSelectedContact(i)}
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
                </>
              ) : (
                <div className="tb-pay-rail__empty">
                  No recent contacts yet. Send your first transfer to populate this list.
                </div>
              )}

              <Link to="/send" className="tb-pay-rail__missing">Don't see your contact? Send to a code instead</Link>

              <button type="submit" className="tb-pay-rail__cta">
                Next step
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </form>

            <div className="tb-pay-illu-block">
              <div className="tb-pay-illu-block__emoji" aria-hidden="true">🎓</div>
              <div className="tb-pay-illu-block__label">Campus wallet</div>
            </div>
          </aside>
        </div>
      </div>

      <div className="tb-home-spacer" />
    </div>
  );
}
