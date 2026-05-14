# Timebank

A campus wallet built around **4-digit codes**. Send, receive and split tabs in milliseconds.

Built with **React 19 + Vite 8 + Supabase**.

## Local dev

```bash
cp .env.example .env       # add your Supabase keys
npm install
npm run dev
```

## Stack

- React 19 + React Router 7
- Vite 8 build
- Supabase (Postgres + Auth + RLS) — schema in `supabase/migrations/`
- BarcodeDetector API for live QR scanning

## Design system

The UI uses a custom Timebank design system in `src/index.css`:

- **Palette** — violet primary (`#6f3ff5`), cream paper (`#f6f4ef`), coal ink (`#0a0a0c`)
- **Type** — Plus Jakarta Sans (display), Instrument Serif (accent italic), JetBrains Mono (codes)
- **Components** — `.tb-balance`, `.tb-action`, `.tb-tabs`, `.tb-digit`, `.tb-numpad`, `.tb-recip`, `.tb-qr`, `.tb-slide` …

Icons are line-style 24×24 SVGs in `src/lib/icons.jsx` exposed as `I.arrowRight`, `I.shieldCheck`, etc.

## Routes

| Path | Screen |
| --- | --- |
| `/` | Welcome landing |
| `/signup`, `/login` | Auth (tabbed) |
| `/wallet` | Dashboard with balance + activity |
| `/send` | Method → Code → Amount → Confirm → Success wizard |
| `/receive` | QR + 4-digit code share |
| `/scan` | Camera scanner with manual fallback |
