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

describe('judgments, treatment and the rules snapshot', () => {
  const { confirmJudgment, pendingJudgments, setDealTreatment, withRulesSnapshot, firmRulesFor } = require('./statementBuild');
  const dealer = {
    ...incomeOnly,
    financials: { ...incomeOnly.financials, lineItems: { ...incomeOnly.financials.lineItems, floorplanInterest: li(2 * M), floorplanPayable: li(30 * M) } },
  };

  test('confirming records the value, who and when; pending count falls', () => {
    const before = pendingJudgments(statementState(dealer, undefined));
    const next = confirmJudgment(dealer, 'floorplanPresent', true, true, 'J. Peter', '2026-10-09T00:00:00Z');
    expect(next.financials.judgments.floorplanPresent).toEqual({ proposed: true, confirmed: true, by: 'J. Peter', at: '2026-10-09T00:00:00Z' });
    expect(pendingJudgments(statementState(next, undefined))).toBe(before - 1);
  });

  test('picking another option confirms that option', () => {
    const next = confirmJudgment(dealer, 'floorplanInterestPlacement', 'operatingExpenses', 'belowOperatingIncome');
    expect(statementState(next, undefined).build!.inputs.ebitda).toBe(15 * M);   // already inside op income, no deduction
    expect(statementState(dealer, undefined).build!.inputs.ebitda).toBe(13 * M); // proposal: 10 + 5 - 2
  });

  test('which EBITDA scores is stored as the source', () => {
    expect(confirmJudgment(dealer, 'ebitdaSource', 'built', 'built').financials.ebitdaSource).toBe('built');
  });

  test('a treatment override needs a reason; choosing the firm rule clears it', () => {
    expect(setDealTreatment(dealer, 'floorplan', 'in', '', undefined).error).toBe('An override needs a reason.');
    const over = setDealTreatment(dealer, 'floorplan', 'in', 'Credit agreement', undefined, 'J. Peter').inputs;
    expect(statementState(over, undefined).build!.treatment.floorplan).toBe('in');
    const back = setDealTreatment(over, 'floorplan', 'out', '', undefined).inputs;
    expect(back.financials.treatmentOverrides.floorplan).toBeUndefined();
  });

  test('a saved deal keeps the rules it was built with', () => {
    const saved = withRulesSnapshot(dealer, { floorplan: 'out' });
    expect(saved.financials.firmRules.floorplan).toBe('out');
    // The firm later switches floorplan to "in". This deal does not move.
    expect(firmRulesFor(saved, { floorplan: 'in' }).floorplan).toBe('out');
    expect(statementState(saved, { floorplan: 'in' }).build!.treatment.floorplan).toBe('out');
    // Saving again does not replace the copy.
    expect(withRulesSnapshot(saved, { floorplan: 'in' })).toBe(saved);
  });

  test('no statements: no snapshot, nothing pending', () => {
    expect(withRulesSnapshot(typed, undefined)).toBe(typed);
    expect(pendingJudgments(statementState(typed, undefined))).toBe(0);
  });
});

describe('company EBITDA on the form', () => {
  test('a stated figure alone starts the build and scores as stated', () => {
    const inputs = { ...typed, financials: { fiscalYearEnd: '2025-12-31', lineItems: {}, statedEbitda: { value: 14 * M, label: 'EBITDA' } } };
    const s = statementState(inputs, undefined);
    expect(s.build!.ebitdaSource).toBe('stated');
    expect(s.built.ebitda).toBe(14 * M);
  });

  test('a bridge line with no amount yet does not count', () => {
    const inputs = {
      ...incomeOnly,
      financials: { ...incomeOnly.financials, ebitdaSource: 'adjusted' as const,
        adjustedEbitda: { value: 18 * M, addBacks: [{ label: 'Stock comp', amount: 1 * M, decision: 'accepted' as const }, { label: '', amount: null as unknown as number, decision: null }] } },
    };
    const s = statementState(inputs, undefined);
    expect(s.build!.inputs.ebitda).toBe(18 * M);
    expect(s.build!.judgments.filter((j) => j.id.startsWith('addBack.')).length).toBe(1);
  });
});

describe('prepareForSave (the server rerun)', () => {
  const { prepareForSave, confirmJudgment, setDealTreatment } = require('./statementBuild');
  const allConfirmed = (inputs: any) => {
    let next = inputs;
    statementState(next, undefined).build!.judgments.forEach((j) => { next = confirmJudgment(next, j.id, j.value, j.proposed); });
    return next;
  };

  test('a deal with no statements passes through untouched', () => {
    const r = prepareForSave(typed, undefined, null);
    expect(r.inputs).toBe(typed);
    expect(r.pending).toBe(0);
  });

  test('a built field the client tampered with is rebuilt', () => {
    const r = prepareForSave({ ...allConfirmed(incomeOnly), ebitda: 99 * M }, undefined, null);
    expect(r.inputs.ebitda).toBe(15 * M);
    expect(r.pending).toBe(0);
  });

  test('unconfirmed judgments are counted, so the server can refuse the save', () => {
    expect(prepareForSave(incomeOnly, undefined, null).pending).toBeGreaterThan(0);
  });

  test('stores the firm rules on first save', () => {
    const r = prepareForSave(allConfirmed(incomeOnly), { floorplan: 'in' }, null);
    expect(r.inputs.financials.firmRules.floorplan).toBe('in');
  });

  test('reports overrides new since the last save, and removed ones', () => {
    const dealer = { ...incomeOnly, financials: { ...incomeOnly.financials, lineItems: { ...incomeOnly.financials.lineItems, floorplanInterest: li(2 * M), floorplanPayable: li(30 * M) } } };
    const over = setDealTreatment(dealer, 'floorplan', 'in', 'Credit agreement', undefined, 'J. Peter').inputs;
    const withField = overrideField(over, 'ebitda', 'Run-rate', 'J. Peter').inputs;
    const first = prepareForSave(withField, undefined, null);
    expect(first.overrides.map((o: any) => `${o.kind}:${o.key}:${o.reason}`)).toEqual(['treatment:floorplan:Credit agreement', 'field:ebitda:Run-rate']);
    // Saved again unchanged: nothing new to log.
    expect(prepareForSave(withField, undefined, first.inputs).overrides).toEqual([]);
    // Override taken off.
    const cleared = clearFieldOverride(withField, 'ebitda');
    expect(prepareForSave(cleared, undefined, first.inputs).overrides).toEqual([{ kind: 'field', key: 'ebitda', removed: true }]);
  });
});

describe('rebuild with current firm rules', () => {
  const { confirmJudgment, pendingJudgments, setDealTreatment, withRulesSnapshot, rebuildWithCurrentRules, rulesOutOfDate, prepareForSave } = require('./statementBuild');
  const AT = '2026-10-09T12:00:00Z';
  // Dealer with floorplan and finance leases, saved under floorplan "out",
  // every judgment confirmed.
  const dealer = {
    ...incomeOnly,
    financials: {
      ...incomeOnly.financials,
      lineItems: {
        ...incomeOnly.financials.lineItems,
        floorplanInterest: li(2 * M), floorplanPayable: li(30 * M), financeLeaseLiabilities: li(4 * M),
      },
    },
  };
  const confirmAll = (inputs: any, rules: any) => {
    let next = inputs;
    statementState(next, rules).build!.judgments.forEach((j) => { next = confirmJudgment(next, j.id, j.value, j.proposed, 'Analyst', AT); });
    return next;
  };
  const saved = confirmAll(withRulesSnapshot(dealer, { floorplan: 'out' }), undefined);
  const newRules = { floorplan: 'in' };

  test('a saved, fully confirmed deal starts with nothing pending', () => {
    expect(pendingJudgments(statementState(saved, newRules))).toBe(0);
    expect(rulesOutOfDate(saved, newRules)).toBe(true);
    expect(rulesOutOfDate(saved, { floorplan: 'out' })).toBe(false);
  });

  test('a confirmation given under an older rule is stale, never confirmed', () => {
    // The deal's confirmation says "out". Swap the snapshot to "in" by hand:
    // the applied rule is "in", so the row must be pending again.
    const swapped = { ...saved, financials: { ...saved.financials, firmRules: { ...saved.financials.firmRules, floorplan: 'in' } } };
    const j = statementState(swapped, undefined).build!.judgments.find((x) => x.id === 'treatment.floorplan')!;
    expect(j.confirmed).toBe(false);
    expect(j.value).toBe('in');
  });

  test('per deal: changed rows go back to pending, the rest stay confirmed', () => {
    const { inputs, changed } = rebuildWithCurrentRules(saved, newRules, { by: 'Analyst', at: AT });
    expect(changed).toEqual(['floorplan']);
    expect(inputs.financials.firmRules.floorplan).toBe('in');
    expect(inputs.financials.judgments['treatment.floorplan']).toBeUndefined();
    expect(inputs.financials.judgments['treatment.financeLeases']).toBeDefined();
    const state = statementState(inputs, newRules);
    expect(pendingJudgments(state)).toBe(1);
    expect(state.build!.treatment.floorplan).toBe('in');
    // Floorplan "in": interest stays in, so EBITDA is 10 + 5 = 15, not 13.
    expect(state.build!.inputs.ebitda).toBe(15 * M);
    expect(inputs.financials.rulesRebuilt).toEqual({
      at: AT, by: 'Analyst', from: expect.objectContaining({ floorplan: 'out' }), to: expect.objectContaining({ floorplan: 'in' }), changed: ['floorplan'],
    });
  });

  test('bulk: the admin confirms the changed rows, nothing left pending', () => {
    const { inputs } = rebuildWithCurrentRules(saved, newRules, { by: 'Admin', at: AT, bulk: true });
    expect(inputs.financials.judgments['treatment.floorplan']).toEqual({ proposed: 'in', confirmed: 'in', by: 'Admin', at: AT });
    expect(pendingJudgments(statementState(inputs, newRules))).toBe(0);
    expect(inputs.financials.rulesRebuilt.bulk).toBe(true);
  });

  test('bulk: a row the new rule brings in is confirmed too; an absent item is not', () => {
    const { inputs } = rebuildWithCurrentRules(saved, { floorplan: 'out', operatingLeases: 'in', captiveFleet: 'consolidated' }, { by: 'Admin', at: AT, bulk: true });
    // No rent line, but operating leases "in" asks the question.
    expect(inputs.financials.judgments['treatment.operatingLeases']).toEqual({ proposed: 'in', confirmed: 'in', by: 'Admin', at: AT });
    // No captive fleet on this borrower: nothing to confirm.
    expect(inputs.financials.judgments['treatment.captiveFleet']).toBeUndefined();
    const state = statementState(inputs, undefined);
    expect(state.build!.judgments.filter((j) => j.id.startsWith('treatment.') && !j.confirmed)).toEqual([]);
  });

  test('a row the deal overrides is left alone', () => {
    const over = confirmAll(setDealTreatment(saved, 'floorplan', 'in', 'Credit agreement', undefined, 'Analyst').inputs, undefined);
    const { inputs, changed } = rebuildWithCurrentRules(over, newRules, { by: 'Analyst', at: AT });
    expect(changed).toEqual(['floorplan']);
    // The override stays, with its reason. Nothing to re-confirm.
    expect(inputs.financials.treatmentOverrides.floorplan.reason).toBe('Credit agreement');
    expect(pendingJudgments(statementState(inputs, newRules))).toBe(0);
  });

  test('a gap tolerance change alone changes no judgment', () => {
    const { inputs, changed } = rebuildWithCurrentRules(saved, { floorplan: 'out', ebitdaGapTolerance: 0.1 }, { at: AT });
    expect(changed).toEqual(['ebitdaGapTolerance']);
    expect(inputs.financials.firmRules.ebitdaGapTolerance).toBe(0.1);
    expect(pendingJudgments(statementState(inputs, undefined))).toBe(0);
  });

  test('rules unchanged: same object back', () => {
    expect(rebuildWithCurrentRules(saved, { floorplan: 'out' }).inputs).toBe(saved);
  });

  describe('server check on save', () => {
    const previous = saved;

    test('keeps the saved rules when the client sends them', () => {
      const r = prepareForSave(saved, newRules, previous);
      expect(r.rulesError).toBeNull();
      expect(r.rulesChange).toBeNull();
      expect(r.inputs.financials.firmRules.floorplan).toBe('out');
    });

    test('a client that drops the rules does not get moved onto new ones', () => {
      const dropped = { ...saved, financials: { ...saved.financials } };
      delete dropped.financials.firmRules;
      expect(prepareForSave(dropped, newRules, previous).inputs.financials.firmRules.floorplan).toBe('out');
    });

    test('refuses rules that are neither the saved ones nor the firm\'s', () => {
      const forged = { ...saved, financials: { ...saved.financials, firmRules: { ...saved.financials.firmRules, financeLeases: 'out' } } };
      expect(prepareForSave(forged, newRules, previous).rulesError).toMatch(/Rebuild with current firm rules/);
    });

    test('a first save must use the firm\'s current rules', () => {
      expect(prepareForSave(saved, newRules, null).rulesError).toMatch(/not your firm's rules/);
    });

    test('a rebuild is accepted, and the server stamps the record', () => {
      const rebuilt = confirmAll(rebuildWithCurrentRules(saved, newRules, { by: 'Analyst', at: '1999-01-01T00:00:00Z' }).inputs, newRules);
      const r = prepareForSave(rebuilt, newRules, previous, { at: AT });
      expect(r.rulesError).toBeNull();
      expect(r.pending).toBe(0);
      expect(r.rulesChange).toMatchObject({ at: AT, by: 'Analyst', changed: ['floorplan'] });
      expect(r.inputs.financials.rulesRebuilt.at).toBe(AT);
      expect(r.inputs.ebitda).toBe(15 * M);
    });

    test('a client cannot invent a rebuild record', () => {
      const fake = { ...saved, financials: { ...saved.financials, rulesRebuilt: { at: AT, by: 'Someone', bulk: true } } };
      expect(prepareForSave(fake, newRules, previous).inputs.financials.rulesRebuilt).toBeUndefined();
    });

    test('bulk: the server names the admin and marks it bulk', () => {
      const rebuilt = rebuildWithCurrentRules(saved, newRules, { by: 'ignored', at: AT, bulk: true }).inputs;
      const r = prepareForSave(rebuilt, newRules, previous, { at: AT, by: 'Admin', bulk: true });
      expect(r.rulesChange).toMatchObject({ by: 'Admin', bulk: true });
      expect(r.pending).toBe(0);
    });
  });
});

// Joel's test, 2026-10-12: floorplan switched to Debt on a deal with only
// the EBITDA lines. EBITDA rose from $13M to $15M, debt stayed at the typed
// figure, and DSCR went up (7.51x to 8.66x). Saving now waits for the debt side.
describe('debt gap: a rule puts an item into debt the statements cannot total', () => {
  const { debtGap, prepareForSave } = require('./statementBuild');
  const { DEFAULT_TREATMENT_RULES } = require('./borrowerBuild');
  const IN = { ...DEFAULT_TREATMENT_RULES, floorplan: 'in' };
  const dealer = (extra = {}): any => ({
    ...typed,
    financials: {
      fiscalYearEnd: '2025-12-31',
      lineItems: {
        revenue: li(100 * M), operatingIncome: li(10 * M), depreciationAmortization: li(5 * M),
        floorplanInterest: li(2 * M), floorplanPayable: li(30 * M), ...extra,
      },
      judgments: { floorplanPresent: { proposed: true, confirmed: true } },
    },
  });

  test('floorplan in, debt lines missing: names the lines to enter', () => {
    const d = dealer();
    expect(debtGap(statementState(d, IN), d)).toBe(
      'Floorplan counts as debt under your rules. Enter Revolver, Term loans and notes, including current portion, Cash interest paid, '
      + 'Current maturities of long-term debt (0 if none) so leverage and DSCR include it.',
    );
  });

  test('floorplan out: no gap, the floorplan is not debt', () => {
    const d = dealer();
    expect(debtGap(statementState(d, DEFAULT_TREATMENT_RULES), d)).toBeNull();
  });

  test('debt lines entered: no gap', () => {
    const d = dealer({ revolver: li(0), termLoansAndNotes: li(0), interestPaid: li(2 * M), currentMaturities: li(0) });
    expect(debtGap(statementState(d, IN), d)).toBeNull();
  });

  test('typed debt and debt service with an override reason: let through', () => {
    const d = dealer();
    d.financials.fieldOverrides = {
      totalExistingDebt: { reason: 'From the credit agreement' },
      actualAnnualDebtService: { reason: 'From the credit agreement' },
    };
    expect(debtGap(statementState(d, IN), d)).toBeNull();
  });

  test('the server save reports it', () => {
    const d = dealer();
    expect(prepareForSave(d, IN, null).debtGap).toMatch(/^Floorplan counts as debt under your rules\./);
  });
});
