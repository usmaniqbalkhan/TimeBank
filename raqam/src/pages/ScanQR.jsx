import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { normalizeQrPayload, normalizeWalletCode } from '../lib/formatters';
import { I } from '../lib/icons';

export default function ScanQR() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Requesting camera…');
  const [manualValue, setManualValue] = useState('');
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    let scanTimer = null;
    let cancelled = false;

    async function routeFromPayload(payload) {
      const normalizedPayload = payload?.trim() || '';
      const walletCode = normalizeWalletCode(normalizedPayload);
      const qrToken = normalizeQrPayload(normalizedPayload);

      if (walletCode.length === 4 && normalizedPayload === walletCode) {
        navigate(`/send?recipient=${walletCode}`, { replace: true });
        return;
      }
      if (qrToken) {
        navigate(`/send?qr=${encodeURIComponent(qrToken)}`, { replace: true });
        return;
      }
      setError('This QR code is not a valid Timebank payment code.');
    }

    async function startScanner() {
      if (!globalThis.BarcodeDetector) {
        setStatus('QR scanning is not supported on this browser.');
        setError('Use the manual 4-digit code fallback below.');
        setManualOpen(true);
        return;
      }

      try {
        const detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('Align the Timebank QR');

        scanTimer = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const qrValue = codes?.[0]?.rawValue?.trim();
            if (qrValue) await routeFromPayload(qrValue);
          } catch {
            // keep scanning
          }
        }, 450);
      } catch {
        setStatus('Camera access failed.');
        setError('Allow camera access or type the 4-digit code manually.');
        setManualOpen(true);
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      if (scanTimer) window.clearInterval(scanTimer);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, [navigate]);

  function handleManualSubmit(event) {
    event.preventDefault();
    const next = normalizeWalletCode(manualValue);
    if (next.length !== 4) return;
    navigate(`/send?recipient=${next}`);
  }

  return (
    <div className="tb-screen tb-screen--scan" style={{ background: '#000', color: '#fff' }}>
      <div className="tb-scan">
        <video ref={videoRef} className="tb-scan__video" muted playsInline />
      </div>
      <div className="tb-scan__mask" />

      <div className="tb-scan__reticle">
        <div className="tb-scan__corner tl"><span className="h" /><span className="v" /></div>
        <div className="tb-scan__corner tr"><span className="h" /><span className="v" /></div>
        <div className="tb-scan__corner bl"><span className="h" /><span className="v" /></div>
        <div className="tb-scan__corner br"><span className="h" /><span className="v" /></div>
        <div className="tb-scan__line" />
      </div>

      <div style={{ position: 'relative', zIndex: 4, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="tb-status-spacer" />
        <div className="tb-app-bar">
          <Link to="/wallet" className="tb-back" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>{I.close()}</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(255,255,255,0.12)', borderRadius: 999, backdropFilter: 'blur(10px)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--tb-violet-2)', boxShadow: '0 0 8px var(--tb-violet-2)' }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Scanning…</span>
          </div>
          <button className="tb-back" onClick={() => setManualOpen((v) => !v)} style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>
            {I.hash({ width: 18, height: 18 })}
          </button>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ textAlign: 'center', padding: '20px 28px 0' }}>
          <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{status}</h3>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 8, marginBottom: 0, lineHeight: 1.4 }}>
            {error || 'Your camera will recognise the code automatically. The transfer screen opens with the amount preview.'}
          </p>
        </div>

        {manualOpen ? (
          <form onSubmit={handleManualSubmit} style={{ margin: '24px 22px 18px', padding: '14px 18px', borderRadius: 18, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(111,63,245,0.25)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {I.hash({ width: 18, height: 18 })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Enter 4-digit code</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Skip the camera</div>
              </div>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={manualValue}
              onChange={(e) => setManualValue(normalizeWalletCode(e.target.value))}
              placeholder="0000"
              autoFocus
              style={{
                width: '100%', height: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)',
                background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '0 16px',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 20, letterSpacing: '0.2em',
                textAlign: 'center', outline: 'none',
              }}
            />
            <button
              type="submit"
              className="tb-btn tb-btn--violet"
              style={{ marginTop: 10 }}
              disabled={manualValue.length !== 4}
            >
              Use this code {I.arrowRight({ width: 16, height: 16 })}
            </button>
          </form>
        ) : (
          <div style={{ margin: '24px 22px 18px', padding: '14px 18px', borderRadius: 18, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(111,63,245,0.25)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {I.hash({ width: 18, height: 18 })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Don't have a QR?</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Enter the 4-digit code instead</div>
              </div>
              <button onClick={() => setManualOpen(true)} className="tb-back" style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.16)', color: '#fff' }}>
                {I.arrowRight({ width: 16, height: 16 })}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="tb-home-spacer" />
    </div>
  );
}
