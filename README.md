# Timebank

> A campus wallet built around **4-digit codes**. Send, receive and split tabs in milliseconds — no account numbers, no IBANs, just four digits.

**Live demo:** [time-bank-ten.vercel.app](https://time-bank-ten.vercel.app)

Timebank is a university wallet simulation built as an Advanced Database Management Systems project. Every student gets a public 4-digit wallet code (`0000`–`9999`), a starting balance of `PKR 10,000`, and a live QR token. Transfers settle atomically on a single ledger with idempotency keys so the same request can't double-charge.

---

## Features

- 🪪 **4-digit wallet codes** — every wallet has a unique public identity from `0000` to `9999`
- 💸 **Send by code or QR** — type a friend's 4-digit code or point your camera at their QR
- ⚡ **Atomic, idempotent transfers** — debit + credit in a single SQL transaction, locked with a client-generated idempotency key so retries are safe
- 📊 **Live overview** — balance, recent activity, money-in / transactions / top-contact stats, and a 7-day net-flow sparkline that polls every 10 seconds
- 🔔 **Notifications + Activity sheets** — bottom-sheet panels for transaction history (with All / Received / Sent filters) and notification feed
- 👤 **Profile sheet** — name, email, wallet code, sign-out
- 💬 **Help & contact** floating button — opens the support sheet
- 📱 **Fully responsive** — mobile uses a phone-style frame with a bottom tab bar; desktop uses a top nav + a 240px sidebar with a 2-column main area

---

## Tech stack

| Layer | Tech |
| --- | --- |
| **Frontend** | React 19 · React Router 7 · Vite 8 · vanilla CSS (custom design system in `src/index.css`) |
| **Backend** | Supabase — Postgres + Auth + Row-Level Security |
| **Transactions** | Server-side RPC (`transfer_money_by_code`, `transfer_money_by_qr`) inside a single SQL transaction with idempotency keys |
| **QR** | Native `BarcodeDetector` API for scanning · `api.qrserver.com` for QR generation |
| **Hosting** | Vercel (auto-deploy from `main`) |

---

## Local development

```bash
cd raqam
cp .env.example .env       # add your Supabase keys
npm install
npm run dev
```

Required env vars in `raqam/.env`:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Apply the SQL migration in `raqam/supabase/migrations/001_initial_schema.sql` against your Supabase project before signing up.

---

## Routes

| Path | What it shows |
| --- | --- |
| `/` | Landing — desktop hero with phone preview + features grid; mobile splash with CTAs |
| `/signup`, `/login` | Auth — centered card on desktop, full-screen form on mobile |
| `/wallet` | Home dashboard — violet balance card with code pill + Transfer/Receive pills, action grid, Money-in / Transactions / Top contact stat cards, live 7-day net-flow chart, recent activity |
| `/send` | 5-step wizard: Method picker → 4-digit code (numpad) → Amount (quick-add chips) → Confirm (slide-to-send + ledger card) → Success (green pop ring) |
| `/receive` | QR card with brand cube center logo + 4-digit code panel + Copy/Share |
| `/scan` | Camera scanner with violet scanline + manual 4-digit fallback |

---

## Project structure

```
.
├── docs/
│   ├── PRD.md            ← Product requirements
│   └── DESIGN.md         ← Design system notes
├── raqam/                ← Vite React app
│   ├── public/           ← favicon, static assets
│   ├── src/
│   │   ├── components/   ← DesktopNav, ProtectedRoute, PublicRoute
│   │   ├── context/      ← AuthProvider
│   │   ├── hooks/        ← useAuth
│   │   ├── lib/          ← icons (TBLogo + I.* line icons), formatters, supabase RPC client
│   │   ├── pages/        ← LandingPage, AuthPage, WalletDashboard, SendMoneyFlow, ReceiveMoney, ScanQR
│   │   ├── App.jsx       ← Router + DesktopNav
│   │   ├── main.jsx      ← Entry point
│   │   └── index.css     ← Full Timebank design system + responsive media queries
│   ├── supabase/
│   │   └── migrations/   ← Postgres schema + RPC functions
│   ├── index.html
│   ├── package.json
│   └── vercel.json
└── README.md
```

---

## Design system

Timebank uses a custom design system defined entirely in `raqam/src/index.css` — no Tailwind, no UI library.

- **Palette** — violet primary (`#6f3ff5`), cream paper (`#f6f4ef`), coal ink (`#0a0a0c`), peach accents
- **Typography** — Plus Jakarta Sans (display, 700/800), Instrument Serif (italic accents), JetBrains Mono (codes)
- **Components** — `.tb-balance`, `.tb-actions`, `.tb-tabs`, `.tb-digit`, `.tb-numpad`, `.tb-recip`, `.tb-qr`, `.tb-slide`, `.tb-success`, `.tb-tabbar`, `.tb-chip`, `.tb-banner`, `.tb-stats-grid`, `.tb-sparkline`, …
- **Icons** — line-style 24×24 SVGs in `raqam/src/lib/icons.jsx`, exposed as `I.arrowRight`, `I.shieldCheck`, etc., plus a stacked-cube `TBLogo` component

---

## Architecture notes

**Idempotent transfers.** Every send generates a UUID idempotency key on the client. The server checks for an existing transaction with the same key before issuing the debit + credit. Network retries can never double-charge.

**Atomic ledger.** `transfer_money_by_code` and `transfer_money_by_qr` run inside a single Postgres transaction — either both wallets update or neither does.

**RLS-protected reads.** The wallet, transactions and profile tables enforce Row-Level Security so users only ever see their own data. The dashboard polls `get_wallet_dashboard` every 10 seconds for live updates.

**QR backward compatibility.** The frontend's `normalizeQrPayload` accepts both `timebank:<token>` (current) and `raqam:<token>` (legacy) prefixes so QR codes already in circulation keep working through the rename.

---

## Deployment

Pushing to `main` triggers a Vercel build. The `vercel.json` in `raqam/` rewrites every path to `/index.html` so React Router handles client-side routing.

---

## Credits

Built by [Usman Iqbal Khan](https://github.com/usmaniqbalkhan) for Advanced Database Management Systems coursework.
