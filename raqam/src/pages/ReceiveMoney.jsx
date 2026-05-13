import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { fetchWalletDashboard } from '../lib/supabase';
import './ReceiveMoney.css';

const QR_IMAGE_BASE = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=16&data=';

export default function ReceiveMoney() {
  const { session } = useAuth();
  const [identity, setIdentity] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      if (!session?.access_token) {
        return;
      }

      try {
        const dashboard = await fetchWalletDashboard(session.access_token);

        if (active) {
          setIdentity(dashboard);
        }
      } catch (nextError) {
        if (active) {
          setError(nextError.message);
        }
      }
    }

    loadIdentity();

    return () => {
      active = false;
    };
  }, [session]);

  const walletCode = identity?.wallet?.wallet_code || '';
  const qrPayload = identity?.qr?.payload || '';
  const qrSrc = qrPayload ? `${QR_IMAGE_BASE}${encodeURIComponent(qrPayload)}` : '';

  async function handleShare() {
    if (!walletCode || !qrPayload) {
      return;
    }

    const shareText = `Raqam Code: ${walletCode}\nQR Payload: ${qrPayload}`;

    if (navigator.share) {
      await navigator.share({
        title: 'Raqam Wallet Code',
        text: shareText,
      });
      return;
    }

    await navigator.clipboard.writeText(shareText);
  }

  return (
    <div className="receive-page page-container">
      <header className="receive-header">
        <Link to="/wallet" className="receive-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </Link>
        <h2>Receive Money</h2>
        <div style={{ width: 20 }}></div>
      </header>

      {error ? <div className="receive-error-banner">{error}</div> : null}

      <Card className="receive-card">
        <p className="receive-kicker">Your receiving identity</p>
        <h1 className="receive-title">{identity?.profile?.name || 'Student Wallet'}</h1>
        <p className="receive-copy">Share this QR code or your 4-digit Raqam code so another student can pay you instantly.</p>

        <div className="receive-qr-shell">
          {qrSrc ? (
            <img className="receive-qr-image" src={qrSrc} alt={`QR code for ${walletCode}`} />
          ) : (
            <div className="receive-qr-placeholder">Loading QR...</div>
          )}
        </div>

        <div className="receive-id-block">
          <span className="receive-id-label">Raqam Code</span>
          <strong>{walletCode || 'Loading...'}</strong>
        </div>
      </Card>

      <div className="receive-actions">
        <Button variant="primary" onClick={handleShare} disabled={!walletCode || !qrPayload}>
          Share Identity
        </Button>
        <Link to="/send" className="receive-secondary-link">
          <Button variant="tertiary">Send money instead</Button>
        </Link>
      </div>
    </div>
  );
}
