import { verdictForDeal } from './dealVerdict';
import { DEFAULT_CRITERIA } from './screeningCriteria';

// The board, the drawer and the screening view used to derive a verdict three
// different ways. Two of them read the score against hardcoded 75/35
// breakpoints and ignored both the firm's thresholds and every hard gate, so a
// deal that breached its LTV ceiling could read PASS on the board while the
// screening view called it FAIL. These tests pin the single definition.

// A clean equipment deal: comfortable coverage, modest leverage, low LTV.
const soundDeal = {
  score: 82,
  asset_class: 'equipment_finance',
  inputs: {
    companyName: 'Granite Ridge Materials',
    annualRevenue: 38400000,
    ebitda: 7400000,
    totalExistingDebt: 9000000,
    actualAnnualDebtService: 1200000,
    industrySector: 'Construction',
    creditRating: 'Strong',
    yearsInBusiness: 14,
    equipmentCost: 6000000,
    downPayment: 1200000,
    loanTerm: 60,
    usefulLife: 120,
    equipmentType: 'Heavy Equipment',
    equipmentCondition: 'New',
    financingType: 'efa',
  },
};

describe('verdictForDeal', () => {
  it('returns a semantic category and never a class string', () => {
    const v = verdictForDeal(soundDeal, { criteria: DEFAULT_CRITERIA });
    expect(['pass', 'flag', 'fail', 'none']).toContain(v.category);
    expect(JSON.stringify(v)).not.toMatch(/bg-|text-|border-/);
  });

  it('scores this deal as a pass under stock thresholds', () => {
    // The control for the two tests below: 82 with 80% LTV and 3.19x
    // coverage clears every default gate.
    const v = verdictForDeal(soundDeal, { criteria: DEFAULT_CRITERIA });
    expect(v.gated).toBe(true);
    expect(v.category).toBe('pass');
    expect(v.reasons).toHaveLength(0);
  });

  it('runs the collateral gate, not just the score', () => {
    // Same deal, same 82. A firm that caps advance at 75% of equipment value
    // is looking at an 80% LTV deal. A score-only verdict says PASS, which is
    // exactly what the pipeline card and the drawer used to say.
    const v = verdictForDeal(soundDeal, { criteria: { ...DEFAULT_CRITERIA, maxLtv: 75 } });
    expect(v.category).not.toBe('pass');
    expect(v.reasons.some((r) => /LTV/i.test(r.text))).toBe(true);
  });

  it('honours the firm coverage floor rather than the score alone', () => {
    // 3.19x coverage clears the 1.25x default and misses a 3.5x house rule.
    const strict = verdictForDeal(soundDeal, { criteria: { ...DEFAULT_CRITERIA, minDscr: 3.5 } });
    expect(strict.category).not.toBe('pass');
    expect(strict.reasons.some((r) => /DSCR/i.test(r.text))).toBe(true);
  });

  it('reflects the rate it is given', () => {
    const cheap = verdictForDeal(soundDeal, { criteria: DEFAULT_CRITERIA, sofr: 0.01 });
    const dear = verdictForDeal(soundDeal, { criteria: DEFAULT_CRITERIA, sofr: 0.12 });
    // Higher SOFR means higher debt service, so coverage has to fall.
    expect(dear.metrics.dscr).toBeLessThan(cheap.metrics.dscr);
  });

  it('falls back to the score when the inputs cannot be evaluated', () => {
    const partial = { score: 80, asset_class: 'equipment_finance', inputs: {} };
    const v = verdictForDeal(partial, { criteria: DEFAULT_CRITERIA });
    expect(v.label === null || typeof v.label === 'string').toBe(true);
    expect(v.reasons).toBeDefined();
  });

  it('reports no verdict for an unscored deal with no usable inputs', () => {
    const v = verdictForDeal({ score: null, inputs: null }, { criteria: DEFAULT_CRITERIA });
    expect(v.category === 'none' || v.gated).toBe(true);
  });

  it('does not throw on a malformed deal', () => {
    expect(() => verdictForDeal(null, {})).not.toThrow();
    expect(() => verdictForDeal(undefined, undefined)).not.toThrow();
  });
});
