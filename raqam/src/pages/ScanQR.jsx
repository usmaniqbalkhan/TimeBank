import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { normalizeQrPayload, normalizeWalletCode } from '../lib/formatters';
import './ScanQR.css';

export default function ScanQR() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [status, setStatus] = useState('Requesting camera...');

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

      setError('This QR code is not a valid Raqam payment code.');
    }

    async function startScanner() {
      if (!globalThis.BarcodeDetector) {
        setStatus('QR scanning is not supported on this browser.');
        setError('Use the manual 4-digit code fallback below.');
        return;
      }

      try {
        const detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
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

        setStatus('Point the camera at a Raqam QR code.');

        scanTimer = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            return;
          }

          try {
            const codes = await detector.detect(videoRef.current);
            const qrValue = codes?.[0]?.rawValue?.trim();

            if (qrValue) {
              await routeFromPayload(qrValue);
            }
          } catch {
            // Keep scanning while frames are still coming in.
          }
        }, 450);
      } catch {
        setStatus('Camera access failed.');
        setError('Allow camera access or type the 4-digit code manually.');
      }
    }

    startScanner();

    return () => {
      cancelled = true;

      if (scanTimer) {
        window.clearInterval(scanTimer);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [navigate]);

  function handleManualSubmit(event) {
    event.preventDefault();
    const nextValue = normalizeWalletCode(manualValue);

    if (nextValue.length !== 4) {
      return;
    }

    navigate(`/send?recipient=${nextValue}`);
  }

  return (
    <div className="scan-page page-container">
      <header className="scan-header">
        <Link to="/wallet" className="scan-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </Link>
        <h2>Scan QR</h2>
        <div style={{ width: 20 }}></div>
      </header>

      <div className="scan-camera-shell">
        <video ref={videoRef} className="scan-video" muted playsInline />
        <div className="scan-frame" aria-hidden="true"></div>
      </div>

      <p className="scan-status">{status}</p>
      {error ? <p className="scan-error">{error}</p> : null}

      <form className="scan-manual-form" onSubmit={handleManualSubmit}>
        <label htmlFor="manual-wallet-code">Manual 4-digit code</label>
        <input
          id="manual-wallet-code"
          type="text"
          inputMode="numeric"
          value={manualValue}
          onChange={(event) => setManualValue(normalizeWalletCode(event.target.value))}
          placeholder="0000"
        />
        <Button variant="primary" type="submit" disabled={manualValue.length !== 4}>
          Use this code
        </Button>
      </form>
    </div>
  );
}
