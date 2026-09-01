// Guards the debt-service definition used when an org overrides its spreads.
//
// App.js recomputes metrics when an org sets a custom base or credit spread
// in Settings. That path used `netFinanced * rate`, which is interest only,
// against modules that amortize (newAnnualDebtService = monthlyPayment * 12).
// The result was that any org with a custom spread scored DSCR against a
// more generous rule than the defaults, on the highest-weighted factor and
// the primary pass/fail gate.
//
// These tests describe the two shapes rather than reaching into App.js:
// a term facility amortizes, a revolver does not.

import { calculateMonthlyPayment } from './format';

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
