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
