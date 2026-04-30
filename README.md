# Tranche

Pre-origination deal screening for asset-based lenders. Score a deal across DSCR, leverage, LTV, industry risk, and three other factors in under two minutes. Pass/flag/fail verdict plus a committee-ready PDF.

Live: [gettranche.app](https://gettranche.app)

## Stack

- React 19 (Create React App)
- Tailwind (compiled to `src/tailwind-compiled.css` for Vercel build compatibility)
- Recharts for visualizations
- Supabase for auth, postgres, and RLS
- Vercel for hosting (web + serverless functions in `/api`)
- Resend for transactional email

## Local development

```bash
npm install
cp .env.example .env
# fill in REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY
npm start
```

App runs on `http://localhost:3000`.

To explore without setting up Supabase, append `?demo=1` to the URL. Demo mode runs entirely in memory with seeded pipeline data.

## Project layout

```
api/                    Vercel serverless functions (Stripe, notifications, public API)
public/                 Static assets, brand mark, OG image
server-lib/             Shared server-only utilities (auth, rate limit, CORS)
src/
  App.js                Top-level routing and authenticated layout
  components/           UI components
  contexts/             React contexts (Auth, Tutorial, Toast)
  data/                 Static seed data (demo pipeline, historical, examples)
  hooks/                Custom hooks
  lib/                  Client-side libraries (supabase client, scoring helpers, demo mode)
  modules/              Asset-class modules (equipment-finance, accounts-receivable, inventory)
  utils/                Formatting and shared utilities
```

## Deployment

Hosted on Vercel. Push to `main` triggers auto-deploy.

Environment variables required in Vercel:

- `REACT_APP_SUPABASE_URL` — public, used by the browser client
- `REACT_APP_SUPABASE_ANON_KEY` — public
- `SUPABASE_SERVICE_ROLE_KEY` — secret, server-side only (used by `api/*` routes)
- `RESEND_API_KEY` — secret, for outbound notifications
- `FRED_API_KEY` — for SOFR rate fetching in `api/sofr.js`

Optional (Stripe, currently dormant):

- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`, `STRIPE_WEBHOOK_SECRET`

## Status

Active development. Not yet open for self-service signup. Pilot inquiries: `team@gettranche.app`.
