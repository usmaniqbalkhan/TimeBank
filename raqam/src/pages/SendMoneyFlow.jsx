import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  createIdempotencyKey,
  lookupRecipientByCode,
  lookupRecipientByQr,
  transferMoneyByCode,
  transferMoneyByQr,
} from '../lib/supabase';
import { normalizeWalletCode, toPaisa, getInitials } from '../lib/formatters';
import { I } from '../lib/icons';

const STEPS = {
  METHOD: 0,
  CODE: 1,
  AMOUNT: 2,
  CONFIRM: 3,
  SUCCESS: 4,
};

const AVATAR_VARIANTS = ['tb-avatar--violet', 'tb-avatar--amber', 'tb-avatar--green', 'tb-avatar--red'];

function avatarVariantFor(code = '') {
  const sum = String(code).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_VARIANTS[sum % AVATAR_VARIANTS.length];
}

function formatRupees(paisa) {
  return new Intl.NumberFormat('en-PK').format(Math.round(Number(paisa || 0) / 100));
}

export default function SendMoneyFlow() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQrToken = searchParams.get('qr') || '';
  const initialCode = normalizeWalletCode(searchParams.get('recipient') || '');

  const startStep = initialQrToken
    ? STEPS.AMOUNT
    : (initialCode.length === 4 ? STEPS.AMOUNT : STEPS.METHOD);

  const [step, setStep] = useState(startStep);
  const [walletCode, setWalletCode] = useState(initialCode);
  const [qrToken] = useState(initialQrToken);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recipient, setRecipient] = useState(null);
  const [error, setError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(Boolean(initialQrToken));
  const [transferLoading, setTransferLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey());

  // Hydrate recipient if we arrived with a qr= or recipient= param
  useEffect(() => {
    let active = true;
    async function hydrate() {
      if (!session?.access_token) return;
      try {
        if (initialQrToken) {
          const next = await lookupRecipientByQr(session.access_token, initialQrToken);
          if (!next?.wallet_code) throw new Error('Invalid QR code.');
          if (active) {
            setRecipient(next);
            setWalletCode(next.wallet_code);
          }
        } else if (initialCode.length === 4) {
          const next = await lookupRecipientByCode(session.access_token, initialCode);
          if (!next?.wallet_code) throw new Error('Invalid code.');
          if (active) setRecipient(next);
        }
      } catch (nextError) {
        if (active) {
          setError(nextError.message);
          setStep(STEPS.METHOD);
        }
      } finally {
        if (active) setLookupLoading(false);
      }
    }
    hydrate();
    return () => { active = false; };
  }, [initialQrToken, initialCode, session]);

  function handleBack() {
    setError('');
    if (step === STEPS.METHOD || step === STEPS.SUCCESS) {
      navigate('/wallet');
      return;
    }
    if (step === STEPS.AMOUNT && qrToken) {
      navigate('/wallet');
      return;
    }
    setStep((s) => s - 1);
  }

  async function handleCodeNext() {
    setError('');
    if (walletCode.length !== 4) {
      setError('Enter a valid 4-digit code.');
      return;
    }
    setLookupLoading(true);
    try {
      const next = await lookupRecipientByCode(session.access_token, walletCode);
      if (!next?.wallet_code) throw new Error('Code not found');
      setRecipient(next);
      setStep(STEPS.AMOUNT);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLookupLoading(false);
    }
  }

  function handleAmountNext() {
    setError('');
    if (!toPaisa(amount)) {
      setError('Enter a valid amount.');
      return;
    }
    setIdempotencyKey(createIdempotencyKey());
    setStep(STEPS.CONFIRM);
  }

  async function handleConfirm() {
    setError('');
    setTransferLoading(true);
    try {
      const amountPaisa = toPaisa(amount);
      if (qrToken) {
        await transferMoneyByQr(session.access_token, {
          qrToken, amountPaisa, note, idempotencyKey,
        });
      } else {
        await transferMoneyByCode(session.access_token, {
          receiverCode: walletCode, amountPaisa, note, idempotencyKey,
        });
      }
      setStep(STEPS.SUCCESS);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setTransferLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────
  // STEP 0 — Method picker
  // ────────────────────────────────────────────────────────────
  if (step === STEPS.METHOD) {
    return (
      <div className="tb-screen">
        <div className="tb-status-spacer" />
        <div className="tb-app-bar">
          <button className="tb-back" onClick={handleBack}>{I.arrowLeft()}</button>
          <div className="tb-app-bar__title">Send money</div>
          <div style={{ width: 40 }} />
        </div>

        <div style={{ flex: 1, padding: '12px 22px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ marginTop: 4 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, margin: 0 }}>
              How do you want to <span className="ital" style={{ color: 'var(--tb-violet-deep)' }}>pay?</span>
            </h2>
            <p style={{ fontSize: 14, color: 'var(--tb-muted)', marginTop: 8 }}>
              Pick a 4-digit code or scan a live QR. Both settle atomically.
            </p>
          </div>

          {error ? <div className="tb-banner tb-banner--error" style={{ margin: 0 }}>{error}</div> : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              onClick={() => setStep(STEPS.CODE)}
              style={{
                padding: 20, borderRadius: 22, background: 'linear-gradient(160deg, #2a0d6b 0%, #6f3ff5 100%)',
                border: 0, color: '#fff', textAlign: 'left', boxShadow: 'var(--tb-shadow-violet)', minHeight: 180,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {I.hash({ width: 22, height: 22 })}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>Enter code</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>Type your friend's 4-digit wallet code</div>
              </div>
            </button>

            <Link
              to="/scan"
              style={{
                padding: 20, borderRadius: 22, background: '#fff', border: '1px solid var(--tb-line)',
                textAlign: 'left', minHeight: 180,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--tb-violet-soft)', color: 'var(--tb-violet-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {I.qr({ width: 22, height: 22 })}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>Scan QR</div>
                <div style={{ fontSize: 12, color: 'var(--tb-muted)', lineHeight: 1.4 }}>Point your camera, confirm and send</div>
              </div>
            </Link>
          </div>

          <div className="tb-list-card" style={{ flex: 1 }}>
            <div className="tb-list-head"><span>Tips</span></div>
            <div style={{ fontSize: 13, color: 'var(--tb-muted)', lineHeight: 1.5 }}>
              Wallet codes are 4 digits — your friend can show them on the <strong style={{ color: 'var(--tb-ink)' }}>Receive</strong> screen or via QR. Transfers settle in under a second.
            </div>
          </div>
        </div>
        <div className="tb-home-spacer" />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // STEP 1 — Enter code (numpad)
  // ────────────────────────────────────────────────────────────
  if (step === STEPS.CODE) {
    const digits = [walletCode[0] || null, walletCode[1] || null, walletCode[2] || null, walletCode[3] || null];
    const cursorIdx = walletCode.length;

    function press(n) {
      if (walletCode.length >= 4) return;
      setWalletCode((c) => (c + String(n)).slice(0, 4));
    }
    function backspace() {
      setWalletCode((c) => c.slice(0, -1));
    }

    return (
      <div className="tb-screen">
        <div className="tb-status-spacer" />
        <div className="tb-app-bar">
          <button className="tb-back" onClick={handleBack}>{I.arrowLeft()}</button>
          <div style={{ textAlign: 'center' }}>
            <div className="tb-app-bar__title">Enter wallet code</div>
            <div className="tb-app-bar__sub">Step 1 of 3</div>
          </div>
          <div style={{ width: 40 }} />
        </div>

        <div style={{ flex: 1, padding: '20px 22px 0', display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: 14, color: 'var(--tb-muted)', marginBottom: 22, textAlign: 'center' }}>
            Your friend's wallet code lives on their <strong style={{ color: 'var(--tb-ink)' }}>Receive</strong> screen.
          </p>

          {error ? <div className="tb-banner tb-banner--error" style={{ margin: '0 0 14px' }}>{error}</div> : null}

          <div className="tb-digits">
            {digits.map((d, i) => (
              <div key={i} className={'tb-digit' + (d ? ' filled' : '') + (d === null && i === cursorIdx ? ' cursor' : '')}>
                {d ?? ''}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--tb-muted)', fontSize: 12 }}>
            {I.shieldCheck({ width: 14, height: 14, style: { color: 'var(--tb-green-deep)' } })}
            {walletCode.length === 4
              ? <>Ready to lookup <span className="mono" style={{ color: 'var(--tb-ink)', fontWeight: 700 }}>{walletCode}</span></>
              : <>Looking up <span className="mono" style={{ color: 'var(--tb-ink)', fontWeight: 700 }}>{walletCode.padEnd(4, '_')}</span></>}
          </div>

          <div style={{ marginTop: 'auto', paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="tb-numpad">
              {[1,2,3,4,5,6,7,8,9].map((n) => (
                <button key={n} type="button" className="tb-key" onClick={() => press(n)}>{n}</button>
              ))}
              <Link to="/scan" className="tb-key tb-key--alt" style={{ display: 'flex' }}>{I.qr({ width: 20, height: 20 })}</Link>
              <button type="button" className="tb-key" onClick={() => press(0)}>0</button>
              <button type="button" className="tb-key tb-key--alt" onClick={backspace}>{I.backspace()}</button>
            </div>

            <button
              className="tb-btn tb-btn--violet"
              onClick={handleCodeNext}
              disabled={walletCode.length !== 4 || lookupLoading}
            >
              {lookupLoading ? 'Checking code…' : <>Continue {I.arrowRight({ width: 16, height: 16 })}</>}
            </button>
          </div>
        </div>

        <div className="tb-home-spacer" />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // STEP 2 — Enter amount
  // ────────────────────────────────────────────────────────────
  if (step === STEPS.AMOUNT) {
    const variant = avatarVariantFor(recipient?.wallet_code || walletCode);

    return (
      <div className="tb-screen">
        <div className="tb-status-spacer" />
        <div className="tb-app-bar">
          <button className="tb-back" onClick={handleBack}>{I.arrowLeft()}</button>
          <div style={{ textAlign: 'center' }}>
            <div className="tb-app-bar__title">Enter amount</div>
            <div className="tb-app-bar__sub">Step 2 of 3</div>
          </div>
          <div style={{ width: 40 }} />
        </div>

        <div style={{ flex: 1, padding: '14px 22px 0', display: 'flex', flexDirection: 'column' }}>

          {lookupLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--tb-muted)' }}>
              Resolving recipient…
            </div>
          ) : (
            <>
              <div className="tb-recip" style={{ marginBottom: 22 }}>
                <div className={'tb-avatar ' + variant}>
                  {getInitials(recipient?.name || '??') || '??'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="tb-recip__name">{recipient?.name || 'Student'}</div>
                  <div className="tb-recip__sub">
                    Code <span className="tb-recip__code">{recipient?.wallet_code || walletCode}</span>
                    {qrToken ? ' · via QR' : ' · Verified student'}
                  </div>
                </div>
                {!qrToken ? (
                  <button onClick={() => setStep(STEPS.CODE)} style={{ fontSize: 12, color: 'var(--tb-violet-deep)', fontWeight: 600 }}>Change</button>
                ) : null}
              </div>

              {error ? <div className="tb-banner tb-banner--error" style={{ margin: '0 0 14px' }}>{error}</div> : null}

              <div style={{ textAlign: 'center', padding: '10px 0 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--tb-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Sending</div>
                <div style={{
                  marginTop: 14, fontSize: 64, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1,
                  display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8
                }}>
                  <span style={{ fontSize: 22, color: 'var(--tb-muted)', fontWeight: 500 }}>PKR</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="0"
                    autoFocus
                    style={{
                      border: 0, outline: 'none', background: 'transparent',
                      font: 'inherit', color: 'var(--tb-ink)', textAlign: 'center',
                      width: `${Math.max(1, (amount || '0').length)}ch`, maxWidth: 220,
                      letterSpacing: '-0.05em',
                    }}
                  />
                </div>
                <div style={{ marginTop: 12, color: 'var(--tb-muted)', fontSize: 12 }}>
                  Quick add
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '8px 0 18px', flexWrap: 'wrap' }}>
                {['100', '500', '1000', '2500'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="tb-chip"
                    onClick={() => setAmount((cur) => String((Number(cur) || 0) + Number(v)))}
                  >
                    <span className="mono" style={{ fontSize: 12 }}>+{Number(v).toLocaleString('en-PK')}</span>
                  </button>
                ))}
              </div>

              <div>
                <label className="tb-input-label">Add a note (optional)</label>
                <input
                  className="tb-input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Cafe bill, dinner, etc."
                />
              </div>

              <div style={{ marginTop: 'auto', paddingBottom: 14 }}>
                <button
                  className="tb-btn tb-btn--violet"
                  onClick={handleAmountNext}
                  disabled={!toPaisa(amount)}
                >
                  Review transfer {I.arrowRight({ width: 16, height: 16 })}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="tb-home-spacer" />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // STEP 3 — Review & confirm (slide-to-send)
  // ────────────────────────────────────────────────────────────
  if (step === STEPS.CONFIRM) {
    const variant = avatarVariantFor(recipient?.wallet_code || walletCode);
    const paisa = toPaisa(amount);

    return (
      <div className="tb-screen">
        <div className="tb-status-spacer" />
        <div className="tb-app-bar">
          <button className="tb-back" onClick={handleBack}>{I.arrowLeft()}</button>
          <div style={{ textAlign: 'center' }}>
            <div className="tb-app-bar__title">Review &amp; confirm</div>
            <div className="tb-app-bar__sub">Step 3 of 3</div>
          </div>
          <div style={{ width: 40 }} />
        </div>

        <div style={{ flex: 1, padding: '14px 22px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ textAlign: 'center', padding: '14px 0 4px' }}>
            <div style={{ fontSize: 11, color: 'var(--tb-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>You're sending</div>
            <div style={{ marginTop: 12, fontSize: 56, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 20, color: 'var(--tb-muted)', fontWeight: 500 }}>PKR</span>
              {formatRupees(paisa)}
              <span style={{ fontSize: 28, color: 'var(--tb-muted)' }}>.00</span>
            </div>
          </div>

          {error ? <div className="tb-banner tb-banner--error" style={{ margin: 0 }}>{error}</div> : null}

          <div className="tb-recip">
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--tb-violet-soft)', color: 'var(--tb-violet-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 40px' }}>
              {I.arrowRight({ width: 18, height: 18 })}
            </div>
            <div style={{ flex: 1 }}>
              <div className="tb-recip__sub" style={{ marginBottom: 2 }}>To</div>
              <div className="tb-recip__name">{recipient?.name || 'Student'}</div>
              <div className="tb-recip__sub">Code <span className="tb-recip__code">{recipient?.wallet_code || walletCode}</span></div>
            </div>
            <div className={'tb-avatar ' + variant}>{getInitials(recipient?.name || '??') || '??'}</div>
          </div>

          <div className="tb-list-card">
            <div className="tb-ledger">
              <div className="tb-ledger__label">Channel</div><div /><div className="tb-ledger__value">{qrToken ? 'QR' : 'Wallet code'}</div>
            </div>
            {note ? (
              <div className="tb-ledger">
                <div className="tb-ledger__label">Note</div><div /><div className="tb-ledger__value">{note}</div>
              </div>
            ) : null}
            <div className="tb-ledger">
              <div className="tb-ledger__label">Fee</div><div /><div className="tb-ledger__value" style={{ color: 'var(--tb-green-deep)' }}>FREE</div>
            </div>
            <div className="tb-ledger">
              <div className="tb-ledger__label">Total</div><div /><div className="tb-ledger__value" style={{ fontSize: 16 }}>PKR {formatRupees(paisa)}.00</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="tb-chip">{I.lock({ width: 14, height: 14 })} Atomic</span>
            <span className="tb-chip">{I.shieldCheck({ width: 14, height: 14 })} Locked</span>
            <span className="tb-chip">{I.zap()} Instant</span>
          </div>

          <div style={{ marginTop: 'auto', paddingBottom: 14 }}>
            <SlideToConfirm
              label={transferLoading ? 'Sending…' : `Slide to send PKR ${formatRupees(paisa)}`}
              disabled={transferLoading}
              onConfirm={handleConfirm}
            />
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--tb-muted)', textAlign: 'center', display: 'inline-flex', gap: 6, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
              {I.shieldCheck({ width: 12, height: 12, style: { color: 'var(--tb-green-deep)' } })}
              Locked with idempotency key <span className="mono">{idempotencyKey.slice(0, 8)}…{idempotencyKey.slice(-3)}</span>
            </div>
          </div>
        </div>
        <div className="tb-home-spacer" />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // STEP 4 — Success
  // ────────────────────────────────────────────────────────────
  const paisa = toPaisa(amount);
  return (
    <div className="tb-screen" style={{ background: 'linear-gradient(180deg, #f6f4ef 0%, #ece5ff 100%)' }}>
      <div className="tb-status-spacer" />

      <div style={{ position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)',
        width: 360, height: 360, background: 'radial-gradient(circle, rgba(25,192,142,0.18) 0%, transparent 60%)',
        filter: 'blur(20px)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="tb-back" onClick={() => navigate('/wallet')}>{I.close()}</button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div className="tb-success">
            {I.check({ width: 52, height: 52, strokeWidth: 2.8 })}
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--tb-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Sent successfully</div>
            <div style={{ marginTop: 12, fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 20, color: 'var(--tb-muted)', fontWeight: 500 }}>PKR</span>
              {formatRupees(paisa)}
              <span style={{ fontSize: 26, color: 'var(--tb-muted)' }}>.00</span>
            </div>
            <div style={{ marginTop: 14, color: 'var(--tb-muted)', fontSize: 14 }}>
              to <strong style={{ color: 'var(--tb-ink)' }}>{recipient?.name || 'Student'}</strong>
              {' · '}Code <span className="mono" style={{ color: 'var(--tb-violet-deep)', fontWeight: 700 }}>{recipient?.wallet_code || walletCode}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="tb-chip tb-chip--violet">{I.zap()} Settled</span>
            <span className="tb-chip tb-chip--violet">{I.shieldCheck({ width: 14, height: 14 })} Atomic</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14 }}>
          <button className="tb-btn tb-btn--violet" onClick={() => navigate('/wallet')}>
            Back to wallet {I.arrowRight({ width: 16, height: 16 })}
          </button>
          <button className="tb-btn tb-btn--ghost" onClick={() => { setStep(STEPS.METHOD); setAmount(''); setNote(''); setWalletCode(''); setRecipient(null); }}>
            Send another
          </button>
        </div>
      </div>
      <div className="tb-home-spacer" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SlideToConfirm
// ────────────────────────────────────────────────────────────
function SlideToConfirm({ label, onConfirm, disabled }) {
  const trackRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function start(clientX) {
    if (disabled || confirmed) return;
    const rect = trackRef.current.getBoundingClientRect();
    setDragging(true);
    const origin = clientX - rect.left;

    function move(ev) {
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
      const max = rect.width - 60;
      setDragX(Math.max(0, Math.min(max, x - origin + dragX)));
    }
    function end(ev) {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchend', end);
      setDragging(false);
      const x = (ev.changedTouches ? ev.changedTouches[0].clientX : ev.clientX) - rect.left;
      const max = rect.width - 60;
      const finalX = Math.max(0, Math.min(max, x - origin + dragX));
      if (finalX > max * 0.85) {
        setDragX(max);
        setConfirmed(true);
        onConfirm?.();
      } else {
        setDragX(0);
      }
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
  }

  const fillPct = trackRef.current
    ? Math.min(100, (dragX / (trackRef.current.getBoundingClientRect().width - 60)) * 100)
    : 0;

  return (
    <div
      ref={trackRef}
      className={'tb-slide' + (dragging || confirmed ? ' dragging' : '')}
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      <div className="tb-slide__fill" style={{ width: `${fillPct + 12}%` }} />
      <div
        className="tb-slide__thumb"
        style={{ transform: dragX > 0 ? `translateX(${dragX}px)` : undefined, animation: (dragging || dragX > 0) ? 'none' : undefined }}
        onMouseDown={(e) => start(e.clientX)}
        onTouchStart={(e) => start(e.touches[0].clientX)}
      >
        {I.arrowRight({ width: 16, height: 16 })}
      </div>
      <span className="tb-slide__label" style={{ marginLeft: 30, opacity: fillPct > 30 ? 0.6 : 1 }}>{label}</span>
    </div>
  );
}
