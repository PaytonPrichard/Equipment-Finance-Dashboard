// Guards the debt-service definition used when an org overrides its spreads.
//
// App.js recomputes metrics when an org sets a custom base or credit spread
// in Settings. That path used `netFinanced * rate`, which is interest only,
// against modules that amortize (newAnnualDebtService = monthlyPayment * 12).
// The result was that any org with a custom spread scored DSCR against a
// more generous rule than the defaults, on the highest-weighted factor and
// the primary pass/fail gate.
//
// The shape tests below predate the extraction of this logic out of App.js.
// applyOrgSpread now exists as a real function, so the block at the bottom
// exercises it directly rather than only describing what it should do.

import { calculateMonthlyPayment } from './format';
import { applyOrgSpread } from './dealMetrics';

describe('debt service under an org spread override', () => {
  // The Granite Ridge facility from the sample corpus.
  const netFinanced = 5333750;
  const termMonths = 84;
  const rate = 0.07;

  const amortizingAnnualDs = calculateMonthlyPayment(netFinanced, rate, termMonths) * 12;
  const interestOnlyAnnualDs = netFinanced * rate;

  test('an amortizing facility costs far more per year than interest only', () => {
    // The gap is the size of the bug: 2.6x on this deal.
    expect(amortizingAnnualDs / interestOnlyAnnualDs).toBeGreaterThan(2.5);
    expect(Math.round(amortizingAnnualDs)).toBe(966007);
    expect(Math.round(interestOnlyAnnualDs)).toBe(373363);
  });

  test('the difference moves DSCR by more than a rounding amount', () => {
    const ebitda = 7400000;
    const existingDs = 2310000;
    const correct = ebitda / (existingDs + amortizingAnnualDs);
    const wrong = ebitda / (existingDs + interestOnlyAnnualDs);

    expect(correct).toBeCloseTo(2.26, 1);
    expect(wrong).toBeCloseTo(2.76, 1);
    // Over 20% overstatement of the primary gate.
    expect(wrong / correct).toBeGreaterThan(1.2);
  });

  test('a term facility at a higher rate still amortizes', () => {
    // Sanity: the helper responds to rate, so the override actually differs
    // from the base case rather than returning a constant.
    const higher = calculateMonthlyPayment(netFinanced, 0.09, termMonths) * 12;
    expect(higher).toBeGreaterThan(amortizingAnnualDs);
  });

  test('a zero-length term does not produce a payment', () => {
    expect(calculateMonthlyPayment(netFinanced, rate, 0)).toBe(0);
  });

  test('a revolver is interest only by nature, so rate times balance is right', () => {
    // ABL revolvers do not amortize. The override path keeps this shape for
    // borrowing-base facilities, and that is correct.
    const borrowingBase = 8500000;
    expect(borrowingBase * rate).toBeCloseTo(595000, 0);
  });
});

// ---------------------------------------------------------------------------
// The function itself. This is what App.js and the pipeline drawer both call,
// so a regression here shows up on every surface at once rather than on one.
// ---------------------------------------------------------------------------

describe('applyOrgSpread', () => {
  const termInputs = { ebitda: 7400000, loanTerm: 84, creditRating: 'Adequate' };
  const termMetrics = {
    rate: 0.07,
    netFinanced: 5333750,
    existingDebtService: 2310000,
    newAnnualDebtService: 900000,
    dscr: 2.3,
    rateInfo: { baseSpread: 200, creditAdj: 0 },
  };

  test('returns the metrics untouched when the org has set no override', () => {
    expect(applyOrgSpread(termMetrics, termInputs, {})).toBe(termMetrics);
    expect(applyOrgSpread(termMetrics, termInputs, undefined)).toBe(termMetrics);
  });

  test('returns the metrics untouched when an override nets to zero change', () => {
    // Setting the base spread to exactly what the module already used is not
    // an override in any meaningful sense.
    expect(applyOrgSpread(termMetrics, termInputs, { baseSpreadBps: 200 })).toBe(termMetrics);
  });

  test('a wider spread raises the rate and lowers coverage', () => {
    const out = applyOrgSpread(termMetrics, termInputs, { baseSpreadBps: 400 });
    expect(out.rate).toBeCloseTo(0.09, 6);
    expect(out.effectiveRate).toBeCloseTo(0.09, 6);
    expect(out.dscr).toBeLessThan(termMetrics.dscr);
  });

  test('a term facility amortizes rather than being priced interest only', () => {
    // The bug this guards: newAnnualDebtService was netFinanced * rate, which
    // understated annual debt service 2.6x on this facility and inflated DSCR
    // by 22% for any firm that customised its spreads.
    const out = applyOrgSpread(termMetrics, termInputs, { baseSpreadBps: 400 });
    const interestOnly = termMetrics.netFinanced * out.rate;
    expect(out.newAnnualDebtService).toBeGreaterThan(interestOnly * 1.2);
    expect(out.newAnnualDebtService).toBeCloseTo(
      calculateMonthlyPayment(termMetrics.netFinanced, out.rate, 84) * 12,
      0,
    );
  });

  test('a revolver stays interest only, because it does not amortize', () => {
    const revolverMetrics = {
      rate: 0.07,
      borrowingBase: 8500000,
      existingDebtService: 500000,
      newAnnualDebtService: 595000,
      dscr: 2.0,
      rateInfo: { baseSpread: 250, creditAdj: 0 },
    };
    const out = applyOrgSpread(revolverMetrics, { ebitda: 3000000 }, { baseSpreadBps: 350 });
    expect(out.rate).toBeCloseTo(0.08, 6);
    expect(out.newAnnualDebtService).toBeCloseTo(8500000 * 0.08, 0);
  });

  test('the credit adjustment only applies to the rating it names', () => {
    const strong = applyOrgSpread(
      termMetrics,
      { ...termInputs, creditRating: 'Strong' },
      { creditSpreadStrong: -200 },
    );
    const adequate = applyOrgSpread(
      termMetrics,
      { ...termInputs, creditRating: 'Adequate' },
      { creditSpreadStrong: -200 },
    );
    expect(strong.rate).toBeLessThan(termMetrics.rate);
    expect(adequate).toBe(termMetrics);
  });
});
