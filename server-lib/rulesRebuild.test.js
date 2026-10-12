/**
 * @jest-environment node
 *
 * Run with: npx jest server-lib --testEnvironment node
 *
 * The rebuild itself runs through the real scoring bundle (api/_scoring.cjs).
 * Validation, scoring, the audit log and webhooks are stubbed so each skip
 * case can be forced.
 */

const { runRulesRebuild } = require('./rulesRebuild');
const { rebuildDealRules, dealRulesOutOfDate } = require('../api/_scoring.cjs');

const M = 1_000_000;
const li = (value) => ({ value });
const AT = '2026-10-09T12:00:00.000Z';
const OLD = { financeLeases: 'in', operatingLeases: 'out', floorplan: 'out', captiveFleet: 'corporate', ebitdaGapTolerance: 0.05 };
const NEW = { ...OLD, floorplan: 'in' };

// A dealer saved under floorplan "out" with every judgment confirmed as
// proposed. The judgment ids are the ones buildBorrowerInputs asks for on
// these line items (printed from the build, 2026-10-09). If the build adds a
// judgment, the "rebuilds" test fails with a pending count, not silently.
const ASKED = [
  ['fiscalYear', '2025-12-31'], ['floorplanPresent', true], ['captiveFleetPresent', false],
  ['financeLeasesPresent', false], ['treatment.floorplan', 'out'],
  ['floorplanInterestPlacement', 'belowOperatingIncome'], ['floorplanInterestInInterestPaid', true],
  ['currentMaturitiesInclude.floorplan', false], ['maintenanceCapex', 'depreciation'],
];
function dealerInputs() {
  const judgments = Object.fromEntries(ASKED.map(([id, v]) => [id, { proposed: v, confirmed: v, by: 'Analyst', at: AT }]));
  return {
    companyName: 'Dealer',
    financials: {
      fiscalYearEnd: '2025-12-31',
      lineItems: {
        revenue: li(100 * M), operatingIncome: li(10 * M), depreciationAmortization: li(5 * M),
        floorplanInterest: li(2 * M), floorplanPayable: li(30 * M),
      },
      firmRules: OLD,
      judgments,
    },
  };
}

// Minimal Supabase stand-in: records updates, answers selects from `deals`.
function fakeDb(deals, { staleIds = [] } = {}) {
  const updates = [];
  const db = {
    updates,
    from(table) {
      const q = { table, filters: {}, op: 'select', payload: null };
      const chain = {
        select() { return chain; },
        update(payload) { q.op = 'update'; q.payload = payload; return chain; },
        eq(col, val) { q.filters[col] = val; return chain; },
        is(col, val) { q.filters[col] = val; return chain; },
        in(col, vals) { q.filters[col] = { in: vals }; return chain; },
        single: async () => ({ data: { org_settings: { treatmentRules: NEW } }, error: null }),
        then(resolve) {
          if (q.op === 'update') {
            if (staleIds.includes(q.filters.id)) return resolve({ data: [], error: null });
            updates.push({ id: q.filters.id, filters: q.filters, payload: q.payload });
            return resolve({ data: [{ id: q.filters.id }], error: null });
          }
          const rows = deals.filter((d) => d.org_id === q.filters.org_id && q.filters.stage.in.includes(d.stage));
          return resolve({ data: rows, error: null });
        },
      };
      return chain;
    },
  };
  return db;
}

function deps(overrides = {}) {
  return {
    rebuildDealRules,
    dealRulesOutOfDate,
    recomputeScore: jest.fn(async () => ({ score: 71, error: null })),
    validateInputs: jest.fn(() => ({ valid: true, errors: [] })),
    writeAuditLog: jest.fn(async () => {}),
    dispatchWebhooks: jest.fn(async () => {}),
    ...overrides,
  };
}

const deal = (id, stage, extra = {}) => ({
  id, name: `Deal ${id}`, stage, org_id: 'org-1', asset_class: 'equipment_finance',
  score: 64, updated_at: '2026-10-01T00:00:00Z', inputs: dealerInputs(), ...extra,
});

const run = (db, d, dryRun = false) => runRulesRebuild({ db, orgId: 'org-1', userId: 'admin-1', adminName: 'Admin', dryRun, now: AT, deps: d });

test('dry run counts open deals on older rules only', async () => {
  const current = deal('c', 'Screening');
  current.inputs.financials.firmRules = NEW;
  const db = fakeDb([
    deal('a', 'Screening'),
    deal('b', 'Under Review'),
    current,
    deal('d', 'Screening', { inputs: { companyName: 'Typed' } }),
    deal('e', 'Screening', { org_id: 'org-2' }),
  ]);
  const r = await run(db, deps(), true);
  expect(r.status).toBe(200);
  expect(r.body.count).toBe(2);
  expect(r.body.deals.map((x) => x.id)).toEqual(['a', 'b']);
  expect(db.updates).toEqual([]);
});

test('Approved and Funded deals are never selected', async () => {
  const db = fakeDb([deal('a', 'Approved'), deal('b', 'Funded'), deal('c', 'Declined')]);
  expect((await run(db, deps(), true)).body.count).toBe(0);
});

test('rebuilds, rescores, audits in the admin\'s name, fires a webhook on a score change', async () => {
  const db = fakeDb([deal('a', 'Screening')]);
  const d = deps();
  const r = await run(db, d);
  expect(r.body.skipped).toEqual([]);
  expect(r.body.rebuilt).toEqual([{ id: 'a', name: 'Deal a', oldScore: 64, newScore: 71, changed: ['floorplan'] }]);

  const u = db.updates[0];
  expect(u.filters).toMatchObject({ id: 'a', org_id: 'org-1', updated_at: '2026-10-01T00:00:00Z' });
  const f = u.payload.inputs.financials;
  expect(f.firmRules.floorplan).toBe('in');
  expect(f.judgments['treatment.floorplan']).toEqual({ proposed: 'in', confirmed: 'in', by: 'Admin', at: AT });
  expect(f.rulesRebuilt).toMatchObject({ at: AT, by: 'Admin', bulk: true, changed: ['floorplan'] });
  // Floorplan "in": interest is not deducted, EBITDA 10 + 5 = 15.
  expect(u.payload.inputs.ebitda).toBe(15 * M);
  expect(u.payload.score).toBe(71);

  expect(d.writeAuditLog).toHaveBeenCalledTimes(1);
  expect(d.writeAuditLog.mock.calls[0][0]).toMatchObject({
    userId: 'admin-1', orgId: 'org-1', action: 'rebuild_rules', dealId: 'a',
    oldValues: { score: 64 }, newValues: { score: 71, bulk: true, by: 'Admin' },
  });
  expect(d.dispatchWebhooks).toHaveBeenCalledWith('org-1', 'deal.scored', { id: 'a', name: 'Deal a', stage: 'Screening', score: 71 });
});

test('a deal that fails validation is skipped, listed, and left alone', async () => {
  const db = fakeDb([deal('a', 'Screening'), deal('b', 'Under Review')]);
  const d = deps({
    validateInputs: jest.fn()
      .mockReturnValueOnce({ valid: false, errors: ['EBITDA must be positive.'] })
      .mockReturnValue({ valid: true, errors: [] }),
  });
  const r = await run(db, d);
  expect(r.body.skipped).toEqual([{ id: 'a', name: 'Deal a', reason: 'Does not pass validation under the new rules: EBITDA must be positive.' }]);
  expect(r.body.rebuilt.map((x) => x.id)).toEqual(['b']);
  expect(db.updates.map((x) => x.id)).toEqual(['b']);
  expect(d.writeAuditLog).toHaveBeenCalledTimes(1);
});

test('a deal saved by someone else mid-run is skipped, not overwritten', async () => {
  const db = fakeDb([deal('a', 'Screening')], { staleIds: ['a'] });
  const d = deps();
  const r = await run(db, d);
  expect(r.body.skipped[0].reason).toMatch(/Edited by someone else/);
  expect(d.writeAuditLog).not.toHaveBeenCalled();
});

test('a deal with a judgment still open is skipped', async () => {
  const pendingDeal = deal('a', 'Screening');
  delete pendingDeal.inputs.financials.judgments.floorplanInterestPlacement;
  const r = await run(fakeDb([pendingDeal]), deps());
  expect(r.body.skipped[0].reason).toMatch(/1 judgment still to confirm/);
});

test('no webhook when the score does not move', async () => {
  const d = deps({ recomputeScore: jest.fn(async () => ({ score: 64, error: null })) });
  await run(fakeDb([deal('a', 'Screening')]), d);
  expect(d.dispatchWebhooks).not.toHaveBeenCalled();
});
