import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatTimestamp, getInitials } from '../lib/formatters';
import { fetchWalletDashboard } from '../lib/supabase';
import { I } from '../lib/icons';

function formatPaisaSplit(paisa) {
  const rupees = Math.round(Number(paisa || 0) / 100);
  return new Intl.NumberFormat('en-PK').format(rupees);
}

export default function WalletDashboard() {
  const { profile, session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

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
  const firstName = userName.split(' ')[0];

  return (
    <div className="tb-screen">
      <div className="tb-status-spacer" />

      <div style={{ flex: 1, padding: '8px 18px 0', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="tb-avatar tb-avatar--violet" style={{ width: 42, height: 42, flex: '0 0 42px', fontSize: 14 }}>
              {getInitials(userName) || 'TB'}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--tb-muted)' }}>Hi there,</div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{firstName}</div>
            </div>
          </div>
          <button className="tb-back" onClick={handleLogout} disabled={loggingOut} title="Sign out">
            {loggingOut
              ? <span style={{ fontSize: 10 }}>…</span>
              : I.bell()}
          </button>
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
          <div className="tb-balance__label">Available balance</div>
          <div className="tb-balance__amt">
            <span className="curr">PKR</span>
            {wallet ? formatPaisaSplit(wallet.balance_paisa) : '—'}
            <span className="frac">.00</span>
          </div>
          <div className="tb-balance__row">
            <div className="tb-code-pill">
              <span className="dot" />
              Code · <span className="mono" style={{ letterSpacing: '0.05em' }}>{wallet?.wallet_code || '....'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="tb-balance__icon-btn"
                onClick={() => wallet?.wallet_code && navigator.clipboard?.writeText(wallet.wallet_code)}
                title="Copy code"
              >
                {I.copy({ width: 14, height: 14 })}
              </button>
              <Link to="/receive" className="tb-balance__icon-btn">
                {I.qr({ width: 14, height: 14 })}
              </Link>
            </div>
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
          <button className="tb-action" onClick={handleLogout} disabled={loggingOut}>
            <span className="tb-action__ic">{I.user({ width: 18, height: 18 })}</span>
            <span className="tb-action__lb">{loggingOut ? '…' : 'Sign out'}</span>
          </button>
        </div>

        {/* Activity */}
        <div className="tb-list-card" style={{ flex: 1 }}>
          <div className="tb-list-head">
            <span>Recent activity</span>
            <span style={{ color: 'var(--tb-muted)', fontSize: 11 }}>{recentTransactions.length} entries</span>
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

      </div>

      {/* Tab bar */}
      <div className="tb-tabbar">
        <button className="tb-tabbar__item on">
          <span>{I.home({ width: 18, height: 18 })}</span>
          Wallet
        </button>
        <button className="tb-tabbar__item" onClick={() => navigate('/receive')}>
          <span>{I.history({ width: 18, height: 18 })}</span>
          Activity
        </button>
        <button className="tb-tabbar__item" onClick={() => navigate('/scan')}>
          <span>{I.cards({ width: 18, height: 18 })}</span>
          Scan
        </button>
        <button className="tb-tabbar__item" onClick={handleLogout}>
          <span>{I.user({ width: 18, height: 18 })}</span>
          You
        </button>
      </div>
      <div className="tb-home-spacer" />
    </div>
  );
}
