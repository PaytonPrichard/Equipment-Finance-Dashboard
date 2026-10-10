// Tests for the borrower build. Every expected number is worked by hand in
// the comment beside it, from the line items in `base()` and each case.

import {
  buildBorrowerInputs,
  allJudgmentsConfirmed,
  validateTreatmentRules,
  setTreatmentOverride,
  DEFAULT_TREATMENT_RULES,
} from './borrowerBuild';
import type { BorrowerFinancials, LineItemKey, BuildResult } from './borrowerBuild';

const M = 1_000_000;

function lines(values: Partial<Record<LineItemKey, number>>) {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, { value: v, source: { document: '10-K', page: 50 }, origin: 'typed' }]),
  );
}

// A plain borrower: no floorplan, fleet or finance leases.
const BASE: Partial<Record<LineItemKey, number>> = {
  revenue: 100 * M,
  operatingIncome: 10 * M,
  depreciationAmortization: 5 * M,
  amortizationOfIntangibles: 1 * M,
  interestPaid: 2 * M,
  currentMaturities: 3 * M,
  revolver: 4 * M,
  termLoansAndNotes: 20 * M,
  incomeTaxesPaid: 1.5 * M,
  workingCapitalChange: -0.8 * M,
  rentExpense: 1.2 * M,
  capitalExpenditures: 6 * M,
};

function fin(extra: Partial<Record<LineItemKey, number>> = {}, rest: Partial<BorrowerFinancials> = {}): BorrowerFinancials {
  return { fiscalYearEnd: '2025-12-31', lineItems: lines({ ...BASE, ...extra }), ...rest };
}

function without(...keys: LineItemKey[]): BorrowerFinancials {
  const f = fin();
  keys.forEach((k) => delete f.lineItems[k]);
  return f;
}

/** Confirm every judgment at the value the build used, as an analyst accepting each proposal. */
function confirmAll(f: BorrowerFinancials, rules = {}): BorrowerFinancials {
  const r = buildBorrowerInputs(f, rules);
  const judgments = { ...(f.judgments || {}) };
  r.judgments.forEach((j) => {
    if (!j.id.startsWith('addBack.') && j.id !== 'ebitdaSource') judgments[j.id] = { proposed: j.proposed, confirmed: j.value };
  });
  return { ...f, judgments, ebitdaSource: f.ebitdaSource ?? r.ebitdaSource };
}

const confirmed = (f: BorrowerFinancials, rules = {}): BuildResult => buildBorrowerInputs(confirmAll(f, rules), rules);

describe('plain borrower at default treatment', () => {
  const r = confirmed(fin());

  test('builds every field', () => {
    expect(r.errors).toEqual([]);
    expect(r.inputs).toEqual({
      annualRevenue: 100 * M,
      ebitda: 15 * M,                    // 10 + 5
      totalExistingDebt: 24 * M,         // revolver 4 + term 20
      actualAnnualDebtService: 5 * M,    // interest paid 2 + current maturities 3
      maintenanceCapex: 4 * M,           // D&A 5 - amortization 1
      cashTaxes: 1.5 * M,
      workingCapitalIncrease: 0.8 * M,   // -(-0.8)
      leasePayments: 1.2 * M,
    });
  });

  test('labels and formulas show the arithmetic', () => {
    expect(r.ebitdaSource).toBe('built');
    expect(r.derivations.ebitda.label).toBe('EBITDA, built from statements');
    expect(r.derivations.ebitda.formula).toBe('Operating income + Depreciation and amortization');
    expect(r.derivations.ebitda.terms[0].source).toEqual({ document: '10-K', page: 50 });
    expect(r.derivations.maintenanceCapex.estimate).toBe(true);
    expect(r.derivations.actualAnnualDebtService.notes).toContain('Revolver balance counts for interest, not as principal due. It renews, so it is refinancing risk.');
  });

  test('only the capex estimate remains as a caveat once judgments are confirmed', () => {
    expect(r.caveats).toEqual(['ESTIMATE: depreciation used as maintenance capex.']);
    expect(allJudgmentsConfirmed(r)).toBe(true);
  });
});

describe('judgments', () => {
  test('unconfirmed proposals score live and show as caveats', () => {
    const r = buildBorrowerInputs(fin());
    expect(r.inputs.ebitda).toBe(15 * M);
    expect(allJudgmentsConfirmed(r)).toBe(false);
    expect(r.caveats).toContain('Proposed, not confirmed: fiscal year ended 2025-12-31 used.');
    expect(r.caveats).toContain('Proposed, not confirmed: depreciation used as maintenance capex.');
  });

  test('a revolver never counts as principal due: it renews', () => {
    const r = confirmed(fin());
    expect(r.inputs.actualAnnualDebtService).toBe(5 * M);    // 2 + 3, revolver 4 left out
    expect(r.judgments.find((j) => j.id === 'revolverMaturing')).toBeUndefined();
  });

  test('a renewing facility inside current maturities comes back out (the United Rentals case)', () => {
    // Current maturities 3 include a 1.2 AR securitization that renews every 364 days.
    const r = confirmed(fin({ renewingInCurrentMaturities: 1.2 * M }));
    expect(r.inputs.actualAnnualDebtService).toBeCloseTo(3.8 * M); // 2 + 3 - 1.2
    expect(r.caveats).toContain('Renewing facilities of $1.2M taken out of current maturities. Not scheduled principal, refinancing risk.');
  });

  test('a confirmed value outside the options is ignored', () => {
    const f = confirmAll(fin());
    f.judgments!.maintenanceCapex = { proposed: 'depreciation', confirmed: 'maybe' };
    const r = buildBorrowerInputs(f);
    expect(r.inputs.maintenanceCapex).toBe(4 * M);          // proposal used
    expect(allJudgmentsConfirmed(r)).toBe(false);
  });

  test('missing fiscal year is an error', () => {
    const r = buildBorrowerInputs({ ...fin(), fiscalYearEnd: undefined });
    expect(r.errors).toContain('Fiscal year end is missing. Needed to know which column the figures come from.');
  });
});

describe('missing inputs', () => {
  test('missing required line is an error and its field is null', () => {
    const r = confirmed(without('interestPaid'));
    expect(r.errors).toEqual(['Cash interest paid is missing. Needed for debt service.']);
    expect(r.inputs.actualAnnualDebtService).toBeNull();
  });

  test('missing revolver is an error, 0 is an answer', () => {
    expect(confirmed(without('revolver')).errors).toEqual(['Revolver is missing. Needed for total debt (enter 0 if the borrower has none).']);
    const r = confirmed(fin({ revolver: 0 }));
    expect(r.errors).toEqual([]);
    expect(r.inputs.totalExistingDebt).toBe(20 * M);
  });

  test('missing operating income and D&A block built EBITDA', () => {
    const r = confirmed(without('operatingIncome'));
    expect(r.inputs.ebitda).toBeNull();
    expect(r.errors).toContain('Operating income is missing. Needed for built EBITDA.');
  });

  test('missing optional lines are null with a caveat, never estimated', () => {
    const r = confirmed(without('incomeTaxesPaid', 'workingCapitalChange', 'rentExpense'));
    expect(r.errors).toEqual([]);
    expect(r.inputs.cashTaxes).toBeNull();
    expect(r.inputs.workingCapitalIncrease).toBeNull();
    expect(r.inputs.leasePayments).toBeNull();
    expect(r.caveats).toEqual(expect.arrayContaining([
      'Income taxes paid not provided. Cash-flow DSCR and FCCR not available.',
      'Change in working capital not provided. Cash-flow DSCR not available.',
      'Rent not provided. FCCR not available.',
    ]));
  });

  test('no capex lines at all leaves maintenance capex null', () => {
    const f = without('depreciationAmortization', 'capitalExpenditures');
    const r = buildBorrowerInputs(f);
    expect(r.inputs.maintenanceCapex).toBeNull();
    expect(r.caveats).toContain('Maintenance capex not provided. No statement figure to estimate it from.');
  });
});

describe('maintenance capex', () => {
  test('without an amortization line the proxy is full D&A, flagged as overstated', () => {
    const r = confirmed(without('amortizationOfIntangibles'));
    expect(r.inputs.maintenanceCapex).toBe(5 * M);
    expect(r.caveats).toContain('Amortization of intangibles not provided. Maintenance capex proxy uses full D&A and overstates capex.');
  });

  test('a borrower-stated figure is proposed first', () => {
    const r = buildBorrowerInputs(fin({ statedMaintenanceCapex: 2.5 * M }));
    expect(r.inputs.maintenanceCapex).toBe(2.5 * M);
    expect(r.derivations.maintenanceCapex.estimate).toBeUndefined();
  });

  test('total capex is offered as an upper bound, labeled an estimate', () => {
    const f = confirmAll(fin());
    f.judgments!.maintenanceCapex = { proposed: 'depreciation', confirmed: 'totalCapex' };
    const r = buildBorrowerInputs(f);
    expect(r.inputs.maintenanceCapex).toBe(6 * M);
    expect(r.caveats).toContain('ESTIMATE: total capex used as maintenance capex. An upper bound, includes growth capex.');
  });
});

describe('working capital', () => {
  test('a release counts as 0, with a note', () => {
    const r = confirmed(fin({ workingCapitalChange: 0.6 * M }));
    expect(r.inputs.workingCapitalIncrease).toBe(0);
    expect(r.derivations.workingCapitalIncrease.notes).toEqual(['Working capital released $600K. Counted as 0, a release is not repeatable.']);
  });
});

describe('floorplan (dealer)', () => {
  // Floorplan payable 30, floorplan interest 2.5. Interest paid 4.5 includes it.
  const dealer = (rest: Partial<BorrowerFinancials> = {}) =>
    fin({ floorplanPayable: 30 * M, floorplanInterest: 2.5 * M, interestPaid: 4.5 * M }, rest);

  test('out, interest below operating income: deducted from EBITDA, excluded from debt and debt service', () => {
    const r = confirmed(dealer());
    expect(r.treatment.floorplan).toBe('out');
    expect(r.inputs.ebitda).toBe(12.5 * M);                  // 10 + 5 - 2.5
    expect(r.inputs.totalExistingDebt).toBe(24 * M);         // payable 30 excluded
    expect(r.inputs.actualAnnualDebtService).toBe(5 * M);    // 4.5 - 2.5 + 3
  });

  test('out, interest inside operating expenses: already deducted', () => {
    const f = confirmAll(dealer());
    f.judgments!.floorplanInterestPlacement = { confirmed: 'operatingExpenses' };
    const r = buildBorrowerInputs(f);
    expect(r.inputs.ebitda).toBe(15 * M);                    // 10 + 5
    expect(r.derivations.ebitda.notes).toContain('Floorplan interest already deducted inside operating expenses.');
  });

  test('override to in flips EBITDA, debt and debt service together', () => {
    const f = dealer({ treatmentOverrides: { floorplan: { rule: 'in', reason: 'Credit agreement counts floorplan as debt' } } });
    const r = confirmed(f);
    expect(r.treatment.floorplan).toBe('in');
    expect(r.inputs.ebitda).toBe(15 * M);                    // 10 + 5, interest below op income, not deducted
    expect(r.inputs.totalExistingDebt).toBe(54 * M);         // 24 + payable 30
    expect(r.inputs.actualAnnualDebtService).toBe(7.5 * M);  // 4.5 + 3
    expect(r.judgments.find((j) => j.id === 'treatment.floorplan')).toMatchObject({ proposed: 'out', value: 'in', confirmed: true });
  });

  test('in, interest inside operating expenses: added back', () => {
    const f = confirmAll(dealer({ treatmentOverrides: { floorplan: { rule: 'in', reason: 'Per credit agreement' } } }));
    f.judgments!.floorplanInterestPlacement = { confirmed: 'operatingExpenses' };
    expect(buildBorrowerInputs(f).inputs.ebitda).toBe(17.5 * M); // 10 + 5 + 2.5
  });

  test('an override without a reason is refused and the firm rule applies', () => {
    const f = dealer({ treatmentOverrides: { floorplan: { rule: 'in', reason: ' ' } } });
    const r = confirmed(f);
    expect(r.errors).toContain('The floorplan override needs a reason.');
    expect(r.treatment.floorplan).toBe('out');
  });

  test('a firm rule of in applies without an override', () => {
    const r = confirmed(dealer(), { floorplan: 'in' });
    expect(r.inputs.totalExistingDebt).toBe(54 * M);
  });

  test('floorplan present without its interest line is an error', () => {
    const r = confirmed(fin({ floorplanPayable: 30 * M }));
    expect(r.errors).toContain('Floorplan interest is missing. Needed for floorplan treatment in EBITDA.');
  });
});

describe('reviewer fixes', () => {
  test('floorplan out with interest inside interest paid but no interest line: debt service is an error', () => {
    const f = fin({ floorplanPayable: 30 * M }, { ebitdaSource: 'stated', statedEbitda: { value: 15 * M } });
    const r = confirmed(f);
    expect(r.errors).toContain('Floorplan interest is missing. Needed for debt service with floorplan.');
    expect(r.inputs.actualAnnualDebtService).toBeNull();
  });

  test('an unreviewed deduction in the bridge stays in EBITDA', () => {
    // Adjusted 18 includes -2 removing a gain on sale, not reviewed.
    const f = fin({}, { ebitdaSource: 'adjusted', adjustedEbitda: { value: 18 * M, addBacks: [{ label: 'Gain on sale', amount: -2 * M, decision: null }] } });
    const r = confirmed(f);
    expect(r.inputs.ebitda).toBe(18 * M);
    expect(r.caveats).toContain('1 deduction in the bridge not reviewed, kept in EBITDA.');
  });

  test('pretax start with floorplan: interest inside interest expense is deducted, question worded to match', () => {
    // Pretax 6.5, interest expense 6 (floorplan 2.5), D&A 5.
    const f = fin({ pretaxIncome: 6.5 * M, interestExpense: 6 * M, floorplanPayable: 30 * M, floorplanInterest: 2.5 * M, interestPaid: 4.5 * M });
    delete f.lineItems.operatingIncome;
    expect(buildBorrowerInputs(f).caveats).toContain('Proposed, not confirmed: floorplan interest reported inside interest expense.');
    expect(confirmed(f).inputs.ebitda).toBe(15 * M);         // 6.5 + 6 + 5 - 2.5
  });
});

describe('captive fleet (car rental), no operating income line', () => {
  // Pretax -1, interest expense 6 (vehicle 4.5), D&A 20 (vehicle 18).
  // Vehicle debt 50. Interest paid 5.5 includes vehicle 4.5.
  const rental = (rest: Partial<BorrowerFinancials> = {}, extra: Partial<Record<LineItemKey, number>> = {}) => {
    const f = fin({
      pretaxIncome: -1 * M, interestExpense: 6 * M, depreciationAmortization: 20 * M,
      vehicleDepreciation: 18 * M, vehicleInterest: 4.5 * M, vehicleDebt: 50 * M, interestPaid: 5.5 * M, ...extra,
    }, rest);
    delete f.lineItems.operatingIncome;
    return f;
  };

  test('corporate: after vehicle depreciation and interest, non-vehicle debt only', () => {
    const r = confirmed(rental());
    expect(r.errors).toEqual([]);
    expect(r.judgments.find((j) => j.id === 'ebitdaStart')?.value).toBe('pretaxIncome');
    expect(r.inputs.ebitda).toBe(2.5 * M);                   // -1 + 6 + 20 - 18 - 4.5
    expect(r.inputs.totalExistingDebt).toBe(24 * M);         // vehicle debt 50 excluded
    expect(r.inputs.actualAnnualDebtService).toBe(4 * M);    // 5.5 - 4.5 + 3
    expect(r.inputs.maintenanceCapex).toBe(1 * M);           // 20 - amortization 1 - vehicle 18
  });

  test('consolidated: before vehicle costs, vehicle debt and its maturities in', () => {
    const f = rental({ treatmentOverrides: { captiveFleet: { rule: 'consolidated', reason: 'Lender sees the whole group' } } },
      { currentVehicleDebtMaturities: 10 * M });
    const r = confirmed(f);
    expect(r.inputs.ebitda).toBe(25 * M);                    // -1 + 6 + 20
    expect(r.inputs.totalExistingDebt).toBe(74 * M);         // 24 + 50
    expect(r.inputs.actualAnnualDebtService).toBe(18.5 * M); // 5.5 + 3 + 10
    expect(r.inputs.maintenanceCapex).toBe(1 * M);           // 20 - 1 - vehicle 18, fleet is debt-funded
  });

  test('consolidated without vehicle maturities is an error', () => {
    const f = rental({ treatmentOverrides: { captiveFleet: { rule: 'consolidated', reason: 'Group view' } } });
    expect(confirmed(f).errors).toContain('Current maturities of vehicle debt is missing. Needed for debt service with captive fleet consolidated.');
  });
});

describe('finance leases', () => {
  // Lease liabilities 5 (current 1), amortization 0.9, interest 0.3.
  const leased = (extra: Partial<Record<LineItemKey, number>> = {}, rest: Partial<BorrowerFinancials> = {}) =>
    fin({ financeLeaseLiabilities: 5 * M, currentFinanceLeaseLiabilities: 1 * M, financeLeaseAmortization: 0.9 * M, financeLeaseInterest: 0.3 * M, ...extra }, rest);

  test('in: amortization stays in D&A, liabilities in debt, current portion in debt service', () => {
    const r = confirmed(leased());
    expect(r.inputs.ebitda).toBe(15 * M);
    expect(r.inputs.totalExistingDebt).toBe(29 * M);         // 24 + 5
    expect(r.inputs.actualAnnualDebtService).toBe(6 * M);    // 2 + 3 + 1
    expect(r.inputs.maintenanceCapex).toBeCloseTo(3.1 * M);  // 5 - 1 - lease amortization 0.9, lease principal is in debt service
  });

  test('in, without the amortization line: proxy overstates, caveat', () => {
    const f = leased();
    delete f.lineItems.financeLeaseAmortization;
    const r = confirmed(f);
    expect(r.inputs.maintenanceCapex).toBe(4 * M);           // 5 - 1
    expect(r.caveats).toContain('Finance lease amortization not provided. Maintenance capex proxy includes finance lease amortization and overstates capex.');
  });

  test('in, without the current portion: debt service understated, caveat', () => {
    const f = leased();
    delete f.lineItems.currentFinanceLeaseLiabilities;
    const r = confirmed(f);
    expect(r.inputs.actualAnnualDebtService).toBe(5 * M);
    expect(r.caveats).toContain('Current finance lease liabilities not provided. Debt service leaves out lease principal and is understated.');
  });

  test('out: treated as rent across EBITDA, debt, debt service and FCCR rent', () => {
    const r = confirmed(leased({}, { treatmentOverrides: { financeLeases: { rule: 'out', reason: 'Policy for this sponsor' } } }));
    expect(r.inputs.ebitda).toBeCloseTo(13.8 * M);           // 10 + 5 - 0.9 - 0.3
    expect(r.inputs.totalExistingDebt).toBe(24 * M);         // lease liabilities excluded
    expect(r.inputs.actualAnnualDebtService).toBeCloseTo(4.7 * M); // 2 - 0.3 + 3
    expect(r.inputs.leasePayments).toBeCloseTo(2.4 * M);     // rent 1.2 + 0.9 + 0.3
    expect(r.inputs.maintenanceCapex).toBeCloseTo(3.1 * M);  // 5 - 1 - 0.9
  });
});

describe('operating leases in', () => {
  test('rent added back to EBITDA, liabilities in debt, rent in debt service, FCCR rent 0', () => {
    const f = fin({ operatingLeaseLiabilities: 8 * M }, { treatmentOverrides: { operatingLeases: { rule: 'in', reason: 'Rating agency view' } } });
    const r = confirmed(f);
    expect(r.inputs.ebitda).toBe(16.2 * M);                  // 10 + 5 + 1.2
    expect(r.inputs.totalExistingDebt).toBe(32 * M);         // 24 + 8
    expect(r.inputs.actualAnnualDebtService).toBe(6.2 * M);  // 2 + 3 + 1.2
    expect(r.inputs.leasePayments).toBe(0);
  });
});

describe('EBITDA sources', () => {
  // Company Adjusted EBITDA 18, bridge: stock comp 1.5 accepted,
  // restructuring 1.0 rejected, other 0.5 not reviewed.
  const addBacks = [
    { label: 'Stock comp', amount: 1.5 * M, decision: 'accepted' as const },
    { label: 'Restructuring', amount: 1.0 * M, decision: 'rejected' as const },
    { label: 'Other', amount: 0.5 * M, decision: null },
  ];

  test('adjusted: company total less add-backs not accepted', () => {
    const r = confirmed(fin({}, { ebitdaSource: 'adjusted', adjustedEbitda: { value: 18 * M, addBacks } }));
    expect(r.ebitdaSource).toBe('adjusted');
    expect(r.inputs.ebitda).toBe(16.5 * M);                  // 18 - 1.0 - 0.5
    expect(r.derivations.ebitda.label).toBe('Adjusted EBITDA, company-stated, 1 of 3 add-backs accepted');
    expect(r.caveats).toContain('1 add-back not reviewed, excluded from EBITDA.');
    expect(allJudgmentsConfirmed(r)).toBe(false);            // "Other" undecided
  });

  test('built and adjusted compared: gap fully explained by the bridge, no caveat', () => {
    const r = confirmed(fin({}, { adjustedEbitda: { value: 18 * M, addBacks } }));
    expect(r.ebitdaSource).toBe('built');
    expect(r.inputs.ebitda).toBe(15 * M);
    expect(r.comparisons[0]).toMatchObject({ against: 'adjusted', built: 15 * M, company: 18 * M, gap: 3 * M, explained: 3 * M, unexplained: 0, overTolerance: false });
  });

  test('unexplained gap over the 5% tolerance is a caveat that prints the policy', () => {
    const r = confirmed(fin({}, { adjustedEbitda: { value: 19 * M, label: 'Adjusted EBITDA', addBacks } }));
    const c = r.comparisons[0];
    expect(c.unexplained).toBe(1 * M);                        // gap 4 - listed 3
    expect(c.unexplainedPct).toBeCloseTo(1 / 15);             // 6.7%
    expect(c.overTolerance).toBe(true);
    expect(r.caveats).toContain('Adjusted EBITDA is $19.0M against built $15.0M. Unexplained $1.0M, 6.7% of built. Caveat above 5%, your policy.');
  });

  test('the firm tolerance is configurable', () => {
    const r = confirmed(fin({}, { adjustedEbitda: { value: 19 * M, addBacks } }), { ebitdaGapTolerance: 0.1 });
    expect(r.comparisons[0].overTolerance).toBe(false);
  });

  test('stated only: labeled, caveated, compared to built when possible', () => {
    const r = confirmed(fin({}, { ebitdaSource: 'stated', statedEbitda: { value: 15.5 * M, label: 'EBITDA' } }));
    expect(r.inputs.ebitda).toBe(15.5 * M);
    expect(r.derivations.ebitda.label).toBe('EBITDA, stated, not built');
    expect(r.caveats).toContain('EBITDA is stated, not built from statements. The definition is the company\'s.');
    expect(r.comparisons[0]).toMatchObject({ gap: 0.5 * M, unexplained: 0.5 * M, overTolerance: false }); // 3.3%
  });

  test('without built lines, adjusted is proposed and the missing build is a caveat, not an error', () => {
    const f = without('operatingIncome');
    f.adjustedEbitda = { value: 18 * M, addBacks: [] };
    const r = buildBorrowerInputs(f);
    expect(r.ebitdaSource).toBe('adjusted');
    expect(r.inputs.ebitda).toBe(18 * M);
    expect(r.errors).toEqual([]);
    expect(r.caveats).toContain('Built EBITDA not possible: Operating income is missing.');
  });

  test('a stored source that is not available falls back to the proposal', () => {
    const r = buildBorrowerInputs(fin({}, { ebitdaSource: 'adjusted' }));
    expect(r.ebitdaSource).toBe('built');
  });
});

describe('company EBITDA on the treatment basis', () => {
  // Rental company, corporate fleet treatment. Stated EBITDA 25 is before
  // vehicle depreciation 18 and vehicle interest 4.5.
  const rental = () => fin({ vehicleDepreciation: 18 * M, vehicleInterest: 4.5 * M, vehicleDebt: 50 * M, interestPaid: 6.5 * M },
    { ebitdaSource: 'stated', statedEbitda: { value: 25 * M, label: 'EBITDA' } });

  test('stated EBITDA before vehicle costs is moved after them, pairing with non-vehicle debt', () => {
    const f = confirmAll(rental());
    f.judgments!['companyBasis.stated.captiveFleet'] = { confirmed: false };
    const r = buildBorrowerInputs(f);
    expect(r.inputs.ebitda).toBe(2.5 * M);                   // 25 - 18 - 4.5
    expect(r.inputs.totalExistingDebt).toBe(24 * M);
    expect(r.derivations.ebitda.notes).toContain('Moved onto this deal\'s treatment basis.');
  });

  test('unconfirmed basis is a caveat, and a basis that needs a missing line is an error', () => {
    expect(buildBorrowerInputs(rental()).caveats).toContain('Proposed, not confirmed: company stated EBITDA is after vehicle depreciation and interest.');
    const f = confirmAll(rental());
    f.judgments!['companyBasis.stated.captiveFleet'] = { confirmed: false };
    delete f.lineItems.vehicleInterest;
    f.lineItems.vehicleDebt = { value: 50 * M };
    const r = buildBorrowerInputs(f);
    expect(r.inputs.ebitda).toBeNull();
    expect(r.errors).toContain('Vehicle interest is missing. Needed to put company EBITDA on this deal\'s treatment.');
  });

  // Operating leases in. Company Adjusted 18 is after rent 1.2. Bridge 3.
  const opLeasesIn = (rest: Partial<BorrowerFinancials> = {}) => fin({ operatingLeaseLiabilities: 8 * M }, {
    treatmentOverrides: { operatingLeases: { rule: 'in', reason: 'Rating agency view' } },
    adjustedEbitda: { value: 18 * M, addBacks: [{ label: 'Stock comp', amount: 3 * M, decision: 'accepted' }] },
    ...rest,
  });

  test('adjusted EBITDA after rent gets rent added back under operating leases in', () => {
    const f = confirmAll(opLeasesIn({ ebitdaSource: 'adjusted' }));
    f.judgments!['companyBasis.adjusted.operatingLeases'] = { confirmed: true };
    expect(buildBorrowerInputs(f).inputs.ebitda).toBe(19.2 * M); // 18 + rent 1.2
  });

  test('the gap comparison counts the treatment as explained, not the company', () => {
    const f = confirmAll(opLeasesIn());
    f.judgments!['companyBasis.adjusted.operatingLeases'] = { confirmed: true };
    const r = buildBorrowerInputs(f);
    expect(r.inputs.ebitda).toBe(16.2 * M);                  // built: 10 + 5 + 1.2
    const c = r.comparisons[0];
    expect(c.gap).toBeCloseTo(1.8 * M);                      // 18 - 16.2
    expect(c.explainedByAddBacks).toBe(3 * M);
    expect(c.explainedByTreatment).toBeCloseTo(-1.2 * M);    // rent the company deducted and the treatment adds back
    expect(c.unexplained).toBeCloseTo(0);
    expect(c.overTolerance).toBe(false);
  });
});

describe('what current maturities include', () => {
  test('finance leases in, already inside current maturities: not added twice', () => {
    const f = confirmAll(fin({ financeLeaseLiabilities: 5 * M, currentFinanceLeaseLiabilities: 1 * M, financeLeaseAmortization: 0.9 * M }));
    f.judgments!['currentMaturitiesInclude.financeLeases'] = { confirmed: true };
    const r = buildBorrowerInputs(f);
    expect(r.inputs.actualAnnualDebtService).toBe(5 * M);    // 2 + 3, lease principal inside the 3
    expect(r.derivations.actualAnnualDebtService.notes).toContain('Lease principal already inside current maturities.');
  });

  test('finance leases out, inside current maturities: lease principal taken out', () => {
    const f = confirmAll(fin({ financeLeaseLiabilities: 5 * M, currentFinanceLeaseLiabilities: 1 * M, financeLeaseAmortization: 0.9 * M, financeLeaseInterest: 0.3 * M },
      { treatmentOverrides: { financeLeases: { rule: 'out', reason: 'Policy' } } }));
    f.judgments!['currentMaturitiesInclude.financeLeases'] = { confirmed: true };
    expect(buildBorrowerInputs(f).inputs.actualAnnualDebtService).toBeCloseTo(3.7 * M); // 2 - 0.3 + 3 - 1
  });

  test('corporate fleet, vehicle debt inside current maturities: vehicle principal taken out', () => {
    const f = confirmAll(fin({ vehicleDepreciation: 1 * M, vehicleInterest: 0.5 * M, vehicleDebt: 10 * M, interestPaid: 2.5 * M, currentMaturities: 5 * M, currentVehicleDebtMaturities: 2 * M }));
    f.judgments!['currentMaturitiesInclude.vehicleDebt'] = { confirmed: true };
    expect(buildBorrowerInputs(f).inputs.actualAnnualDebtService).toBe(5 * M); // 2.5 - 0.5 + 5 - 2
  });

  test('floorplan inside current maturities: taken out under either treatment', () => {
    const f = confirmAll(fin({ floorplanPayable: 30 * M, floorplanInterest: 2.5 * M, interestPaid: 4.5 * M, currentMaturities: 33 * M }));
    f.judgments!['currentMaturitiesInclude.floorplan'] = { confirmed: true };
    expect(buildBorrowerInputs(f).inputs.actualAnnualDebtService).toBe(5 * M); // 4.5 - 2.5 + 33 - 30
  });

  test('proposed: current maturities exclude each item', () => {
    const r = buildBorrowerInputs(fin({ financeLeaseLiabilities: 5 * M }));
    expect(r.caveats).toContain('Proposed, not confirmed: current maturities exclude finance leases.');
  });
});

describe('cash taxes', () => {
  test('a net refund counts as 0, with a note', () => {
    const r = confirmed(fin({ incomeTaxesPaid: -2 * M }));
    expect(r.inputs.cashTaxes).toBe(0);
    expect(r.derivations.cashTaxes.notes).toEqual(['Net tax refund $2.0M. Counted as 0, a refund is not repeatable.']);
  });
});

describe('negative EBITDA', () => {
  test('passes through as negative with a caveat, never floored', () => {
    const r = confirmed(fin({ operatingIncome: -8 * M }));
    expect(r.inputs.ebitda).toBe(-3 * M);                    // -8 + 5
    expect(r.caveats).toContain('EBITDA is -$3.0M. Leverage and coverage cannot be read as normal.');
  });
});

test('defaults match the design', () => {
  expect(DEFAULT_TREATMENT_RULES).toEqual({
    financeLeases: 'in', operatingLeases: 'out', floorplan: 'out', captiveFleet: 'corporate', ebitdaGapTolerance: 0.05,
  });
});

describe('validateTreatmentRules', () => {

  test('missing or malformed settings give the defaults', () => {
    expect(validateTreatmentRules(undefined)).toEqual(DEFAULT_TREATMENT_RULES);
    expect(validateTreatmentRules('in')).toEqual(DEFAULT_TREATMENT_RULES);
  });

  test('valid values kept, invalid ones fall back row by row', () => {
    expect(validateTreatmentRules({ floorplan: 'in', captiveFleet: 'everything', financeLeases: 'out', ebitdaGapTolerance: 0.1 }))
      .toEqual({ ...DEFAULT_TREATMENT_RULES, floorplan: 'in', financeLeases: 'out', ebitdaGapTolerance: 0.1 });
  });

  test('tolerance outside 0 to 1 is ignored', () => {
    expect(validateTreatmentRules({ ebitdaGapTolerance: 5 }).ebitdaGapTolerance).toBe(0.05);
    expect(validateTreatmentRules({ ebitdaGapTolerance: -0.1 }).ebitdaGapTolerance).toBe(0.05);
    expect(validateTreatmentRules({ ebitdaGapTolerance: '0.08' }).ebitdaGapTolerance).toBe(0.08);
  });
});

describe('setTreatmentOverride', () => {
  const firm = DEFAULT_TREATMENT_RULES;

  test('needs a reason', () => {
    const r = setTreatmentOverride(fin(), 'floorplan', 'in', '  ', firm, 'u1');
    expect(r.error).toBe('An override needs a reason.');
    expect(r.financials.treatmentOverrides).toBeUndefined();
  });

  test('records rule, trimmed reason, who and when, and the build applies it', () => {
    const r = setTreatmentOverride(fin({ floorplanPayable: 30 * M, floorplanInterest: 2.5 * M }), 'floorplan', 'in', ' Credit agreement ', firm, 'u1', '2026-10-09T00:00:00Z');
    expect(r.error).toBeNull();
    expect(r.financials.treatmentOverrides!.floorplan).toEqual({ rule: 'in', reason: 'Credit agreement', by: 'u1', at: '2026-10-09T00:00:00Z' });
    expect(buildBorrowerInputs(r.financials).treatment.floorplan).toBe('in');
  });

  test('setting the firm rule clears the override', () => {
    const withOverride = setTreatmentOverride(fin(), 'floorplan', 'in', 'Reason', firm).financials;
    const cleared = setTreatmentOverride(withOverride, 'floorplan', 'out', '', firm).financials;
    expect(cleared.treatmentOverrides!.floorplan).toBeUndefined();
  });

  test('refuses a rule that is not an option for the row', () => {
    expect(setTreatmentOverride(fin(), 'floorplan', 'corporate' as any, 'Reason', firm).error).toBe('"corporate" is not a floorplan treatment.');
  });
});


test('no choice, no question: operating income only and one EBITDA source', () => {
  const ids = buildBorrowerInputs(fin()).judgments.map((j) => j.id);
  expect(ids).not.toContain('ebitdaStart');
  expect(ids).not.toContain('ebitdaSource');
  // A company figure makes the source a real choice.
  expect(buildBorrowerInputs(fin({}, { statedEbitda: { value: 16 * M } })).judgments.map((j) => j.id)).toContain('ebitdaSource');
});

test('a non-cash gain inside operating income comes out of EBITDA, never an add-back', () => {
  const r = confirmed(fin({ nonCashGainsInOperatingIncome: 6 * M }));
  expect(r.inputs.ebitda).toBe(9 * M);                       // 10 + 5 - 6
  expect(r.derivations.ebitda.notes).toContain('Non-cash gains taken out of operating income.');
  expect(confirmed(fin({ nonCashGainsInOperatingIncome: -6 * M })).inputs.ebitda).toBe(15 * M); // a negative entry is ignored
});
