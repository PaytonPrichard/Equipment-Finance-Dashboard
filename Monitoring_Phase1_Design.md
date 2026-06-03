# Monitoring Phase 1 — Covenant Tracking (Design)

Status: proposed. Owner: Joel. Last updated: 2026-06-01.

This is the first slice of the post-close monitoring expansion. It is lender-only, single-sided, no borrower login. It turns a funded deal into a monitored facility whose covenants are pre-filled from what was underwritten at screening. That seed-from-underwrite step is the differentiator: it is the one thing the monitoring incumbents (ABLSoft, Cascade Debt) cannot do, because they never held the underwrite.

See `research_abl_monitoring_landscape` (memory) for the competitive basis. See `Deal_Screening_Model_Assumptions.md` for the scoring thresholds this seeds from.

## 1. Scope and boundary

In scope for Phase 1:
- A `facility` entity created when a `pipeline_deal` reaches the `Funded` stage.
- Covenants attached to a facility, pre-filled from the deal's screening assumptions, then editable to match the executed credit agreement.
- Covenant tests recorded by the lender (reported value or deliverable receipt), evaluated pass / flag / fail.
- A facility monitor view: covenant list with status, a test calendar, a record-test action, and history.
- A portfolio rollup so the lender sees breaches across all facilities at a glance.

Explicitly NOT in scope (the servicing line, do not cross it):
- No interest accrual, payment processing, GL, cash application, participations, or daily sweeps. That is Solifi/ABLSoft territory and a different company.
- No borrower login. Borrowers do not touch Phase 1. The lender enters values from the emailed cert.
- No BBC intake or availability math. That is Phase 2.

The discipline: covenant tracking, availability, borrower reporting. Nothing below that.

## 2. The lifecycle hinge

`pipeline_deals.stage` already runs Screening to Under Review to Approved to Funded to Declined. Funded is the hinge. When a deal is moved to Funded, the lender is offered a "Set up monitoring" action that:

1. Creates a `facility` row referencing the source `pipeline_deal`.
2. Freezes a snapshot of the deal's inputs, computed metrics, and the criteria in force, into `facility.underwritten_snapshot`. This is the continuity record. It does not change when the user later edits their screening criteria.
3. Calls the module's `getDefaultCovenants(...)` to produce a seeded covenant set.
4. Shows the lender a review screen to confirm or edit each covenant against the signed loan agreement, then writes the covenant rows.

A facility is a new entity, not an overload of `pipeline_deals`. A pipeline deal is a one-shot score with `inputs` and `score`. A facility is a long-lived object with ongoing terms and time-series children. Keeping them separate avoids stretching the pipeline schema into two jobs.

Important: the seed is a starting point, not the source of truth. Real covenant thresholds come from the negotiated credit agreement and can differ from the screening defaults. The covenant row stores its own thresholds, decoupled from `user_preferences.screening_criteria` (which changes over time and applies only to new screenings). Seed-from-underwrite means pre-fill, then the lender confirms against the executed docs.

## 3. Data model

All three tables follow the existing conventions: `BIGSERIAL` primary keys (so ids fit `audit_log.entity_id BIGINT`), a denormalized `org_id UUID` on every table for simple RLS, `created_at` / `updated_at`, and RLS policies mirroring `pipeline_deals`.

Migration file: `supabase_monitoring_phase1.sql` (run after the base schema and module refactor migration, which adds `pipeline_deals.asset_class`).

```sql
-- ============================================================
-- Monitoring Phase 1: Facilities, Covenants, Covenant Tests
-- Run in Supabase SQL Editor AFTER supabase_schema.sql and
-- supabase_module_refactor.sql (which adds pipeline_deals.asset_class).
-- ============================================================

-- 1. Facilities (a funded deal under monitoring)
CREATE TABLE public.facilities (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_deal_id BIGINT REFERENCES public.pipeline_deals(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  commitment_amount NUMERIC(16,2),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'defaulted')),
  funded_at DATE,
  maturity_date DATE,
  underwritten_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facilities_select" ON public.facilities
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "facilities_insert" ON public.facilities
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND auth.uid() = user_id
  );
CREATE POLICY "facilities_update" ON public.facilities
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "facilities_delete" ON public.facilities
  FOR DELETE USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'credit_committee')
    )
  );

CREATE INDEX idx_facilities_org ON public.facilities(org_id);
CREATE INDEX idx_facilities_deal ON public.facilities(pipeline_deal_id);
CREATE INDEX idx_facilities_status ON public.facilities(status);

-- 2. Covenants (per facility; financial or reporting)
CREATE TABLE public.covenants (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id BIGINT NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('financial', 'reporting')),
  metric_key TEXT,                 -- 'dscr','leverage','ltv', etc. NULL for reporting
  direction TEXT CHECK (direction IN ('min', 'max')),  -- NULL for reporting
  flag_value NUMERIC,              -- breach-of-flag boundary (cure / watch)
  fail_value NUMERIC,              -- hard-breach boundary (event of default)
  unit TEXT CHECK (unit IN ('ratio', 'percent', 'currency', 'count')),
  test_frequency TEXT NOT NULL DEFAULT 'quarterly'
    CHECK (test_frequency IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  cure_days INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('underwritten', 'manual')),
  next_test_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.covenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "covenants_select" ON public.covenants
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "covenants_modify" ON public.covenants
  FOR ALL USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE INDEX idx_covenants_org ON public.covenants(org_id);
CREATE INDEX idx_covenants_facility ON public.covenants(facility_id);

-- 3. Covenant tests (time-series results)
CREATE TABLE public.covenant_tests (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id BIGINT NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  covenant_id BIGINT NOT NULL REFERENCES public.covenants(id) ON DELETE CASCADE,
  test_date DATE NOT NULL,         -- the as-of / period-end date
  due_date DATE,                   -- when the deliverable/cert was contractually due
  reported_value NUMERIC,          -- financial covenants
  submitted_at TIMESTAMPTZ,        -- reporting covenants: when received
  status TEXT NOT NULL CHECK (status IN ('pass', 'flag', 'fail', 'waived')),
  note TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.covenant_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "covenant_tests_select" ON public.covenant_tests
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "covenant_tests_insert" ON public.covenant_tests
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND auth.uid() = created_by
  );
-- Tests are append-only by default (like audit_log). Corrections are new rows.
-- No UPDATE/DELETE policy = denied by RLS. Re-test = insert a new row.

CREATE INDEX idx_covenant_tests_org ON public.covenant_tests(org_id);
CREATE INDEX idx_covenant_tests_facility ON public.covenant_tests(facility_id);
CREATE INDEX idx_covenant_tests_covenant ON public.covenant_tests(covenant_id, test_date DESC);
```

Two design choices worth noting:
- `covenant_tests` is append-only, the same posture as `audit_log`. A correction is a new test row, not an edit. This keeps a defensible compliance history, which is the whole point of covenant tracking.
- `flag_value` and `fail_value` are two separate bands, mirroring how `evaluateScreening` already splits a soft breach from a hard one (DSCR under floor is a flag, DSCR under 1.0 is a fail; leverage over max is a flag, over 1.5x max is a fail). This keeps the monitor consistent with the screen.

## 4. Seed-from-underwrite mapping

The module produces the seed. Evaluation is shared. The split:
- `getDefaultCovenants(inputs, metrics, criteria)` lives in each module's `scoring.ts` and returns the covenant set for that asset class. This is asset-class-specific, so it belongs in the module per the contract in CLAUDE.md. Add it to the documented module surface.
- `evaluateCovenantTest(covenant, reported)` lives in `src/lib/covenants.ts`, shared and asset-class agnostic. It only compares a number to thresholds by direction. No Tailwind classes, no asset-class branches.

The seed values come from `DEFAULT_CRITERIA` in `screeningCriteria.ts` merged with the deal's own criteria, plus the module specifics. Mapping:

Shared (all asset classes):

| Covenant | metric_key | direction | flag_value | fail_value | unit | freq | Source field |
|---|---|---|---|---|---|---|---|
| Minimum DSCR | dscr | min | `criteria.minDscr` (1.25; AR uses `minDscrAR` 1.10) | 1.00 | ratio | quarterly | screeningCriteria |
| Maximum leverage | leverage | max | `criteria.maxLeverage` (5.0) | `maxLeverage * 1.5` (7.5) | ratio | quarterly | screeningCriteria |

The fail bands (1.00 for DSCR, 1.5x for leverage) are lifted directly from the existing `evaluateScreening` logic so the two stay in lockstep. If `minRevenue` or `minYearsInBusiness` are set above 0, seed them too; they default to 0 (disabled) so usually skipped.

Equipment finance:

| Covenant | metric_key | direction | flag_value | fail_value | unit | freq |
|---|---|---|---|---|---|---|
| Maximum LTV | ltv | max | `criteria.maxLtv` (100; only if < 100) | n/a | percent | annual (at appraisal) |
| Maximum term coverage | termCoverage | max | `criteria.maxTermCoverage` (80) | n/a | percent | annual |

Accounts receivable:

| Covenant | metric_key | direction | flag_value | fail_value | unit | freq |
|---|---|---|---|---|---|---|
| Max customer concentration | concentration | max | `criteria.maxConcentration` (25) | n/a | percent | monthly |
| Max dilution | dilution | max | `criteria.maxDilution` (5) | n/a | percent | monthly |

Inventory finance:

| Covenant | metric_key | direction | flag_value | fail_value | unit | freq |
|---|---|---|---|---|---|---|
| Min inventory turnover | turnover | min | `criteria.minTurnover` (4.0) | n/a | ratio | quarterly |
| Max obsolescence | obsolescence | max | `criteria.maxObsolescence` (10) | n/a | percent | quarterly |

Reporting covenants (all asset classes, date-based, no threshold). These are the affirmative covenants that make ABL a high-frequency relationship. In Phase 1 the lender marks them received manually. In Phase 2 the BBC submission auto-satisfies the BBC covenant.

| Covenant | kind | freq | Notes |
|---|---|---|---|
| Borrowing base certificate due | reporting | monthly | Auto-checked in Phase 2 when BBC intake exists |
| Compliance certificate due | reporting | quarterly | |
| Financial statements due | reporting | quarterly | |
| Annual audited financials due | reporting | annual | |

`getDefaultCovenants` returns these as plain objects (no DB ids). The setup screen lets the lender drop any, edit thresholds and frequencies to match the signed agreement, and add custom covenants. Only confirmed covenants get written, all with `source = 'underwritten'` except lender-added ones (`'manual'`).

## 5. Test evaluation

`evaluateCovenantTest(covenant, value)` returns `'pass' | 'flag' | 'fail'`:

- Financial, direction `min` (e.g. DSCR, turnover): `fail` if `value < fail_value`, else `flag` if `value < flag_value`, else `pass`. `fail_value` may be null (then only pass/flag).
- Financial, direction `max` (e.g. leverage, LTV, concentration): `fail` if `fail_value != null && value > fail_value`, else `flag` if `value > flag_value`, else `pass`.
- Reporting: not value-based. `pass` if `submitted_at <= due_date`, `flag` if late within `cure_days`, `fail` if past due beyond cure or unsubmitted at the time the lender records it. A `waived` status is set manually by the lender.

A facility's overall status is the worst active covenant status, using the same pass/flag/fail vocabulary and the existing badge components. A covenant with no test yet and a `next_test_date` in the past shows as "overdue" in the UI (derived, not stored).

## 6. API and write path

No new serverless function is required for Phase 1. The deal score is recomputed server-side because the client cannot be trusted with it (AUDIT.md P0-1), but a covenant test status is deterministic from the reported value and the covenant's own thresholds, so it can be computed in the shared lib and written directly through RLS, the same way `updatePipelineStage` writes directly and then calls `logAudit`.

New lib module `src/lib/facilities.ts`, mirroring `src/lib/pipeline.ts`:
- `createFacilityFromDeal(deal, snapshot)` plus `seedCovenants(facilityId, covenantSeeds)`.
- `fetchFacilities(orgId)`, `fetchFacility(id)` with its covenants and recent tests.
- `recordCovenantTest(covenantId, { testDate, reportedValue | submittedAt, note })`, which computes status via `evaluateCovenantTest`, inserts the row, and calls `logAudit`.
- `updateCovenant`, `addCovenant`, `deactivateCovenant`.

Every write that touches a facility, covenant, or covenant test writes a matching `audit_log` entry, the same rule as `pipeline_deals`. Demo mode gets parallel `demoMode.ts` helpers so the unauthenticated demo still works.

## 7. Audit integration

Extend the `AuditAction` and `AuditEntityType` unions in `src/types.ts`:
- entity types: `'facility'`, `'covenant'`, `'covenant_test'`.
- actions: `'create_facility'`, `'seed_covenants'`, `'update_covenant'`, `'record_test'`, `'waive_covenant'`, `'close_facility'`.

`AuditLogViewer.js` already renders generic entries, so new types surface without UI work beyond friendly labels.

## 8. UI surface

Build monitoring as its own route-level component rather than adding to `App.js`, which is already 1,474 lines and on the split roadmap. A new `MonitorRoute` is consistent with the documented App.js split plan (LandingRoute, NewDealRoute, PipelineRoute, DashboardRoute, plus MonitorRoute).

- DealPipeline: a deal in the `Funded` column gains a "Set up monitoring" action. After setup it links to the facility.
- Covenant setup screen: the seeded covenant list, each row editable (threshold, frequency, cure days), drop and add controls, one confirm action. One clear primary action per the design rules.
- Facility monitor view: header (borrower, commitment, status, maturity), covenant list with pass/flag/fail badges and next test date, a record-test action per covenant, and a per-covenant history timeline.
- Portfolio monitor: a list of active facilities with the worst-covenant rollup, so a breach anywhere is visible at a glance. This is the daily-driver screen for the lender and the reason they keep the tab open.

Presentation maps category to classes in the component layer. The scoring and evaluation libs return semantic categories only (`'pass' | 'flag' | 'fail'`), never Tailwind strings, per the standing rule.

## 9. Edge cases

- Deal moved out of Funded after a facility exists: keep the facility, do not auto-delete. Warn if unlinking. The facility carries its own snapshot, so it survives.
- Screening criteria changed after seeding: no effect on existing covenants. They are frozen copies. This is intended.
- Re-screening a funded deal: updates the pipeline deal, not the facility covenants. The facility snapshot is the underwrite baseline and stays put.
- Late or missing tests: a covenant past `next_test_date` with no test shows as overdue (derived). No cron in Phase 1; overdue is computed on read. A reminder cron is a later add (Resend is already in the stack).
- Manual covenant edits: allowed, audited. Editing thresholds does not retroactively re-evaluate past tests; history is immutable.
- Facility closed or defaulted: status field on the facility; covenants stop prompting for tests when status != active.

## 10. Testing

Per the testing rule (scoring and threshold logic are the highest-value tests):
- `src/lib/covenants.test.js`: `evaluateCovenantTest` across min and max directions, both bands, null `fail_value`, and reporting cases. Pin the DSCR-under-1.0 and leverage-over-1.5x boundaries so they cannot silently drift from `evaluateScreening`.
- `src/modules/equipment-finance/scoring.test.js`: extend to cover `getDefaultCovenants` returning the expected seed set and values from `DEFAULT_CRITERIA`. Repeat for AR and inventory modules.
- When a screening threshold changes, update `Deal_Screening_Model_Assumptions.md`, the screening test, AND the covenant seed test. The seed is now a third consumer of those thresholds.

## 11. Cost

No new dependencies. No new LLM or API cost. Additional Supabase rows and storage are negligible at this tier. No new serverless function in Phase 1. The only ongoing cost is the build itself.

## 12. Open decisions

1. Commitment amount: entered manually at funding, or derived from inputs per module (equipment: cost minus down payment; AR/inventory: facility limit). Manual is safer since the screen inputs do not always carry the final commitment. Leaning manual with a derived default.
2. Who can record a test: any org member, or analyst-and-up. Leaning any member, audited, with edits/waivers restricted to senior roles.
3. Reporting covenants in Phase 1: include them as manual-receipt now, or wait until Phase 2 wires them to BBC intake. Leaning include now; they are the cadence backbone and cheap to add.
4. Portfolio rollup in Phase 1 or 1.5: it is the daily-driver screen, so probably Phase 1.
5. Overdue reminders: defer the Resend cron to a later phase, or include a simple version now.

## 13. Build order within Phase 1

1. Migration `supabase_monitoring_phase1.sql` plus the `src/types.ts` audit and covenant types.
2. `src/lib/covenants.ts` (`evaluateCovenantTest`) with tests. Pure logic, no UI.
3. `getDefaultCovenants` in the equipment-finance module with tests, then AR and inventory.
4. `src/lib/facilities.ts` plus demo-mode helpers.
5. Covenant setup screen off the Funded action.
6. Facility monitor view.
7. Portfolio monitor view.

Each step is shippable and testable on its own. Steps 1 through 4 carry no UI risk and lock the data and logic first.
