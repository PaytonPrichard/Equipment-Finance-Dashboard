# Tranche Audit — May 2026

First pass audit by Claude. Read top-to-bottom or jump to a section. Every item has a file:line reference and a recommended action.

Severity tiers:

- **P0** — correctness or security. Fix before next pilot.
- **P1** — architecture, consistency, dead code. Fix in the next refactor cycle.
- **P2** — polish, smells, nice-to-haves.

---

## Snapshot

113 JS files, ~23,400 lines, zero TS files. React 19 / CRA / Tailwind 4 / Supabase / Vercel serverless. Asset-class modular architecture (`equipment-finance`, `accounts-receivable`, `inventory-finance`) each exporting the same shape. Live at gettranche.app. TypeScript 4.9 and tsconfig.json present but unused. CLAUDE.md exists but describes a stale dark theme.

---

## P0 — Correctness and Security

### P0-1. Score is client-supplied to the API, not server-computed

`api/score-deal.js:76, 84-85` and `api/v1.js:54` accept `score` from the request body and write it directly to `pipeline_deals.score`. The server never recomputes the score from inputs. A bad actor with a valid API key or JWT can POST `{ score: 100 }` against any deal and the pipeline view will display it as a pass.

**Why this matters.** Tranche markets itself as a screening tool — the score is the product. If the score isn't authoritative, the audit log, webhooks, and committee PDF are all undermined. A pilot customer who learns this finds out they've been auditing analyst-submitted numbers, not platform-computed ones.

**Fix.** Move scoring to the server. Either:
1. Server-side: import the scoring module in `api/score-deal.js`, recompute `metrics + riskScore` from `inputs`, ignore client-sent `score`, return the authoritative score in the response. Client uses the response for display.
2. Or, if you want to keep client computation for the live-updating UI: server still recomputes on POST/PATCH and compares; reject if client and server disagree by more than rounding.

Same module structure works for both — `src/modules/equipment-finance/scoring.js` is pure functions, fine to import into a Node serverless function.

### P0-2. Server validation only covers equipment finance

`server-lib/validate.js:43` (`validateDealInputs`) only validates equipment-finance fields (equipmentCost, downPayment, financingType, usefulLife, loanTerm, essentialUse, etc.). AR and inventory deals hit `/api/score-deal` and `/api/v1?resource=deals` with no schema check — `inputs` is accepted as long as it's `typeof === 'object'`.

**Risk.** AR with negative concentration, inventory with NaN turnover, dilution rates of -50%, etc. all get persisted and re-rendered. Also nothing limits the size of `inputs` — a 50MB JSON object will be accepted and stored.

**Fix.** Build `validateARInputs` and `validateInventoryInputs` in `server-lib/`. Better: switch to a schema library (Zod or Valibot) and define the schemas once in `src/modules/*/schema.js`, then import on both client and server. This is exactly the kind of refactor TypeScript + Zod is designed for.

### P0-3. Threshold inconsistencies between screening criteria, code, and exported PDF

Three concrete examples found:

**(a) Equipment term coverage.** `src/lib/screeningCriteria.js:21` flags at `maxTermCoverage = 80`. `src/modules/equipment-finance/scoring.js:339` flags commentary at >80%. But the exported PDF at `scoring.js:516` writes `(target <60%)`. So the analyst gets a PDF that tells the committee the target is 60% while the platform actually evaluates against 80%.

**(b) Equipment revenue concentration.** `scoring.js:517` writes `(target <15%)` in the PDF. Commentary only flags at >25% (`scoring.js:346`). Same mismatch shape.

**(c) AR DSCR floor.** `src/modules/accounts-receivable/scoring.js:570` writes `(min 1.10x for ABL)` in the PDF. But `screeningCriteria.js:14` uses `minDscr: 1.25` as the default for all modules. A deal at DSCR 1.18 will get flagged by the platform but the PDF tells the analyst 1.10 is the floor.

**Fix.** Choose one source of truth per module — recommend `DEFAULT_CRITERIA` in `screeningCriteria.js`, but per-module (since AR and equipment have different operating ranges). Have the export-summary functions read from there instead of hardcoding strings. Then audit every threshold mention against that source.

### P0-4. Equipment condition bonus disagrees with the spec

`Deal_Screening_Model_Assumptions.md:186` and line 221 both state "+8 bonus points" for new equipment. `src/modules/equipment-finance/scoring.js:179` sets `conditionBonus = 12`. The doc you'd hand a prospect says +8, the code applies +12.

Joel flagged this as a judgment call — leaving both in place for now. Action: decide with someone who knows the calibration history whether code or spec is right, then unify.

### P0-5. `inputs` JSON has no max size on any endpoint

`api/score-deal.js:81-83` and `api/v1.js:53` validate `typeof inputs === 'object'` only. No body size limit beyond Vercel's default (~4.5MB for serverless function bodies, which is already generous for a few financial fields). A malicious or buggy client can write multi-megabyte JSON into `pipeline_deals.inputs`.

**Fix.** After the schema validation in P0-2, also enforce a max object key count and stringified size (e.g., reject if `JSON.stringify(inputs).length > 32KB`). Cheap defense-in-depth.

### P0-6. Billing flow only works for one of three tiers, and writes the wrong plan back

Found during the front-end polish pass (surface 1). The pricing UI offers three tiers, but the checkout and webhook code only handle the middle one, under a legacy `pro` key.

**(a) Analyst and Enterprise checkout are dead buttons.** `api/checkout.js:57` lists all six plan ids in `VALID_PLANS`, but `priceMap` (`:63-66`) only defines `pro_monthly` and `pro_annual`. Clicking Upgrade on Analyst sends `analyst_monthly`, passes validation, then hits `priceMap['analyst_monthly'] === undefined` and returns "Unknown plan" at `:70`. Same for Enterprise. Only Team (using the legacy `pro_*` ids) reaches Stripe.

**(b) The webhook hardcodes `pro` for every purchase.** `api/webhook.js:57` writes `plan: 'pro', max_users: 25` on every `checkout.session.completed`, ignoring which tier was bought. Consequences: the written `pro` matches no `BillingPage` key (`analyst`/`team`/`enterprise`), so "Current Plan" never highlights and a paid user can re-buy; seat count is wrong for every tier (Team is "up to 10", Analyst is 1); and `App.js:229`'s `plan === 'analyst'` session guard never fires for a paying analyst.

**(c) Cancellation writes a phantom `free`.** `api/webhook.js:90` sets `plan: 'free'` on `customer.subscription.deleted`. Nothing else in the app uses `free` — the default everywhere is `free_trial`, and there is no standalone free tier. (`formatPlanName` in `src/utils/format.ts` now maps `free` and `pro` to sane labels as a stopgap, but the data model should be fixed at the source.)

**Fix (scoped task).**
1. Rename the Team tier ids `pro_*` → `team_*` across `BillingPage.js:25-26`, `checkout.js` `VALID_PLANS`/`priceMap`, and the `STRIPE_PRICE_PRO_*` env vars (rename to `STRIPE_PRICE_TEAM_*`, pointing at the same Stripe Price IDs).
2. Add `analyst_*` and `enterprise_*` to `priceMap` with their own `STRIPE_PRICE_*` env vars, and create the matching Stripe Prices.
3. Webhook: derive the purchased tier from the Stripe line item / price id (or pass it through `session.metadata`), then write the correct `plan` key and per-tier `max_users` (analyst 1, team 10, enterprise 50).
4. Cancellation: write `free_trial` (or an explicit lapsed state) instead of `free`, consistent with the rest of the app.

This touches Stripe dashboard config (env vars must point at real Price IDs or checkout 500s), so it needs Joel's config side too. Not a code-only fix.

---

## P1 — Architecture and Consistency

### P1-1. Theme drift — code and docs still describe the old dark theme

The live app is a light theme (white/cream background, black text, gold accents reserved for primary actions). Three places still describe the old dark theme:

- `CLAUDE.md:16` — "Glass-card dark theme with gold (#D4A843) accents on charcoal (#141210)"
- `src/modules/equipment-finance/scoring.js:230-261` (`getRecommendation`) returns Tailwind classes designed for dark backgrounds: `text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/30`. Same in `src/modules/accounts-receivable/scoring.js:201-237`.
- `glass-card` class names throughout `App.js` still imply a glass-on-dark aesthetic.

**Why it matters.** Every prompt run against the stale CLAUDE.md gets pulled toward dark-theme suggestions. Components using these returned classes render with washed-out text on a light bg.

**Fix.** (1) Update CLAUDE.md to describe the actual light theme. (2) Pull color/copy out of scoring modules — they should return semantic categories (`'strong' | 'moderate' | 'borderline' | 'weak'`), and presentation maps category → classes in one place. The scoring layer shouldn't know about Tailwind classes at all.

### P1-2. Scoring weights duplicated in 3+ places

`src/modules/equipment-finance/scoring.js:194-202` (composite math), lines 214-220 (`describeFactors`), and `src/components/RiskRadarChart.js:22-30` (`FACTOR_WEIGHTS` as `'25%'` strings) all hardcode the same weights. `src/components/ScoringWeights.js` also lets users override them at runtime. Four places to keep in sync.

**Fix.** Single source: export `FACTOR_WEIGHTS = { dscr: 0.25, leverage: 0.20, ... }` from `src/modules/equipment-finance/constants.js`. Everything else (composite calc, describeFactors, radar component, ScoringWeights default) imports from there. Composite math becomes `Object.entries(FACTOR_WEIGHTS).reduce(...)`.

### P1-3. `getRecommendation` and `generateCommentary` mix three concerns

`getRecommendation` decides (a) what category the score falls into (policy), (b) what copy to use (content), and (c) what Tailwind classes to apply (presentation). All in one function, in the scoring module. Same pattern in commentary which mixes thresholds with English copy.

**Fix.** Split: `getRecommendationCategory(score)` returns `'strong' | 'moderate' | 'borderline' | 'weak'`. Copy and classes live in a presentation layer (`src/components/DealRecommendation.js` likely). Makes the scoring module testable without DOM concerns, makes copy localizable, and lets you A/B test recommendation text without touching scoring logic.

### P1-4. App.js is 1,474 lines

The top-level component carries routing, auth state, all module switching, deal pipeline integration, screening result computation, export plumbing, and the entire results view. It's the bottleneck for everyone reading the codebase and for Claude when asked to make changes.

**Fix.** Split into route-level components: `LandingRoute`, `NewDealRoute`, `PipelineRoute`, `DashboardRoute`. The `useMemo` chain for metrics/riskScore/recommendation/commentary belongs in a `useDealScoring(inputs)` hook. Should be doable in a couple hours of focused refactor.

### P1-5. Encryption module is dormant and has design issues for when it's enabled

`src/lib/encryption.js:13` has `ENCRYPTION_ENABLED = false` hardcoded. The module exists but never runs. When you flip it on, several things will bite:

- Line 29: default secret `'tranche-pilot-key-2026'` if env var missing. Known to anyone reading source.
- Line 41: hardcoded salt `'tranche-salt'` — same for every org, defeats one of PBKDF2's purposes.
- Line 29: secret uses `REACT_APP_*` env var, which Create React App **inlines into the client bundle**. Anyone who downloads the JS can extract it. This is a build-time constant in the user's browser, not a server secret.
- Line 85: `catch { return encrypted; }` silently returns ciphertext on decrypt failure — analyst sees base64 garbage with no error indicator.
- Line 16-22: `SENSITIVE_FIELDS` list misses AR fields (totalAROutstanding, customer concentration), inventory data, and equipment specifics.

**Fix.** Before turning encryption on, move it server-side, use a real server-only secret, use per-org salts stored in the DB, and expand the field list. Or, for the pilot, accept that DB-level encryption-at-rest via Supabase + RLS is your actual control and remove the dormant module.

### P1-6. CSV parser logic duplicated across modules

`src/modules/equipment-finance/scoring.js:568-633` and `src/modules/accounts-receivable/scoring.js:627-699` both implement a CSV header normalizer + field map + numeric coercion. ~60 lines each, ~80% structurally identical. Inventory module likely has a third copy (didn't read yet but pattern is clear).

**Fix.** One generic `parseCsvDeals(csvText, { fieldMap, numericFields, booleanFields, defaults })` in `src/utils/csv.js`. Each module exports its `fieldMap` and defaults. Saves ~120 lines and one place to fix CSV bugs.

### P1-7. Audit log writes aren't transactional with deal writes

`api/score-deal.js:33-46` writes to `audit_log` after the deal insert succeeds. If the deal insert succeeds but the audit log write fails, the failure is logged to console.error and swallowed. For a credit tool with compliance posture, audit trail gaps shouldn't fail silently.

**Fix.** Either: (1) wrap both writes in a Postgres function called via RPC, atomic; or (2) keep them separate but add a reconciliation job that flags deals without corresponding audit log entries.

### P1-8. DB error.message leaked in client error responses

`api/score-deal.js:107, 170`, `api/v1.js:60`. `details: error.message` returns raw Postgres error strings to clients. These can leak schema info (column names, constraint names, foreign key paths) useful for an attacker mapping the data model.

**Fix.** Log full error server-side, return a stable error code + generic message client-side. `details` field only included when a debug flag is set on internal builds.

---

## P2 — Smells and Polish

### P2-1. Hard-to-read DSCR conditional

`src/modules/equipment-finance/scoring.js:106-109`:
```js
const dscr =
  ebitda && existingDebtService + newAnnualDebtService > 0
    ? ebitda / (existingDebtService + newAnnualDebtService)
    : 0;
```
Works (operator precedence parses as `ebitda && (sum > 0)`) but readers pause. Extract a `totalDebtService` variable and check it directly.

### P2-2. Test coverage is thin

Tests exist for: scoring modules (equipment, AR, inventory), `screeningCriteria.js`, `ExportPanel.js`, plus the default CRA App smoke test. That's 6 test files for 113 source files. Nothing covers: App.js routing, the `useMemo` recompute chain, lib/ utilities (deals, pipeline, attachments, audit, encryption), the Supabase client wrappers, any of the api/ serverless functions, or the auth flow.

**Recommendation.** Test priorities in order of leverage:
1. `api/score-deal.js` — the most security-relevant code path
2. `api/v1.js` — public API surface
3. `src/lib/pipeline.js` and `src/lib/deals.js` — data layer
4. The `useMemo` chain in App.js (after extracting it into a hook per P1-4)

### P2-3. Industry tier defaults to 'moderate' silently

`scoring.js:170`, `accounts-receivable/scoring.js:163`, etc.: `INDUSTRY_RISK_TIER[inputs.industrySector] || 'moderate'`. If an industry isn't in the map, it gets the moderate tier (65/100, 15% weight = 9.75 composite contribution). Configuration drift is invisible.

**Fix.** Log unknown industries server-side or surface a UI warning. Better: TS union type for `IndustrySector` so the compiler catches new sectors that haven't been categorized.

### P2-4. 17 supabase_*.sql files at the repo root

`supabase_*.sql` files (security_fixes, fix_policies, transfer_admin, module_refactor, phase6_schema, etc.) suggest an evolving DB with hand-applied migrations. No migration tool, no ordering, no rollback path. This is fine for a solo pilot but won't scale to more than one person.

**Fix.** Move to Supabase's `supabase/migrations/` convention with timestamped files. Track which files have been applied in production. The 17 files at root probably represent the current schema state — generate a `supabase db dump` to baseline.

### P2-5. CSV parser silently coerces invalid numbers to 0

`scoring.js:625`: `parseFloat(val.replace(/[^0-9.-]/g, '')) || 0`. A CSV row with `revenue = "TBD"` becomes revenue=0, which then quietly fails screening with no surfaced reason. Better to track parse failures and surface them on the batch screening result.

---

## TypeScript Migration Plan

The runway is built. `tsconfig.json` has `allowJs: true` and `strict: false`. CRA supports TS out of the box (already has `@types/react`, `@types/react-dom`). You can add `.ts/.tsx` files alongside `.js` ones today.

### Sequencing (low blast radius first)

**Phase 1 — Types and pure utilities (1-2 sessions)**
1. New file `src/types.ts` with shared types: `DealInputs` (union of three module input shapes), `Metrics`, `RiskScore`, `Recommendation`, `ScreeningResult`, `AssetClassModule`. The `AssetClassModule` type is the most valuable — it's the contract every module conforms to.
2. Convert `src/utils/format.js` → `format.ts`. Pure functions, easy.
3. Convert `src/utils/borrowerMetrics.js` → `.ts`.
4. Convert `src/modules/equipment-finance/constants.js` → `.ts`. Tightens the spread tier and rating types.

**Phase 2 — One full module (1-2 sessions)**
5. Convert equipment-finance: schema, scoring, index. The types defined in Phase 1 catch most bugs at the boundary.
6. Convert `src/lib/screeningCriteria.js`.

**Phase 3 — Other modules (1 session each)**
7. AR module.
8. Inventory module.

**Phase 4 — Lib and hooks (2-3 sessions)**
9. Hooks (`useOrgPlan`, `useRole`, `useSofrRate`, etc.). Small files, well-defined inputs.
10. lib/ files (deals, pipeline, supabase, etc.).

**Phase 5 — Components, leaf-first (multiple sessions)**
11. Stateless presentational components first (MetricCard, SkeletonCard, DemoBanner).
12. Form/display components.
13. App.js last — and only after the P1-4 split into routes.

### tsconfig changes for serious work

```diff
- "target": "es5",
+ "target": "es2020",
- "strict": false,
+ "strict": false,           // keep false during migration
+ "noImplicitAny": true,     // start here
+ "strictNullChecks": true,  // then this
```

Ramp strict flags one at a time. Each one will surface a real category of bug.

### What TS will catch immediately when you migrate scoring

- The `factors` object shape mismatch I worried about in the radar — TS would have caught it at compile time.
- The `dilutionRate / 100` convention where the same name means percent in one place and decimal in another — disambiguate with `DilutionPercent` vs `DilutionFraction` branded types.
- Unknown industry sectors falling through to 'moderate' — union types make this an explicit case.

---

## Claude Code Workflow Setup

The `.claude/` directory currently has `settings.local.json` and a lock file. Nothing else. Big leverage available here.

What I'd add, in priority order:

1. **Replace `CLAUDE.md`.** Current version is 16 lines of style/design hints (most of which describe the wrong theme). Replace with: project overview, architecture summary, asset-class module contract, key conventions, file layout, and the writing/design rules (corrected for light theme). Draft included below in the deliverable list.

2. **Add `.claude/commands/audit-changes.md`** — a slash command for re-running this audit against new changes only. So you can run `/audit-changes` after a PR and get a focused punch list.

3. **Add `.claude/commands/verify-formula.md`** — slash command that takes a metric name (DSCR, LTV, advance rate, etc.) and verifies the implementation matches `Deal_Screening_Model_Assumptions.md`.

4. **Add `.claude/commands/ts-migrate-file.md`** — slash command to convert a single JS file to TS following the project's conventions and using the types from `src/types.ts`.

5. **Add `.claude/agents/credit-reviewer.md`** — subagent persona for reviewing changes from the perspective of a credit professional, catches domain-correctness issues like P0-3 and P0-4.

I'll draft the first three in this session if you want — say the word.

---

## Recommended Next Actions

If you want to act on this audit in order of impact:

1. **Fix P0-1 (server-side scoring).** Largest credibility risk and the fix is contained to `api/score-deal.js` + `api/v1.js`.
2. **Fix P0-3 (threshold consistency).** One-day refactor, removes a real source of analyst confusion.
3. **Replace CLAUDE.md and add slash commands.** Two hours, makes every subsequent Claude Code session sharper.
4. **Start Phase 1 of the TS migration.** `src/types.ts` plus `format.ts` is a couple of hours and unlocks Phases 2+.
5. **P1-4 App.js split** before doing big features. Cheap now, expensive later.
6. **Then everything else** in roughly the order above.

---

*Generated by Claude during interactive audit session, May 2026. File:line references are accurate as of commit at session start. Re-run after material changes via `/audit-changes` (once that command is set up).*
