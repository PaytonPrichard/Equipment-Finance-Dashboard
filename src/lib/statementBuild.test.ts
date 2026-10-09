import {
  statementState,
  applyStatementBuild,
  overrideField,
  clearFieldOverride,
  clearStatements,
  hasStatements,
} from './statementBuild';
import type { StatementFinancials } from './statementBuild';

const M = 1_000_000;
const li = (value: number | null) => ({ value });

// Typed deal: the analyst's numbers before any statements.
const typed = { companyName: 'Acme', annualRevenue: 90 * M, ebitda: 12 * M, totalExistingDebt: 30 * M, actualAnnualDebtService: 4 * M };

const incomeOnly: typeof typed & { financials: StatementFinancials } = {
  ...typed,
  financials: {
    fiscalYearEnd: '2025-12-31',
    lineItems: { revenue: li(100 * M), operatingIncome: li(10 * M), depreciationAmortization: li(5 * M) },
  },
};

describe('statementState', () => {
  test('no statements, nothing built', () => {
    expect(statementState(typed, undefined)).toEqual({ build: null, built: {}, pairingCaveats: [] });
    expect(hasStatements({ lineItems: { revenue: li(null) } })).toBe(false);
  });

  test('a partial build covers only what it can', () => {
    const s = statementState(incomeOnly, undefined);
    expect(s.built).toEqual({ annualRevenue: 100 * M, ebitda: 15 * M, maintenanceCapex: 5 * M }); // 10 + 5; capex proxy = D&A
    expect(s.built.totalExistingDebt).toBeUndefined();
  });
});

describe('applyStatementBuild', () => {
  test('writes built values, leaves the rest as typed', () => {
    const next = applyStatementBuild(incomeOnly, undefined);
    expect(next.annualRevenue).toBe(100 * M);
    expect(next.ebitda).toBe(15 * M);
    expect(next.totalExistingDebt).toBe(30 * M);         // typed, not built
    expect(next.actualAnnualDebtService).toBe(4 * M);
  });

  test('returns the same object when nothing changes', () => {
    const once = applyStatementBuild(incomeOnly, undefined);
    expect(applyStatementBuild(once, undefined)).toBe(once);
    expect(applyStatementBuild(typed, undefined)).toBe(typed);
  });

  test('a built field cannot be typed over: the build wins on the next apply', () => {
    const once = applyStatementBuild(incomeOnly, undefined);
    expect(applyStatementBuild({ ...once, ebitda: 99 * M }, undefined).ebitda).toBe(15 * M);
  });

  test('a field that stops being built keeps its last value as typed', () => {
    const once = applyStatementBuild(incomeOnly, undefined);
    const withoutOpInc = { ...once, financials: { ...once.financials, lineItems: { ...once.financials.lineItems, operatingIncome: li(null) } } };
    const next = applyStatementBuild(withoutOpInc, undefined);
    expect(next.ebitda).toBe(15 * M);
    expect(statementState(next, undefined).built.ebitda).toBeUndefined();
  });
});

describe('field overrides', () => {
  test('need a reason', () => {
    expect(overrideField(incomeOnly, 'ebitda', ' ').error).toBe('An override needs a reason.');
  });

  test('hand the field back to typing, from its current value, and record why', () => {
    const once = applyStatementBuild(incomeOnly, undefined);
    const { inputs, error } = overrideField(once, 'ebitda', 'Run-rate after plant closure', 'J. Peter', '2026-10-09T00:00:00Z');
    expect(error).toBeNull();
    expect(inputs.financials!.fieldOverrides!.ebitda).toEqual({ reason: 'Run-rate after plant closure', by: 'J. Peter', at: '2026-10-09T00:00:00Z' });
    expect(statementState(inputs, undefined).built.ebitda).toBeUndefined();
    const typedOver = applyStatementBuild({ ...inputs, ebitda: 13 * M }, undefined);
    expect(typedOver.ebitda).toBe(13 * M);                // typed value now holds
  });

  test('clearing the override builds the field again', () => {
    const once = applyStatementBuild(incomeOnly, undefined);
    const over = overrideField(once, 'ebitda', 'Reason').inputs;
    const back = applyStatementBuild(clearFieldOverride({ ...over, ebitda: 13 * M }, 'ebitda'), undefined);
    expect(back.ebitda).toBe(15 * M);
  });
});

describe('pairing caveat when mixing built and typed', () => {
  test('floorplan present, EBITDA built, debt typed: names what to confirm', () => {
    const f = { ...incomeOnly, financials: { ...incomeOnly.financials, lineItems: { ...incomeOnly.financials.lineItems, floorplanInterest: li(2 * M), floorplanPayable: li(30 * M) } } };
    expect(statementState(f, undefined).pairingCaveats).toEqual([
      'EBITDA is built from statements, debt and debt service typed. Confirm the typed figure excludes the floorplan payable, to match EBITDA.',
    ]);
  });

  test('no treatment item present, no caveat', () => {
    expect(statementState(incomeOnly, undefined).pairingCaveats).toEqual([]);
  });
});

test('clearing statements keeps every value, now typed', () => {
  const once = applyStatementBuild(incomeOnly, undefined);
  const cleared = clearStatements(once);
  expect(cleared.financials).toBeUndefined();
  expect(cleared.ebitda).toBe(15 * M);
});
