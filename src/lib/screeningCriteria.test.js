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
});
