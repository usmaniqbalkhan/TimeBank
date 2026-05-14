import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatTimestamp, getInitials } from '../lib/formatters';
import { fetchWalletDashboard } from '../lib/supabase';
import { TBLogo, I } from '../lib/icons';

function formatPaisaSplit(paisa) {
  const rupees = Math.round(Number(paisa || 0) / 100);
  return new Intl.NumberFormat('en-PK').format(rupees);
}

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 5) return { text: 'Still up', emoji: '🌙' };
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '👋' };
  return { text: 'Good evening', emoji: '🌆' };
}

const AVATAR_VARIANTS = ['tb-avatar--violet', 'tb-avatar--amber', 'tb-avatar--green', 'tb-avatar--red'];
function avatarFor(seed = '') {
  const sum = String(seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_VARIANTS[sum % AVATAR_VARIANTS.length];
}

function computeOverview(transactions) {
  let inP = 0, outP = 0, inCount = 0, outCount = 0;
  const counts = {};
  const byDay = new Map();

  for (const tx of transactions) {
    const amt = Number(tx.amount_paisa || 0);
    if (tx.direction === 'credit') { inP += amt; inCount += 1; }
    else { outP += amt; outCount += 1; }

    const cp = tx.counterpart_name || `Code ${tx.counterpart_wallet_code}`;
    counts[cp] = (counts[cp] || 0) + 1;

    const day = new Date(tx.created_at).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + (tx.direction === 'credit' ? amt : -amt));
  }

  // Last 7 days for the chart
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: d, net: byDay.get(key) || 0 });
  }

  const sortedContacts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sortedContacts[0];

  // Recent unique counterparts (last 5)
  const recentUnique = [];
  const seen = new Set();
  for (const tx of transactions) {
    const code = tx.counterpart_wallet_code;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    recentUnique.push({ code, name: tx.counterpart_name || `Code ${code}` });
    if (recentUnique.length >= 5) break;
  }

  return {
    moneyIn: inP, moneyOut: outP,
    inCount, outCount,
    txCount: transactions.length,
    avgPaisa: transactions.length ? Math.round((inP + outP) / transactions.length) : 0,
    topContact: top ? top[0] : null,
    topContactCount: top ? top[1] : 0,
    days, recentUnique,
  };
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Sparkline({ data }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState(null);
  const [tickKey, setTickKey] = useState(0);

  // Measure the container so the SVG renders at true pixel size — no
  // preserveAspectRatio="none" stretching distorting the end-dot circle.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.max(180, Math.floor(el.getBoundingClientRect().width));
      setWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-trigger the line draw-on animation whenever data changes (live updates).
  const dataKey = data.map((d) => d.net).join('|');
  useEffect(() => { setTickKey((k) => k + 1); }, [dataKey]);

  const W = width;
  const H = 130;
  const PX = 14, PY = 22;
  const innerW = W - 2 * PX;
  const innerH = H - 2 * PY;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.net)), 1);

  const xs = data.map((_, i) => PX + (i / (data.length - 1)) * innerW);
  const ys = data.map((d) => PY + innerH / 2 - (d.net / maxAbs) * (innerH / 2 - 2));

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const baselineY = (PY + innerH / 2).toFixed(1);
  const areaPath = `${linePath} L ${(W - PX).toFixed(1)} ${baselineY} L ${PX.toFixed(1)} ${baselineY} Z`;
  const lastIdx = xs.length - 1;
  const slotW = innerW / Math.max(1, data.length - 1);

  const formatTick = (paisa) => {
    const r = Math.round(Math.abs(paisa) / 100);
    return new Intl.NumberFormat('en-PK').format(r);
  };

  return (
    <div ref={containerRef} className="tb-sparkline">
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6f3ff5" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#6f3ff5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* dashed baseline */}
        <line x1={PX} y1={baselineY} x2={W - PX} y2={baselineY} stroke="rgba(10,10,12,0.08)" strokeDasharray="3 4" />

        {/* area + line — re-keyed on data change so the draw-on animation replays */}
        <g key={tickKey} className="tb-sparkline__draw">
          <path d={areaPath} fill="url(#sparkGrad)" className="tb-sparkline__area" />
          <path d={linePath} fill="none" stroke="#6f3ff5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="tb-sparkline__line" />
        </g>

        {/* live pulse on most recent point */}
        <circle cx={xs[lastIdx]} cy={ys[lastIdx]} r="6" fill="#6f3ff5" fillOpacity="0.28">
          <animate attributeName="r" values="6;14;6" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.32;0.04;0.32" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={xs[lastIdx]} cy={ys[lastIdx]} r="4" fill="#6f3ff5" />

        {/* hover dot */}
        {hover !== null && hover !== lastIdx ? (
          <>
            <line x1={xs[hover]} y1={PY} x2={xs[hover]} y2={H - PY} stroke="rgba(111,63,245,0.25)" strokeDasharray="2 3" />
            <circle cx={xs[hover]} cy={ys[hover]} r="4.5" fill="#fff" stroke="#6f3ff5" strokeWidth="1.8" />
          </>
        ) : null}

        {/* invisible per-day hit areas */}
        {xs.map((x, i) => (
          <rect
            key={i}
            x={x - slotW / 2}
            y={0}
            width={slotW}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>

      {hover !== null ? (
        <div
          className="tb-sparkline__tip"
          style={{
            left: `${(xs[hover] / W) * 100}%`,
            top: Math.max(2, ys[hover] - 38),
          }}
        >
          <div className="tb-sparkline__tip-amt">
            {data[hover].net >= 0 ? '+' : '−'}PKR {formatTick(data[hover].net)}
          </div>
          <div className="tb-sparkline__tip-day">
            {data[hover].date.toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function WalletDashboard() {
  const { profile, session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!session?.access_token) return;
      try {
        if (active) setError('');
        const next = await fetchWalletDashboard(session.access_token);
        if (active) setDashboard(next);
      } catch (nextError) {
        if (active) setError(nextError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, 10000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [session]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const wallet = dashboard?.wallet;
  const recentTransactions = dashboard?.recent_transactions || [];
  const userName = dashboard?.profile?.name || profile?.name || 'Student';
  const userEmail = dashboard?.profile?.email || profile?.email || '';
  const firstName = userName.split(' ')[0];

  const stats = computeOverview(recentTransactions);
  const greet = timeOfDayGreeting();


  return (
    <div className="tb-screen tb-screen--app tb-screen--wallet">
      <div className="tb-status-spacer" />

      <div className="tb-wallet-grid">

        {/* Desktop-only sidebar (hidden on mobile via CSS) */}
        <aside className="tb-wallet-sidebar">
          <div className="tb-wallet-sidebar__head">
            <div className="tb-wallet-sidebar__greeting">Welcome back</div>
            <div className="tb-wallet-sidebar__name">{firstName}</div>
          </div>
          <button type="button" className="tb-wallet-sidebar__link on">
            <span className="tb-wallet-sidebar__icon">{I.home({ width: 18, height: 18 })}</span>
            Home
          </button>
          <button type="button" className="tb-wallet-sidebar__link" onClick={() => setActivityOpen(true)}>
            <span className="tb-wallet-sidebar__icon">{I.history({ width: 18, height: 18 })}</span>
            Activity
          </button>
          <button type="button" className="tb-wallet-sidebar__link" onClick={() => navigate('/send')}>
            <span className="tb-wallet-sidebar__icon">{I.arrowUp()}</span>
            Send money
          </button>
          <button type="button" className="tb-wallet-sidebar__link" onClick={() => navigate('/receive')}>
            <span className="tb-wallet-sidebar__icon">{I.arrowDown()}</span>
            Receive
          </button>
          <button type="button" className="tb-wallet-sidebar__link" onClick={() => navigate('/scan')}>
            <span className="tb-wallet-sidebar__icon">{I.qr({ width: 18, height: 18 })}</span>
            Scan QR
          </button>
          <div className="tb-wallet-sidebar__divider" />
          <button type="button" className="tb-wallet-sidebar__link" onClick={() => setNotifOpen(true)}>
            <span className="tb-wallet-sidebar__icon">{I.bell()}</span>
            Notifications
          </button>
          <button type="button" className="tb-wallet-sidebar__link" onClick={() => setProfileOpen(true)}>
            <span className="tb-wallet-sidebar__icon">{I.user({ width: 18, height: 18 })}</span>
            Profile
          </button>
          <div className="tb-wallet-sidebar__divider" />
          <button type="button" className="tb-wallet-sidebar__link danger" onClick={handleLogout} disabled={loggingOut}>
            <span className="tb-wallet-sidebar__icon">{I.lock({ width: 18, height: 18 })}</span>
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>

          {/* Send Money widget — recent contacts */}
          {stats.recentUnique.length > 0 ? (
            <div className="tb-send-widget">
              <div className="tb-send-widget__title">
                <span className="tb-send-widget__sticker">✨</span>
                Send Money
              </div>
              <div className="tb-send-widget__avatars">
                {stats.recentUnique.slice(0, 4).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    title={`Send to ${c.name}`}
                    onClick={() => navigate(`/send?recipient=${c.code}`)}
                    className={'tb-avatar ' + avatarFor(c.code)}
                    style={{ width: 38, height: 38, flex: '0 0 38px', fontSize: 13, marginLeft: -8, border: '2px solid #fff', cursor: 'pointer' }}
                  >
                    {getInitials(c.name) || '?'}
                  </button>
                ))}
              </div>
              <div className="tb-send-widget__name">{stats.recentUnique[0].name}</div>
              <div className="tb-send-widget__sub">Tap an avatar or pick from list</div>
              <button
                type="button"
                className="tb-btn tb-btn--violet"
                onClick={() => navigate('/send')}
                style={{ height: 44, fontSize: 14 }}
              >
                Next step {I.arrowRight({ width: 14, height: 14 })}
              </button>
            </div>
          ) : null}
        </aside>

        <main className="tb-wallet-main" style={{ flex: 1, padding: '8px 18px 0', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>

        {/* Mobile top bar — hidden on desktop (sidebar handles it) */}
        <div className="tb-wallet-mobile-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="tb-avatar tb-avatar--violet" style={{ width: 42, height: 42, flex: '0 0 42px', fontSize: 14 }}>
              {getInitials(userName) || 'TB'}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--tb-muted)' }}>{greet.text},</div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{firstName}</div>
            </div>
          </div>
          <button className="tb-back" type="button" onClick={() => setNotifOpen(true)} title="Notifications" aria-label="Notifications">
            {I.bell()}
          </button>
        </div>

        {/* Greeting hero — visible on desktop only */}
        <div className="tb-overview-hero">
          <div>
            <div className="tb-overview-hero__greet">
              <span className="tb-overview-hero__sticker" aria-hidden="true">{greet.emoji}</span>
              <span>{greet.text}, <strong>{firstName}</strong></span>
            </div>
            <h1 className="tb-overview-hero__title">Overview</h1>
            <p className="tb-overview-hero__sub">Here's what's happening with your wallet today.</p>
          </div>
          <div className="tb-overview-hero__chips">
            <button type="button" className="tb-chip tb-chip--violet" onClick={() => navigate('/send')}>
              {I.arrowUp()} Send
            </button>
            <button type="button" className="tb-chip" onClick={() => navigate('/receive')}>
              {I.arrowDown({ width: 14, height: 14 })} Receive
            </button>
            <button type="button" className="tb-chip" onClick={() => setNotifOpen(true)} aria-label="Notifications">
              {I.bell()}
            </button>
          </div>
        </div>

        {/* Banners */}
        {location.state?.notice ? (
          <div className="tb-banner tb-banner--success" style={{ margin: 0 }}>
            {I.check({ width: 16, height: 16 })} {location.state.notice}
          </div>
        ) : null}
        {error ? <div className="tb-banner tb-banner--error" style={{ margin: 0 }}>{error}</div> : null}

        {/* Balance card */}
        <div className="tb-balance">
          <div className="tb-balance__top">
            <div className="tb-balance__head">
              <div className="tb-balance__logo">
                <TBLogo size={28} monoLight />
              </div>
              <div className="tb-balance__headtext">
                <div className="tb-balance__label">Timebank balance</div>
                <div className="tb-balance__amt">
                  <span className="curr">PKR</span>
                  {wallet ? formatPaisaSplit(wallet.balance_paisa) : '—'}
                  <span className="frac">.00</span>
                </div>
                <div className="tb-balance__sub">Available · Live</div>
              </div>
            </div>

            <button
              type="button"
              className="tb-balance__code"
              onClick={() => wallet?.wallet_code && navigator.clipboard?.writeText(wallet.wallet_code)}
              title="Copy code"
            >
              <span className="dot" />
              Code · <span className="mono">{wallet?.wallet_code || '....'}</span>
              {I.copy({ width: 12, height: 12, style: { opacity: 0.7 } })}
            </button>
          </div>

          <div className="tb-balance__actions">
            <button
              type="button"
              className="tb-balance__pill tb-balance__pill--light"
              onClick={() => navigate('/send')}
            >
              Transfer funds
            </button>
            <button
              type="button"
              className="tb-balance__pill tb-balance__pill--violet"
              onClick={() => navigate('/receive')}
            >
              Receive
            </button>
          </div>
        </div>

        {/* Action grid */}
        <div className="tb-actions">
          <button className="tb-action" onClick={() => navigate('/send')}>
            <span className="tb-action__ic">{I.arrowUp()}</span>
            <span className="tb-action__lb">Send</span>
          </button>
          <button className="tb-action" onClick={() => navigate('/receive')}>
            <span className="tb-action__ic">{I.arrowDown()}</span>
            <span className="tb-action__lb">Receive</span>
          </button>
          <button className="tb-action" onClick={() => navigate('/scan')}>
            <span className="tb-action__ic">{I.qr({ width: 18, height: 18 })}</span>
            <span className="tb-action__lb">Scan</span>
          </button>
          <button className="tb-action" onClick={() => setProfileOpen(true)}>
            <span className="tb-action__ic">{I.user({ width: 18, height: 18 })}</span>
            <span className="tb-action__lb">Profile</span>
          </button>
        </div>

        {/* Stats grid — Money in / Transactions / Top contact */}
        <div className="tb-stats-grid">
          <div className="tb-stat tb-stat--in">
            <div className="tb-stat__head">
              <span className="tb-stat__sticker" aria-hidden="true">💸</span>
              <span className="tb-stat__label">Money in</span>
            </div>
            <div className="tb-stat__value">+PKR {formatPaisaSplit(stats.moneyIn)}</div>
            <div className="tb-stat__sub">across {stats.inCount} transfer{stats.inCount === 1 ? '' : 's'}</div>
            <button type="button" className="tb-stat__link" onClick={() => setActivityOpen(true)}>
              View report {I.arrowRight({ width: 12, height: 12 })}
            </button>
          </div>

          <div className="tb-stat tb-stat--out">
            <div className="tb-stat__head">
              <span className="tb-stat__sticker" aria-hidden="true">⚡</span>
              <span className="tb-stat__label">Transactions</span>
            </div>
            <div className="tb-stat__value">{stats.txCount}</div>
            <div className="tb-stat__sub">avg PKR {formatPaisaSplit(stats.avgPaisa)}</div>
            <button type="button" className="tb-stat__link" onClick={() => setActivityOpen(true)}>
              View report {I.arrowRight({ width: 12, height: 12 })}
            </button>
          </div>

          <div className="tb-stat tb-stat--top">
            <div className="tb-stat__head">
              <span className="tb-stat__sticker" aria-hidden="true">🌟</span>
              <span className="tb-stat__label">Top contact</span>
            </div>
            <div className="tb-stat__value tb-stat__value--text">
              {stats.topContact || '—'}
            </div>
            <div className="tb-stat__sub">{stats.topContactCount} transfer{stats.topContactCount === 1 ? '' : 's'}</div>
            <button type="button" className="tb-stat__link" onClick={() => setActivityOpen(true)}>
              View report {I.arrowRight({ width: 12, height: 12 })}
            </button>
          </div>
        </div>

        {/* Activity chart */}
        <div className="tb-list-card tb-chart-card">
          <div className="tb-list-head">
            <span>Last 7 days · net flow</span>
            <span className="tb-chart-live">
              <span className="tb-chart-live__dot" />
              Live
            </span>
          </div>
          <Sparkline data={stats.days} />
          <div className="tb-chart-labels">
            {stats.days.map((d, i) => (
              <span key={i}>{DAY_SHORT[d.date.getDay()]}</span>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="tb-list-card" style={{ flex: 1 }}>
          <div className="tb-list-head">
            <span>Recent activity</span>
            <button type="button" onClick={() => setActivityOpen(true)} style={{ color: 'var(--tb-violet-deep)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
              SEE ALL
            </button>
          </div>

          {loading && !recentTransactions.length ? (
            <div style={{ padding: '24px 0', color: 'var(--tb-muted)', fontSize: 13, textAlign: 'center' }}>
              Loading transactions…
            </div>
          ) : null}

          {!loading && !recentTransactions.length ? (
            <div style={{ padding: '24px 0', color: 'var(--tb-muted)', fontSize: 13, textAlign: 'center' }}>
              No transactions yet. Your next transfer will appear here.
            </div>
          ) : null}

          {recentTransactions.map((tx) => {
            const isCredit = tx.direction === 'credit';
            const rupees = Math.round(Number(tx.amount_paisa || 0) / 100);
            const formatted = new Intl.NumberFormat('en-PK').format(rupees);
            const isQr = tx.channel === 'qr';
            return (
              <div key={tx.id} className="tb-tx">
                <div className={'tb-tx__ic' + (isCredit ? ' in' : '')}>
                  {isCredit ? I.arrowDown({ width: 16, height: 16 }) : I.arrowUp({ width: 16, height: 16 })}
                </div>
                <div className="tb-tx__body">
                  <div className="tb-tx__name">
                    {isCredit ? 'From ' : 'To '}
                    {tx.counterpart_name || `Code ${tx.counterpart_wallet_code}`}
                  </div>
                  <div className="tb-tx__sub">
                    {isQr ? 'QR' : `Code ${tx.counterpart_wallet_code}`} · {formatTimestamp(tx.created_at)}
                  </div>
                </div>
                <div className={'tb-tx__amt' + (isCredit ? ' pos' : '')}>
                  {isCredit ? '+' : '−'}{formatted}
                </div>
              </div>
            );
          })}
        </div>

        </main>
      </div>

      {/* Tab bar */}
      <div className="tb-tabbar">
        <button className="tb-tabbar__item on" type="button">
          <span>{I.home({ width: 18, height: 18 })}</span>
          Wallet
        </button>
        <button className="tb-tabbar__item" type="button" onClick={() => setActivityOpen(true)}>
          <span>{I.history({ width: 18, height: 18 })}</span>
          Activity
        </button>
        <button className="tb-tabbar__item" type="button" onClick={() => navigate('/scan')}>
          <span>{I.qr({ width: 18, height: 18 })}</span>
          Scan
        </button>
        <button className="tb-tabbar__item" type="button" onClick={() => setProfileOpen(true)}>
          <span>{I.user({ width: 18, height: 18 })}</span>
          You
        </button>
      </div>
      <div className="tb-home-spacer" />

      {profileOpen ? (
        <ProfileSheet
          name={userName}
          email={userEmail}
          walletCode={wallet?.wallet_code}
          loggingOut={loggingOut}
          onClose={() => setProfileOpen(false)}
          onLogout={handleLogout}
        />
      ) : null}

      {notifOpen ? (
        <NotificationsSheet
          transactions={recentTransactions}
          onClose={() => setNotifOpen(false)}
        />
      ) : null}

      {activityOpen ? (
        <ActivitySheet
          transactions={recentTransactions}
          loading={loading}
          onClose={() => setActivityOpen(false)}
        />
      ) : null}

      {helpOpen ? (
        <HelpSheet onClose={() => setHelpOpen(false)} />
      ) : null}

      {/* Help & contact floating button */}
      <button
        type="button"
        className="tb-help-fab"
        onClick={() => setHelpOpen(true)}
        title="Get help"
      >
        <span className="tb-help-fab__ic">?</span>
        <span className="tb-help-fab__lb">Help &amp; contact</span>
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// HelpSheet — support contact options
// ────────────────────────────────────────────────────────────
function HelpSheet({ onClose }) {
  return (
    <BottomSheet onClose={onClose} height="auto">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
            <span style={{ marginRight: 6 }}>💬</span> Help &amp; contact
          </div>
          <div style={{ fontSize: 12, color: 'var(--tb-muted)', marginTop: 2 }}>
            We usually reply within an hour.
          </div>
        </div>
        <button type="button" className="tb-back" onClick={onClose} aria-label="Close">{I.close()}</button>
      </div>

      <div className="tb-list-card" style={{ marginBottom: 14, padding: 0 }}>
        <a
          href="mailto:support@timebank.app?subject=Timebank%20support%20request"
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderBottom: '1px solid var(--tb-line)', textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--tb-violet-soft)', color: 'var(--tb-violet-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {I.share({ width: 18, height: 18 })}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Email support</div>
            <div style={{ fontSize: 13, color: 'var(--tb-muted)' }}>support@timebank.app</div>
          </div>
          {I.arrowRight({ width: 16, height: 16 })}
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderBottom: '1px solid var(--tb-line)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(25, 192, 142, 0.12)', color: 'var(--tb-green-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {I.shieldCheck({ width: 18, height: 18 })}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Atomic ledger</div>
            <div style={{ fontSize: 13, color: 'var(--tb-muted)' }}>Every transfer is locked &amp; idempotent.</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(246, 166, 35, 0.14)', color: '#b87108', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {I.zap()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>~ 1 hour response</div>
            <div style={{ fontSize: 13, color: 'var(--tb-muted)' }}>Mon–Sun, 9am to 9pm PKT</div>
          </div>
        </div>
      </div>

      <button type="button" className="tb-btn tb-btn--ghost" onClick={onClose}>Close</button>
    </BottomSheet>
  );
}

// ────────────────────────────────────────────────────────────
// Bottom-sheet primitive
// ────────────────────────────────────────────────────────────
function BottomSheet({ children, onClose, height = '70vh' }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(10,10,12,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'tb-fade 200ms var(--tb-ease)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          maxHeight: height,
          background: 'var(--tb-paper)',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          padding: '14px 22px 28px',
          boxShadow: '0 -20px 40px -10px rgba(10,10,12,0.25)',
          animation: 'tb-slide-up 280ms var(--tb-ease)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <style>{`@keyframes tb-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, flex: '0 0 auto' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--tb-line-strong)' }} />
        </div>

        {children}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ProfileSheet — name, email, wallet code, sign-out
// ────────────────────────────────────────────────────────────
function ProfileSheet({ name, email, walletCode, loggingOut, onClose, onLogout }) {
  return (
    <BottomSheet onClose={onClose} height="auto">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div className="tb-avatar tb-avatar--violet" style={{ width: 56, height: 56, flex: '0 0 56px', fontSize: 18 }}>
          {getInitials(name) || 'TB'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 13, color: 'var(--tb-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email || 'No email on file'}</div>
        </div>
      </div>

      {walletCode ? (
        <div className="tb-list-card" style={{ marginBottom: 14 }}>
          <div className="tb-ledger" style={{ borderBottom: 0 }}>
            <div className="tb-ledger__label">Wallet code</div>
            <div />
            <div className="tb-ledger__value mono" style={{ color: 'var(--tb-violet-deep)', fontSize: 16, letterSpacing: '0.1em' }}>
              {walletCode}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="tb-btn tb-btn--ghost" type="button" onClick={onClose}>Close</button>
        <button className="tb-btn" type="button" onClick={onLogout} disabled={loggingOut}
          style={{ background: 'var(--tb-red)', color: '#fff' }}>
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ────────────────────────────────────────────────────────────
// NotificationsSheet — derived from recent transactions
// ────────────────────────────────────────────────────────────
function NotificationsSheet({ transactions, onClose }) {
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flex: '0 0 auto' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Notifications</div>
          <div style={{ fontSize: 12, color: 'var(--tb-muted)', marginTop: 2 }}>
            {transactions.length ? `${transactions.length} recent · activity from your wallet` : "We'll ping you when something happens"}
          </div>
        </div>
        <button type="button" className="tb-back" onClick={onClose} aria-label="Close">{I.close()}</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', margin: '0 -22px', padding: '0 22px' }}>
        {!transactions.length ? (
          <div style={{
            padding: '40px 18px', textAlign: 'center',
            background: '#fff', borderRadius: 'var(--tb-r-card)', border: '1px solid var(--tb-line)',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--tb-violet-soft)', color: 'var(--tb-violet-deep)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              {I.bell()}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>You're all caught up</div>
            <div style={{ fontSize: 13, color: 'var(--tb-muted)', marginTop: 6, lineHeight: 1.5 }}>
              Notifications about transfers, codes and security will appear here.
            </div>
          </div>
        ) : (
          <div className="tb-list-card">
            {transactions.map((tx) => {
              const isCredit = tx.direction === 'credit';
              const rupees = Math.round(Number(tx.amount_paisa || 0) / 100);
              const formatted = new Intl.NumberFormat('en-PK').format(rupees);
              const counterpart = tx.counterpart_name || `Code ${tx.counterpart_wallet_code}`;
              return (
                <div key={tx.id} className="tb-tx">
                  <div className={'tb-tx__ic' + (isCredit ? ' in' : '')}>
                    {isCredit ? I.arrowDown({ width: 16, height: 16 }) : I.arrowUp({ width: 16, height: 16 })}
                  </div>
                  <div className="tb-tx__body">
                    <div className="tb-tx__name">
                      {isCredit ? `Received PKR ${formatted}` : `Sent PKR ${formatted}`}
                    </div>
                    <div className="tb-tx__sub">
                      {isCredit ? 'from ' : 'to '}{counterpart} · {formatTimestamp(tx.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

// ────────────────────────────────────────────────────────────
// ActivitySheet — full transaction list with filters
// ────────────────────────────────────────────────────────────
function ActivitySheet({ transactions, loading, onClose }) {
  const [filter, setFilter] = useState('all');
  const filtered = transactions.filter((tx) => {
    if (filter === 'sent') return tx.direction === 'debit';
    if (filter === 'received') return tx.direction === 'credit';
    return true;
  });

  return (
    <BottomSheet onClose={onClose} height="85vh">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flex: '0 0 auto' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Activity</div>
          <div style={{ fontSize: 12, color: 'var(--tb-muted)', marginTop: 2 }}>
            {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'} on this wallet
          </div>
        </div>
        <button type="button" className="tb-back" onClick={onClose} aria-label="Close">{I.close()}</button>
      </div>

      <div className="tb-tabs" style={{ marginBottom: 14, flex: '0 0 auto' }}>
        <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        <button type="button" className={filter === 'received' ? 'on' : ''} onClick={() => setFilter('received')}>Received</button>
        <button type="button" className={filter === 'sent' ? 'on' : ''} onClick={() => setFilter('sent')}>Sent</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', margin: '0 -22px', padding: '0 22px 8px' }}>
        {loading && !transactions.length ? (
          <div style={{ padding: '40px 0', color: 'var(--tb-muted)', fontSize: 13, textAlign: 'center' }}>
            Loading transactions…
          </div>
        ) : null}

        {!loading && !filtered.length ? (
          <div style={{
            padding: '40px 18px', textAlign: 'center',
            background: '#fff', borderRadius: 'var(--tb-r-card)', border: '1px solid var(--tb-line)',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--tb-violet-soft)', color: 'var(--tb-violet-deep)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              {I.history()}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>No {filter !== 'all' ? filter : ''} transactions yet</div>
            <div style={{ fontSize: 13, color: 'var(--tb-muted)', marginTop: 6, lineHeight: 1.5 }}>
              Your transfers will appear here as soon as they settle.
            </div>
          </div>
        ) : null}

        {filtered.length ? (
          <div className="tb-list-card">
            {filtered.map((tx) => {
              const isCredit = tx.direction === 'credit';
              const rupees = Math.round(Number(tx.amount_paisa || 0) / 100);
              const formatted = new Intl.NumberFormat('en-PK').format(rupees);
              const isQr = tx.channel === 'qr';
              return (
                <div key={tx.id} className="tb-tx">
                  <div className={'tb-tx__ic' + (isCredit ? ' in' : '')}>
                    {isCredit ? I.arrowDown({ width: 16, height: 16 }) : I.arrowUp({ width: 16, height: 16 })}
                  </div>
                  <div className="tb-tx__body">
                    <div className="tb-tx__name">
                      {isCredit ? 'From ' : 'To '}{tx.counterpart_name || `Code ${tx.counterpart_wallet_code}`}
                    </div>
                    <div className="tb-tx__sub">
                      {isQr ? 'QR' : `Code ${tx.counterpart_wallet_code}`} · {formatTimestamp(tx.created_at)}
                    </div>
                    {tx.note ? (
                      <div style={{ fontSize: 12, color: 'var(--tb-muted)', marginTop: 4, fontStyle: 'italic' }}>
                        "{tx.note}"
                      </div>
                    ) : null}
                  </div>
                  <div className={'tb-tx__amt' + (isCredit ? ' pos' : '')}>
                    {isCredit ? '+' : '−'}{formatted}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
