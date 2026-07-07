# Tranche — Deal Screening Platform

Pre-origination deal screening for private credit analysts in asset-based lending, equipment finance, and inventory finance. Scores a deal across DSCR, leverage, LTV, industry risk, and other factors in under two minutes. Outputs pass/flag/fail verdict plus a committee-ready PDF.

Live at gettranche.app.

## Architecture

React 19 (Create React App) + Tailwind 4 (precompiled to `src/tailwind-compiled.css`) + Supabase (auth, postgres, RLS) + Vercel (web + serverless functions in `/api`) + Resend for email + FRED API for SOFR.

### Asset-class modules

Three modules under `src/modules/`, each exports the same shape:

- `equipment-finance/`
- `accounts-receivable/`
- `inventory-finance/`

Every module exports: `schema` (field definitions), `constants` (rate spreads, residuals, thresholds), `scoring` (calculateMetrics, calculateRiskScore, describeFactors, getRecommendation, generateCommentary, getSuggestedStructure, runStressTest, generateExportSummary, parseCsvDeals, isInputValid, getDefaultCovenants), and `index.js` re-exporting the public surface.

`getDefaultCovenants(inputs, metrics, criteria)` is the monitoring seed: it pre-fills a covenant set from the screening assumptions when a deal is funded. Asset-class-specific (term facilities seed no borrowing base; revolving AR/inventory do). Returns `CovenantSeed[]`. The shared evaluator and seed builders live in `src/lib/covenants.js`. See `Monitoring_Phase1_Design.md`.

When adding a new asset class, conform to this contract. Don't introduce module-specific code paths into shared components — instead extend the module shape.

### Key files

- `src/App.js` — top-level routing, auth, module switching. Currently 1,474 lines; split is on the roadmap.
- `src/lib/screeningCriteria.js` — pass/flag/fail evaluation. Default thresholds live here.
- `src/lib/supabase.js` — Supabase client wrapper.
- `src/components/DealInputForm.js` — the form on the left of the New Deal screen.
- `src/components/RiskRadarChart.js`, `RiskScoreGauge.js`, `ExecutiveSummary.js`, `MetricCard.js` — result-side visualizations.
- `src/components/DealPipeline.js` — kanban-style pipeline (Screening → Under Review → Approved → Funded → Declined).
- `src/components/ExportPanel.js` — committee PDF generation via html2pdf.
- `api/score-deal.js` — auth'd deal creation/rescore. JWT auth.
- `api/parse-deal.js` — deal sheet extraction (PDF/image → prefilled form inputs). JWT auth. Extraction logic and per-module field specs live in `server-lib/extract.js`; equipment-finance only for now. Requires `ANTHROPIC_API_KEY`. Extracted values prefill the form for analyst review; they are never scored or persisted directly.
- `api/v1.js` — public API. X-API-Key auth.
- `server-lib/validate.js` — server-side validation (equipment-finance only as of now).
- `Deal_Screening_Model_Assumptions.md` — the methodology spec. Scoring breakpoints, rate adjustments, thresholds. Treat as source of truth when code and doc disagree, then update one to match the other.

## Writing Style

- No em dashes in user-facing copy.
- Short sentences. Direct language. No filler.
- Sound like a credit professional, not a marketer.
- Avoid words: leverage (as verb), streamline, empower, robust, seamless, utilize.
- Prefer periods over semicolons. Commas over dashes.
- UI text scannable: 10 words max for labels, 20 words max for descriptions.
- "Pass / flag / fail" — those exact words, lowercase in body copy, uppercase in badges.

## UI/Design

Light theme. White/cream background (`bg-[#f8f9fa]`), black text, gold (#D4A843) reserved for primary actions only. Cards have subtle borders, not glass effects. Information hierarchy: primary (black/gold), secondary (gray-600), tertiary (gray-400).

- White space is a feature, not wasted space.
- Every screen has ONE clear primary action. Secondary actions hide behind menus or collapsed sections.
- Scoring/recommendation modules should return semantic categories (e.g., `'strong' | 'moderate'`), not Tailwind classes. Presentation maps category → classes in the component layer. (See AUDIT.md P1-3 for the current violation of this rule.)
- The radar chart, risk gauge, executive summary, and metric cards are the four pillars of the results view. Don't compete with them visually.

## Testing

Tests live alongside source as `*.test.js`. Use React Testing Library + Jest (already wired via react-scripts). Highest-value tests cover scoring modules and threshold evaluation. App.js logic is undertested; treat that as known gap.

When adding scoring logic, add a test. When changing a threshold, update the spec doc AND the test.

## Things Not to Do

- Don't add em dashes to user-facing copy.
- Don't put Tailwind class strings inside scoring/business-logic modules.
- Don't trust client-supplied scores on the server (see AUDIT.md P0-1).
- Don't import `recharts`, `html2pdf`, or `exceljs` outside of components that need them — they're big and should stay lazy-loaded.
- Don't write to `pipeline_deals` without writing the matching `audit_log` entry.
- Don't add new asset-class behavior to App.js or shared components. Put it in `src/modules/<asset-class>/`.

## Active Migrations and Refactors

- **TypeScript migration:** tsconfig is set up with `allowJs: true`, `strict: false`. Phase 1 starts with `src/types.ts` and `src/utils/format.ts`. See AUDIT.md.
- **Threshold consolidation:** several inconsistencies between `screeningCriteria.js`, scoring modules, and exported PDF copy. Source of truth should be `DEFAULT_CRITERIA` per module.
- **App.js split:** plan is route-level components (LandingRoute, NewDealRoute, PipelineRoute, DashboardRoute) + a `useDealScoring(inputs)` hook.

See AUDIT.md for the full punch list.
