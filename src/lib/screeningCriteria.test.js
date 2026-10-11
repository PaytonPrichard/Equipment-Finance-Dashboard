import { evaluateScreening, DEFAULT_CRITERIA, validateCriteria } from './screeningCriteria';

describe('Screening Criteria', () => {
  const baseCriteria = { ...DEFAULT_CRITERIA };

  const passMetrics = { dscr: 2.0, leverage: 2.5, ltv: 0.75, termCoverage: 60 };
  const passScore = { composite: 80, factors: {} };
  const passInputs = { annualRevenue: 50000000, yearsInBusiness: 10 };

  describe('evaluateScreening', () => {
    test('returns pass for strong deal', () => {
      const result = evaluateScreening(baseCriteria, passMetrics, passScore, passInputs, 'equipment_finance');
      expect(result.verdict).toBe('pass');
    });

    test('returns fail for low score', () => {
      const lowScore = { composite: 20, factors: {} };
      const result = evaluateScreening(baseCriteria, passMetrics, lowScore, passInputs, 'equipment_finance');
      expect(result.verdict).toBe('fail');
    });

    test('returns flag for mid-range score', () => {
      const midScore = { composite: 50, factors: {} };
      const result = evaluateScreening(baseCriteria, passMetrics, midScore, passInputs, 'equipment_finance');
      expect(result.verdict).toBe('flag');
    });

    // LTV was never evaluated in the verdict: a `maxLtv < 100` guard turned
    // the check off at the default of 100. The factor score and the
    // commentary both reacted to high LTV; only the pass/flag/fail verdict
    // stayed silent, which is the part an analyst actually reads.
    describe('LTV', () => {
      test('LTV above the maximum flags, at the default criteria', () => {
        const highLtv = { ...passMetrics, ltv: 1.06 };
        const result = evaluateScreening(baseCriteria, highLtv, passScore, passInputs, 'equipment_finance');
        expect(result.verdict).toBe('flag');
        expect(result.reasons.some((r) => /LTV 106% exceeds maximum/.test(r.text))).toBe(true);
      });

      test('lending well past the equipment value does not screen clean', () => {
        // The spec: "LTV above 100% means the lender has negative equity
        // from day one."
        const underwater = { ...passMetrics, ltv: 1.5 };
        const result = evaluateScreening(baseCriteria, underwater, passScore, passInputs, 'equipment_finance');
        expect(result.verdict).not.toBe('pass');
      });

      test('LTV at or below the maximum is silent', () => {
        const ok = { ...passMetrics, ltv: 0.9 };
        const result = evaluateScreening(baseCriteria, ok, passScore, passInputs, 'equipment_finance');
        expect(result.reasons.some((r) => /LTV/.test(r.text))).toBe(false);
      });

      test('the default cost limit is 90%, so 10% down is the floor', () => {
        // Net financed cannot exceed cost, so the old 100% default never fired.
        expect(DEFAULT_CRITERIA.maxLtv).toBe(90);
        const thin = evaluateScreening(baseCriteria, { ...passMetrics, ltv: 0.91 }, passScore, passInputs, 'equipment_finance');
        expect(thin.reasons.some((r) => /^LTV 91% exceeds maximum \(90%\)/.test(r.text))).toBe(true);
      });

      test('a tighter firm limit is honoured', () => {
        const strict = { ...baseCriteria, maxLtv: 80 };
        const result = evaluateScreening(strict, passMetrics, passScore, passInputs, 'equipment_finance');
        expect(result.reasons.some((r) => /LTV 75% exceeds maximum \(80%\)/.test(r.text))).toBe(false);
        const over = evaluateScreening(strict, { ...passMetrics, ltv: 0.85 }, passScore, passInputs, 'equipment_finance');
        expect(over.reasons.some((r) => /LTV 85% exceeds maximum \(80%\)/.test(r.text))).toBe(true);
      });

      test('0 disables the check, per the convention for shared limits', () => {
        const disabled = { ...baseCriteria, maxLtv: 0 };
        const result = evaluateScreening(disabled, { ...passMetrics, ltv: 2.0 }, passScore, passInputs, 'equipment_finance');
        expect(result.reasons.some((r) => /LTV/.test(r.text))).toBe(false);
      });

      test('LTV is not evaluated for AR or inventory deals', () => {
        // Neither module produces an ltv metric; the check is equipment-only.
        const result = evaluateScreening(baseCriteria, { ...passMetrics, ltv: 1.5 }, passScore, passInputs, 'accounts_receivable');
        expect(result.reasons.some((r) => /LTV/.test(r.text))).toBe(false);
      });
    });

    test('DSCR below 1.0 always fails', () => {
      const lowDscr = { ...passMetrics, dscr: 0.8 };
      const result = evaluateScreening(baseCriteria, lowDscr, passScore, passInputs, 'equipment_finance');
      expect(result.verdict).toBe('fail');
      expect(result.reasons.some(r => r.level === 'fail' && r.text.includes('DSCR'))).toBe(true);
    });

    test('high leverage flags', () => {
      const highLev = { ...passMetrics, leverage: 6.0 };
      const result = evaluateScreening(baseCriteria, highLev, passScore, passInputs, 'equipment_finance');
      expect(result.reasons.some(r => r.text.includes('Leverage'))).toBe(true);
    });

    test('extremely high leverage fails', () => {
      const extremeLev = { ...passMetrics, leverage: 8.0 };
      const result = evaluateScreening(baseCriteria, extremeLev, passScore, passInputs, 'equipment_finance');
      expect(result.verdict).toBe('fail');
    });

    test('AR concentration flag', () => {
      const arMetrics = { ...passMetrics, concentrationRisk: 0.30 };
      const result = evaluateScreening(baseCriteria, arMetrics, passScore, passInputs, 'accounts_receivable');
      expect(result.reasons.some(r => r.text.includes('concentration'))).toBe(true);
    });

    test('inventory turnover flag', () => {
      const invMetrics = { ...passMetrics, turnoverRatio: 2.0 };
      const result = evaluateScreening(baseCriteria, invMetrics, passScore, passInputs, 'inventory_finance');
      expect(result.reasons.some(r => r.text.includes('Turnover'))).toBe(true);
    });

    // ---- P0-3 fix: per-module DSCR floor ----
    test('AR module uses minDscrAR (1.10), not minDscr', () => {
      // DSCR of 1.15 is below the shared 1.25 floor but above the ABL 1.10 floor.
      // For AR, this should NOT flag.
      const arMetrics = { ...passMetrics, dscr: 1.15 };
      const result = evaluateScreening(baseCriteria, arMetrics, passScore, passInputs, 'accounts_receivable');
      expect(result.reasons.some(r => r.text.includes('DSCR'))).toBe(false);
    });

    test('Equipment module at DSCR 1.15 still flags (uses 1.25 floor)', () => {
      const efMetrics = { ...passMetrics, dscr: 1.15 };
      const result = evaluateScreening(baseCriteria, efMetrics, passScore, passInputs, 'equipment_finance');
      expect(result.reasons.some(r => r.level === 'flag' && r.text.includes('DSCR'))).toBe(true);
    });

    test('AR DSCR below 1.10 flags', () => {
      const arMetrics = { ...passMetrics, dscr: 1.05 };
      const result = evaluateScreening(baseCriteria, arMetrics, passScore, passInputs, 'accounts_receivable');
      expect(result.reasons.some(r => r.level === 'flag' && r.text.includes('DSCR'))).toBe(true);
    });
  });

  describe('DEFAULT_CRITERIA', () => {
    test('has minDscrAR=1.10 for ABL per-module override', () => {
      expect(DEFAULT_CRITERIA.minDscrAR).toBe(1.10);
    });

    test('has maxRevenueConcentration=25 for equipment finance', () => {
      expect(DEFAULT_CRITERIA.maxRevenueConcentration).toBe(25);
    });

    test('shared minDscr remains 1.25 for non-AR modules', () => {
      expect(DEFAULT_CRITERIA.minDscr).toBe(1.25);
    });
  });

  describe('validateCriteria', () => {
    test('returns defaults for null input', () => {
      expect(validateCriteria(null)).toBe(null);
    });

    test('merges partial criteria with defaults', () => {
      const partial = { passScore: 80 };
      const result = validateCriteria(partial);
      expect(result.passScore).toBe(80);
      expect(result.flagScore).toBe(DEFAULT_CRITERIA.flagScore);
    });

    test('ensures passScore > flagScore', () => {
      const invalid = { passScore: 30, flagScore: 50 };
      const result = validateCriteria(invalid);
      expect(result.passScore).toBeGreaterThan(result.flagScore);
    });
  });

  describe('liquidation LTV', () => {
    const eq = (liquidationLtv, extra = {}) => ({ ...passMetrics, liquidationLtv, liquidationHaircut: 0.2, liquidationHaircutBasis: 'data', ...extra });
    const run = (m, criteria = baseCriteria, inputs = passInputs) =>
      evaluateScreening(criteria, m, passScore, inputs, 'equipment_finance');

    test('flags above 115% by default, silent at 115%', () => {
      expect(run(eq(1.15)).reasons.some((r) => /Liquidation LTV/.test(r.text))).toBe(false);
      const over = run(eq(1.16));
      expect(over.verdict).toBe('flag');
      expect(over.reasons).toContainEqual({ level: 'flag', text: 'Liquidation LTV 116% exceeds maximum (115%)' });
    });

    test('the fail ceiling is off by default and fails when a firm sets it', () => {
      expect(run(eq(1.43)).verdict).toBe('flag');
      const strict = run(eq(1.43), { ...baseCriteria, failLiquidationLtv: 130 });
      expect(strict.verdict).toBe('fail');
      expect(strict.reasons).toContainEqual({ level: 'fail', text: 'Liquidation LTV 143% exceeds limit (130%)' });
      expect(strict.reasons.filter((r) => /Liquidation LTV/.test(r.text))).toHaveLength(1);
    });

    test('saved limits survive validateCriteria, and stored values win over defaults', () => {
      const v = validateCriteria({ maxLiquidationLtv: 120, failLiquidationLtv: 140, maxLtv: 100 });
      expect(v.maxLiquidationLtv).toBe(120);
      expect(v.failLiquidationLtv).toBe(140);
      // A user who saved 100 before the default moved to 90 keeps 100 (AUDIT P1-17).
      expect(v.maxLtv).toBe(100);
      expect(validateCriteria({}).maxLiquidationLtv).toBe(115);
    });

    test('a general haircut is called out in the notes', () => {
      const r = run(eq(1.0, { liquidationHaircut: 0.3, liquidationHaircutBasis: 'general' }), baseCriteria, { ...passInputs, equipmentCondition: 'Used' });
      expect(r.notes).toContain('Liquidation LTV uses the general 30% used-equipment haircut. No type-specific resale data.');
    });

    test('an estimated haircut is called out too', () => {
      const r = run(eq(1.0, { liquidationHaircut: 0.2, liquidationHaircutBasis: 'estimated' }), baseCriteria, { ...passInputs, equipmentCondition: 'New' });
      expect(r.notes).toContain('Liquidation LTV uses an estimated 20% new-equipment haircut, from market-value curves, not sale data.');
    });

    test('a data-backed haircut adds no note, and other modules never see one', () => {
      expect(run(eq(1.0)).notes.some((n) => /haircut/.test(n))).toBe(false);
      const ar = evaluateScreening(baseCriteria, eq(2.0, { liquidationHaircutBasis: 'general' }), passScore, passInputs, 'accounts_receivable');
      expect(ar.notes.some((n) => /haircut/.test(n))).toBe(false);
      expect(ar.reasons.some((r) => /Liquidation/.test(r.text))).toBe(false);
    });
  });
});
