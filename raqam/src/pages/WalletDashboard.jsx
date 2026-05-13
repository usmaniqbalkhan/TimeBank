import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { formatCurrencyFromPaisa, formatTimestamp, getInitials } from '../lib/formatters';
import { fetchWalletDashboard, updateProfileName } from '../lib/supabase';
import './WalletDashboard.css';

export default function WalletDashboard() {
  const { profile, refreshProfile, session, logout } = useAuth();
  const location = useLocation();
  const [dashboard, setDashboard] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!session?.access_token) {
        return;
      }

      try {
        if (active) {
          setError('');
        }

        const nextDashboard = await fetchWalletDashboard(session.access_token);

        if (active) {
          setDashboard(nextDashboard);
          setEditingName(nextDashboard?.profile?.name || '');
        }
      } catch (nextError) {
        if (active) {
          setError(nextError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [session]);

  async function handleNameSave(event) {
    event.preventDefault();
    setSavingName(true);
    setError('');

    try {
      const updatedProfile = await updateProfileName(session.access_token, editingName);
      await refreshProfile();

      setDashboard((currentDashboard) => ({
        ...(currentDashboard || {}),
        profile: {
          ...(currentDashboard?.profile || {}),
          ...updatedProfile,
        },
      }));
      setIsEditing(false);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSavingName(false);
    }
  }

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
  const activeQr = dashboard?.qr;

  return (
    <div className="wallet-page page-container">
      <header className="wallet-header">
        <div className="user-info">
          <div className="avatar">{getInitials(dashboard?.profile?.name || profile?.name)}</div>
          <div>
            <h2>Hi, {(dashboard?.profile?.name || profile?.name || 'Student').split(' ')[0]}</h2>
            <p className="wallet-subtitle">{dashboard?.profile?.email || profile?.email || 'Loading email...'}</p>
          </div>
        </div>
        <button className="logout-link" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </header>

      {location.state?.notice ? (
        <div className="wallet-banner wallet-banner-success">{location.state.notice}</div>
      ) : null}

      {error ? <div className="wallet-banner wallet-banner-error">{error}</div> : null}

      <Card className="balance-card">
        <div className="balance-content">
          <p className="balance-label">Total Balance</p>
          <h1 className="balance-amount">{wallet ? formatCurrencyFromPaisa(wallet.balance_paisa) : 'Loading...'}</h1>
        </div>
        <div className="code-row">
          <div className="code-pill">Code: {wallet?.wallet_code || '....'}</div>
          <div className="code-pill muted-pill">{activeQr?.token ? 'QR Ready' : 'QR Loading'}</div>
        </div>
      </Card>

      <Card className="profile-card">
        <div className="profile-card-header">
          <div>
            <p className="balance-label">Profile</p>
            <h3>{dashboard?.profile?.name || profile?.name || 'Student'}</h3>
          </div>
          <button className="edit-link" onClick={() => setIsEditing((currentValue) => !currentValue)}>
            {isEditing ? 'Cancel' : 'Edit name'}
          </button>
        </div>

        {isEditing ? (
          <form className="profile-form" onSubmit={handleNameSave}>
            <input
              type="text"
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              placeholder="Update your display name"
              required
            />
            <Button variant="primary" type="submit" disabled={savingName || !editingName.trim()}>
              {savingName ? 'Saving...' : 'Save Name'}
            </Button>
          </form>
        ) : (
          <p className="profile-helper">Names can repeat. Your 4-digit Raqam code is your unique payment identity.</p>
        )}
      </Card>

      <div className="quick-actions">
        <div className="action-item">
          <Link to="/send">
            <Button variant="circular">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
            </Button>
          </Link>
          <span>Send</span>
        </div>
        <div className="action-item">
          <Link to="/scan">
            <Button variant="circular">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M8 8h.01" /><path d="M16 8h.01" /><path d="M8 16h.01" /><path d="M16 16h.01" /></svg>
            </Button>
          </Link>
          <span>Scan</span>
        </div>
        <div className="action-item">
          <Link to="/receive">
            <Button variant="circular">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
            </Button>
          </Link>
          <span>Receive</span>
        </div>
      </div>

      <div className="activity-section">
        <h3 className="section-title">Recent Activity</h3>
        {loading ? <div className="wallet-loading-state">Loading transactions...</div> : null}

        {!loading && !recentTransactions.length ? (
          <div className="wallet-empty-state">No transactions yet. Your next transfer will appear here.</div>
        ) : null}

        {!loading ? (
          <div className="transaction-list">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="transaction-item">
                <div className="tx-left">
                  <div className="tx-icon">{getInitials(tx.counterpart_name || tx.counterpart_wallet_code || '?') || '?'}</div>
                  <div className="tx-details">
                    <p className="tx-name">{tx.counterpart_name || `Code ${tx.counterpart_wallet_code}`}</p>
                    <div className="tx-meta">
                      <p className="tx-date">{formatTimestamp(tx.created_at)}</p>
                      <span className="tx-code-pill">Code {tx.counterpart_wallet_code}</span>
                      <span className="tx-channel-pill">{tx.channel === 'qr' ? 'QR' : 'Code'}</span>
                    </div>
                    {tx.note ? <p className="tx-note">"{tx.note}"</p> : null}
                  </div>
                </div>
                <div className={`tx-amount ${tx.direction === 'credit' ? 'positive' : ''}`}>
                  {tx.direction === 'credit' ? '+' : '-'} {formatCurrencyFromPaisa(tx.amount_paisa)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
