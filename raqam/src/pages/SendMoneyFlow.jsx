import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import {
  createIdempotencyKey,
  lookupRecipientByCode,
  lookupRecipientByQr,
  transferMoneyByCode,
  transferMoneyByQr,
} from '../lib/supabase';
import {
  formatCurrencyFromPaisa,
  normalizeWalletCode,
  toPaisa,
} from '../lib/formatters';
import './SendMoneyFlow.css';

export default function SendMoneyFlow() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQrToken = searchParams.get('qr') || '';
  const initialCode = normalizeWalletCode(searchParams.get('recipient') || '');

  const [step, setStep] = useState(initialQrToken ? 2 : 1);
  const [walletCode, setWalletCode] = useState(initialCode);
  const [qrToken] = useState(initialQrToken);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recipient, setRecipient] = useState(null);
  const [error, setError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(Boolean(initialQrToken));
  const [transferLoading, setTransferLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey());

  useEffect(() => {
    let active = true;

    async function hydrateQrRecipient() {
      if (!initialQrToken || !session?.access_token) {
        return;
      }

      try {
        const nextRecipient = await lookupRecipientByQr(session.access_token, initialQrToken);

        if (!nextRecipient?.wallet_code) {
          throw new Error('Invalid QR code.');
        }

        if (active) {
          setRecipient(nextRecipient);
          setWalletCode(nextRecipient.wallet_code);
          setStep(2);
          setError('');
        }
      } catch (nextError) {
        if (active) {
          setError(nextError.message);
          setStep(1);
        }
      } finally {
        if (active) {
          setLookupLoading(false);
        }
      }
    }

    hydrateQrRecipient();

    return () => {
      active = false;
    };
  }, [initialQrToken, session]);

  async function handleNext() {
    setError('');

    if (step === 1) {
      if (walletCode.length !== 4) {
        setError('Enter a valid 4-digit code.');
        return;
      }

      setLookupLoading(true);

      try {
        const nextRecipient = await lookupRecipientByCode(session.access_token, walletCode);

        if (!nextRecipient?.wallet_code) {
          throw new Error('Invalid ID');
        }

        setRecipient(nextRecipient);
        setStep(2);
      } catch (nextError) {
        setError(nextError.message);
      } finally {
        setLookupLoading(false);
      }

      return;
    }

    if (step === 2) {
      if (!toPaisa(amount)) {
        setError('Enter a valid amount.');
        return;
      }

      setIdempotencyKey(createIdempotencyKey());
      setStep(3);
    }
  }

  async function handleConfirm() {
    setError('');
    setTransferLoading(true);

    try {
      const amountPaisa = toPaisa(amount);

      if (qrToken) {
        await transferMoneyByQr(session.access_token, {
          qrToken,
          amountPaisa,
          note,
          idempotencyKey,
        });
      } else {
        await transferMoneyByCode(session.access_token, {
          receiverCode: walletCode,
          amountPaisa,
          note,
          idempotencyKey,
        });
      }

      navigate('/wallet', {
        state: {
          notice: `Sent ${formatCurrencyFromPaisa(amountPaisa)} to ${recipient?.name || `Code ${walletCode}`}.`,
        },
      });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setTransferLoading(false);
    }
  }

  return (
    <div className="send-flow page-container">
      <header className="flow-header">
        <button className="back-btn" onClick={() => (step === 1 ? navigate('/wallet') : setStep(step - 1))}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h2>Send Money</h2>
        <div style={{ width: 20 }}></div>
      </header>

      {error ? <div className="send-error-banner">{error}</div> : null}

      {step === 1 ? (
        <div className="step-content">
          <label className="input-label">Enter 4-digit Raqam Code</label>
          <input
            type="text"
            inputMode="numeric"
            className="huge-input code-input"
            placeholder="0000"
            value={walletCode}
            onChange={(event) => setWalletCode(normalizeWalletCode(event.target.value))}
            autoFocus
          />
          <Link to="/scan" className="scan-shortcut">Scan QR instead</Link>
          <div className="bottom-action">
            <Button variant="primary" onClick={handleNext} disabled={walletCode.length !== 4 || lookupLoading}>
              {lookupLoading ? 'Checking Code...' : 'Next'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="step-content text-center">
          {lookupLoading ? <div className="send-lookup-state">Resolving QR recipient...</div> : null}

          {!lookupLoading ? (
            <>
              <div className="recipient-preview-card">
                <p className="sending-to">Sending to</p>
                <strong className="recipient-name">{recipient?.name}</strong>
                <span className="recipient-id">Code {recipient?.wallet_code}</span>
              </div>

              <div className="amount-wrapper">
                <span className="currency">PKR</span>
                <input
                  type="number"
                  className="huge-input amount-input"
                  placeholder="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  autoFocus
                />
              </div>

              <div className="note-group">
                <label className="input-label">Note (optional)</label>
                <input
                  type="text"
                  className="note-input"
                  placeholder="Cafe bill, dinner, etc."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>

              <div className="bottom-action">
                <Button variant="primary" onClick={handleNext} disabled={!amount}>
                  Review Payment
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="step-content">
          <div className="confirm-sheet">
            <h3 className="sheet-title">Confirm Transfer</h3>
            <div className="confirm-details">
              <div className="detail-row">
                <span>To</span>
                <span>{recipient?.name || 'Student'} (Code {walletCode})</span>
              </div>
              <div className="detail-row total-row">
                <span>Amount</span>
                <strong>{formatCurrencyFromPaisa(toPaisa(amount))}</strong>
              </div>
              <div className="detail-row">
                <span>Channel</span>
                <span>{qrToken ? 'QR Transfer' : 'Raqam Code'}</span>
              </div>
              <div className="detail-row">
                <span>Fee</span>
                <span>Free</span>
              </div>
            </div>
            <div className="bottom-action">
              <Button variant="primary" onClick={handleConfirm} disabled={transferLoading}>
                {transferLoading ? 'Sending...' : 'Confirm & Send'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
