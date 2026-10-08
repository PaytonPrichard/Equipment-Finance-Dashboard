import { computeCashFlowAnalysis, providedValue, fccrFor, describeMissing } from './cashFlowMetrics';
import { DEFAULT_CRITERIA, evaluateScreening } from '../lib/screeningCriteria';

// One borrower, worked by hand.
//
//   Revenue 50.0M, EBITDA 8.0M, existing debt 20.0M
//   Debt service: existing 2.0M + new 1.0M = 3.0M
//   Cash taxes 1.0M, maintenance capex 1.5M, working capital increase 0.5M,
//   rent 0.4M, half of existing debt floating.
//
//   Free cash flow = 8.0 - 1.0 - 1.5 - 0.5 = 5.0     cash-flow DSCR = 5.0 / 3.0 = 1.667x
//   FCCR = (8.0 + 0.4 - 1.5 - 1.0) / (3.0 + 0.4) = 5.9 / 3.4 = 1.735x
const inputs = {
  annualRevenue: 50_000_000,
  ebitda: 8_000_000,
  totalExistingDebt: 20_000_000,
  cashTaxes: 1_000_000,
  maintenanceCapex: 1_500_000,
  workingCapitalIncrease: 500_000,
  leasePayments: 400_000,
  floatingRateDebtPct: 50,
};
const metrics = {
  dscr: 8 / 3,
  leverage: 2.5,
  existingDebtService: 2_000_000,
  newAnnualDebtService: 1_000_000,
  debtServiceEstimated: false,
  newFloatingPrincipal: 0,
};
const byKey = (a) => Object.fromEntries(a.scenarios.map((s) => [s.key, s]));

describe('base case', () => {
  const a = computeCashFlowAnalysis(inputs, metrics, DEFAULT_CRITERIA);

  test('free cash flow takes out taxes, capex and working capital', () => {
    expect(a.base.freeCashFlow).toBe(5_000_000);
  });
  test('cash-flow DSCR = 5.0 / 3.0', () => {
    expect(a.base.cashFlowDscr).toBeCloseTo(1.6667, 4);
  });
  test('FCCR adds rent back on top and charges it once below', () => {
    expect(a.base.fccr).toBeCloseTo(5.9 / 3.4, 4);
  });
  test('plain DSCR unchanged', () => {
    expect(a.base.dscr).toBeCloseTo(8 / 3, 4);
  });
  test('nothing missing', () => {
    expect(a.missing).toEqual({ cashFlowDscr: [], fccr: [] });
  });
});

describe('stress scenarios at default settings', () => {
  const s = byKey(computeCashFlowAnalysis(inputs, metrics, DEFAULT_CRITERIA));

  test('runs base plus seven scenarios', () => {
    expect(Object.keys(s)).toEqual([
      'base', 'revenue_mild', 'revenue_moderate', 'revenue_severe', 'margin', 'rate', 'working_capital', 'combined',
    ]);
  });
  test('revenue -20% at constant margin: EBITDA 6.4M, FCF 3.4M', () => {
    expect(s.revenue_moderate.ebitda).toBeCloseTo(6_400_000, 0);
    expect(s.revenue_moderate.cashFlowDscr).toBeCloseTo(3.4 / 3, 4);
    expect(s.revenue_moderate.fccr).toBeCloseTo(4.3 / 3.4, 4);
  });
  test('margin -200 bps takes 1.0M off EBITDA on 50M of revenue', () => {
    expect(s.margin.ebitda).toBeCloseTo(7_000_000, 0);
    expect(s.margin.cashFlowDscr).toBeCloseTo(4 / 3, 4);
  });
  test('rate +200 bps on 50% of 20M existing debt adds 0.2M of interest', () => {
    expect(s.rate.debtService).toBeCloseTo(3_200_000, 0);
    expect(s.rate.cashFlowDscr).toBeCloseTo(5 / 3.2, 4);
    expect(s.rate.fccr).toBeCloseTo(5.9 / 3.6, 4);
  });
  test('customers paying 20 days slower ties up 50M x 20/365', () => {
    const drag = 50_000_000 * 20 / 365;
    expect(s.working_capital.workingCapitalIncrease).toBeCloseTo(500_000 + drag, 0);
    expect(s.working_capital.cashFlowDscr).toBeCloseTo((5_000_000 - drag) / 3_000_000, 4);
    // FCCR has no working-capital term, so this scenario does not move it.
    expect(s.working_capital.fccr).toBeCloseTo(s.base.fccr, 10);
  });
  test('combined severe: 40M revenue at 14% margin = 5.6M EBITDA', () => {
    expect(s.combined.ebitda).toBeCloseTo(5_600_000, 0);
    expect(s.combined.cashFlowDscr).toBeCloseTo(2.6 / 3, 4);
    expect(s.combined.fccr).toBeCloseTo(3.5 / 3.4, 4);
  });
});

describe('scenario settings are the firm\'s', () => {
  test('a scenario set to 0 is not run', () => {
    const a = computeCashFlowAnalysis(inputs, metrics, { ...DEFAULT_CRITERIA, stressMarginCompressionBps: 0 });
    expect(byKey(a).margin).toBeUndefined();
  });
  test('the severe case follows the settings', () => {
    const a = computeCashFlowAnalysis(inputs, metrics, {
      ...DEFAULT_CRITERIA, stressCombinedRevenueDecline: 30, stressCombinedMarginBps: 300,
    });
    // 35M of revenue; EBITDA 8.0 x 0.7 - 35 x 0.03 = 5.6 - 1.05 = 4.55M
    expect(byKey(a).combined.ebitda).toBeCloseTo(4_550_000, 0);
  });
});

describe('missing inputs are never filled in', () => {
  test('blank fields leave both metrics null and named', () => {
    const a = computeCashFlowAnalysis({ annualRevenue: 50_000_000, ebitda: 8_000_000 }, metrics, DEFAULT_CRITERIA);
    expect(a.base.cashFlowDscr).toBeNull();
    expect(a.base.fccr).toBeNull();
    expect(a.missing.cashFlowDscr).toEqual(['cashTaxes', 'maintenanceCapex', 'workingCapitalIncrease']);
    expect(a.missing.fccr).toEqual(['cashTaxes', 'maintenanceCapex', 'leasePayments']);
  });
  test('one blank is enough to withhold the metric', () => {
    const a = computeCashFlowAnalysis({ ...inputs, cashTaxes: '' }, metrics, DEFAULT_CRITERIA);
    expect(a.base.cashFlowDscr).toBeNull();
    expect(a.base.fccr).toBeNull();
  });
  test('an entered 0 is an answer for rent, taxes and working capital', () => {
    expect(providedValue({ leasePayments: 0 }, 'leasePayments')).toBe(0);
    expect(providedValue({ cashTaxes: 0 }, 'cashTaxes')).toBe(0);
    expect(providedValue({ workingCapitalIncrease: -250_000 }, 'workingCapitalIncrease')).toBe(-250_000);
  });
  test('maintenance capex of 0 reads as not entered (saved deals stored blank as 0)', () => {
    expect(providedValue({ maintenanceCapex: 0 }, 'maintenanceCapex')).toBeNull();
  });
  test('no 3%-of-revenue capex default any more', () => {
    expect(fccrFor({ annualRevenue: 50_000_000, cashTaxes: 0, leasePayments: 0 }, 8_000_000, 3_000_000)).toBeNull();
  });
  test('describeMissing reads as a sentence', () => {
    expect(describeMissing(['cashTaxes', 'maintenanceCapex', 'leasePayments'])).toBe('cash taxes, maintenance capex and rent');
  });
});

describe('rate shock coverage', () => {
  test('a revolver takes the shock on its full draw', () => {
    const a = computeCashFlowAnalysis({ ...inputs, floatingRateDebtPct: null }, { ...metrics, newFloatingPrincipal: 10_000_000 }, DEFAULT_CRITERIA);
    expect(byKey(a).rate.debtService).toBeCloseTo(3_200_000, 0);
  });
  test('says so when existing debt was not shocked', () => {
    const a = computeCashFlowAnalysis({ ...inputs, floatingRateDebtPct: null }, { ...metrics, newFloatingPrincipal: 10_000_000 }, DEFAULT_CRITERIA);
    expect(a.assumptions).toContain('Rate shock does not cover existing debt. Floating share of existing debt not provided.');
  });
  test('one caveat, not two, when nothing floats and the share is blank', () => {
    const a = computeCashFlowAnalysis({ ...inputs, floatingRateDebtPct: null }, metrics, DEFAULT_CRITERIA);
    expect(a.assumptions.filter((t) => t.startsWith('Rate shock'))).toEqual([
      'Rate shock changes nothing here. The new facility is fixed rate and the floating share of existing debt was not provided.',
    ]);
  });
});

describe('verdict', () => {
  const riskScore = { composite: 90, factors: {} };
  const run = (i, m = metrics, c = DEFAULT_CRITERIA) => evaluateScreening(c, m, riskScore, i, 'equipment_finance');

  test('combined severe case below 1.0x flags the deal', () => {
    const r = run(inputs);
    expect(r.verdict).toBe('flag');
    expect(r.reasons.map((x) => x.text)).toEqual([
      'Breaks under stress: cash-flow DSCR 0.87x in the combined severe case (revenue -20% and margin -200 bps)',
    ]);
  });
  test('passes when the severe case holds', () => {
    // Working capital released instead of consumed: FCF 6.0M, severe 3.6M / 3.0M = 1.20x
    const r = run({ ...inputs, workingCapitalIncrease: -500_000 });
    expect(r.verdict).toBe('pass');
  });
  test('FCCR between 1.0x and the floor flags', () => {
    // Taxes 2.4M: FCCR (8.4 - 1.5 - 2.4) / 3.4 = 4.5 / 3.4 = 1.32x passes;
    // taxes 3.1M: 3.8 / 3.4 = 1.118x passes; taxes 3.2M: 3.7 / 3.4 = 1.088x flags.
    const r = run({ ...inputs, cashTaxes: 3_200_000, workingCapitalIncrease: -5_000_000 });
    expect(r.reasons.some((x) => x.level === 'flag' && x.text === 'FCCR 1.09x is below minimum (1.1x)')).toBe(true);
  });
  test('FCCR below 1.0x fails', () => {
    const r = run({ ...inputs, cashTaxes: 4_000_000, workingCapitalIncrease: -5_000_000 });
    expect(r.verdict).toBe('fail');
    expect(r.reasons.some((x) => x.level === 'fail' && x.text.startsWith('FCCR 0.85x is below 1.0x'))).toBe(true);
  });
  test('a floor of 0 is off', () => {
    const r = run({ ...inputs, cashTaxes: 3_200_000, workingCapitalIncrease: -5_000_000 }, metrics, { ...DEFAULT_CRITERIA, minFccr: 0 });
    expect(r.reasons.some((x) => x.text.startsWith('FCCR'))).toBe(false);
  });
  test('missing inputs add notes, never a flag', () => {
    const r = run({ annualRevenue: 50_000_000, ebitda: 8_000_000 });
    expect(r.verdict).toBe('pass');
    expect(r.notes).toEqual([
      'Cash-flow DSCR not provided: missing cash taxes, maintenance capex and change in working capital.',
      'FCCR not provided: missing cash taxes, maintenance capex and rent.',
    ]);
  });
});
