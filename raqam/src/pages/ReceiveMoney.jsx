import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchWalletDashboard } from '../lib/supabase';
import { getInitials } from '../lib/formatters';
import { TBLogo, I } from '../lib/icons';

const QR_IMAGE_BASE = 'https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&data=';

export default function ReceiveMoney() {
  const { session, profile } = useAuth();
  const [identity, setIdentity] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      if (!session?.access_token) return;
      try {
        const dashboard = await fetchWalletDashboard(session.access_token);
        if (active) setIdentity(dashboard);
      } catch (nextError) {
        if (active) setError(nextError.message);
      }
    }

    loadIdentity();
    return () => { active = false; };
  }, [session]);

  const walletCode = identity?.wallet?.wallet_code || '';
  const qrPayload = identity?.qr?.payload || '';
  const qrSrc = qrPayload ? `${QR_IMAGE_BASE}${encodeURIComponent(qrPayload)}` : '';
  const name = identity?.profile?.name || profile?.name || 'Student Wallet';

  async function handleCopy() {
    if (!walletCode) return;
    try {
      await navigator.clipboard.writeText(walletCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function handleShare() {
    if (!walletCode || !qrPayload) return;
    const shareText = `Timebank Code: ${walletCode}\nQR Payload: ${qrPayload}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Timebank Wallet Code', text: shareText });
      } catch {
        // user cancel
      }
      return;
    }
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const digits = walletCode.padEnd(4, '·').slice(0, 4).split('');

  return (
    <div className="tb-screen">
      <div className="tb-status-spacer" />
      <div className="tb-app-bar">
        <Link to="/wallet" className="tb-back">{I.arrowLeft()}</Link>
        <div style={{ textAlign: 'center' }}>
          <div className="tb-app-bar__title">Receive money</div>
          <div className="tb-app-bar__sub">Share to get paid</div>
        </div>
        <button className="tb-back" onClick={handleShare} disabled={!walletCode}>{I.share()}</button>
      </div>

      <div style={{ flex: 1, padding: '12px 22px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {error ? <div className="tb-banner tb-banner--error" style={{ margin: 0 }}>{error}</div> : null}
        {copied ? <div className="tb-banner tb-banner--success" style={{ margin: 0 }}>{I.check({ width: 14, height: 14 })} Copied</div> : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', border: '1px solid var(--tb-line)', borderRadius: 18 }}>
          <div className="tb-avatar tb-avatar--violet">{getInitials(name) || 'TB'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--tb-muted)' }}>Verified student</div>
          </div>
          <span className="tb-back" style={{ width: 32, height: 32 }}>{I.shieldCheck({ width: 14, height: 14, style: { color: 'var(--tb-green-deep)' } })}</span>
        </div>

        <div className="tb-qr-image-shell">
          {qrSrc ? (
            <>
              <img src={qrSrc} alt={`QR code for ${walletCode}`} />
              <div className="tb-qr__center">
                <div className="tb-qr__logo">
                  <TBLogo size={36} monoLight />
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--tb-muted)', fontSize: 13 }}>Loading QR…</div>
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--tb-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Or share your code</div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 8 }}>
            {digits.map((d, i) => (
              <div key={i} style={{
                width: 56, height: 64, borderRadius: 14, background: '#fff', border: '1px solid var(--tb-line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 30, fontWeight: 700,
                letterSpacing: '-0.02em', color: 'var(--tb-violet-deep)'
              }}>{d}</div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--tb-muted)' }}>
            Refreshes automatically · this QR is active.
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="tb-btn tb-btn--light" style={{ flex: 1 }} onClick={handleCopy} disabled={!walletCode}>
              {I.copy({ width: 16, height: 16 })} {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="tb-btn tb-btn--light" style={{ flex: 1 }} onClick={handleShare} disabled={!walletCode}>
              {I.share({ width: 16, height: 16 })} Share
            </button>
          </div>
          <Link to="/send" style={{ display: 'block' }}>
            <button className="tb-btn tb-btn--violet">Send money instead {I.arrowRight({ width: 16, height: 16 })}</button>
          </Link>
        </div>
      </div>
      <div className="tb-home-spacer" />
    </div>
  );
}
