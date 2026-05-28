import {
  calculateMetrics,
  calculateRiskScore,
  getRecommendation,
  isInputValid,
  getScreeningRate,
  runStressTest,
  generateCommentary,
  generateExportSummary,
  getSuggestedStructure,
} from './scoring';
import { INITIAL_INPUTS } from './constants';

describe('Accounts Receivable Scoring', () => {
  const validInputs = {
    ...INITIAL_INPUTS,
    companyName: 'Test Corp',
    yearsInBusiness: 10,
    annualRevenue: 50000000,
    ebitda: 8000000,
    totalExistingDebt: 20000000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    totalAROutstanding: 12000000,
    arUnder30: 65,
    arOver30: 20,
    arOver60: 10,
    arOver90: 5,
    topCustomerConcentration: 15,
    dilutionRate: 3,
    ineligiblesPct: 15,
    requestedAdvanceRate: 80,
  };

  describe('isInputValid', () => {
    test('returns true for valid inputs', () => {
      expect(isInputValid(validInputs)).toBe(true);
    });

    test('returns false when total AR is 0', () => {
      expect(isInputValid({ ...validInputs, totalAROutstanding: 0 })).toBe(false);
    });

    test('returns false when revenue is 0', () => {
      expect(isInputValid({ ...validInputs, annualRevenue: 0 })).toBe(false);
    });

    test('returns false when EBITDA is 0', () => {
      expect(isInputValid({ ...validInputs, ebitda: 0 })).toBe(false);
    });
  });

  describe('getScreeningRate', () => {
    test('returns positive all-in rate for Adequate/Manufacturing', () => {
      const rate = getScreeningRate('Adequate', 'Manufacturing', 0.0425);
      expect(rate.allInRate).toBeGreaterThan(0.0425);
    });

    test('Weak credit adds spread', () => {
      const strong = getScreeningRate('Strong', 'Manufacturing', 0.0425);
      const weak = getScreeningRate('Weak', 'Manufacturing', 0.0425);
      expect(weak.allInRate).toBeGreaterThan(strong.allInRate);
    });

    test('high-risk industry adds spread', () => {
      const low = getScreeningRate('Adequate', 'Healthcare', 0.0425);
      const high = getScreeningRate('Adequate', 'Construction', 0.0425);
      expect(high.allInRate).toBeGreaterThan(low.allInRate);
    });
  });

  describe('calculateMetrics', () => {
    test('eligible AR equals total AR minus ineligibles', () => {
      const metrics = calculateMetrics(validInputs);
      // $12M * (1 - 0.15) = $10.2M
      expect(metrics.eligibleAR).toBeCloseTo(10_200_000, -3);
    });

    test('borrowing base equals eligible AR times advance rate', () => {
      const metrics = calculateMetrics(validInputs);
      // $10.2M * 0.80 = $8.16M
      expect(metrics.borrowingBase).toBeCloseTo(8_160_000, -3);
    });

    test('DSO is positive and within plausible range', () => {
      const metrics = calculateMetrics(validInputs);
      // $12M / $50M * 365 ≈ 87.6 days
      expect(metrics.dso).toBeCloseTo(87.6, 0);
    });

    test('concentration risk is in 0-1 decimal form', () => {
      const metrics = calculateMetrics(validInputs);
      expect(metrics.concentrationRisk).toBeCloseTo(0.15, 2);
    });

    test('dilution rate is in 0-1 decimal form', () => {
      const metrics = calculateMetrics(validInputs);
      expect(metrics.dilutionRate).toBeCloseTo(0.03, 2);
    });

    test('advance rate is capped at MAX_ADVANCE_RATE', () => {
      const metrics = calculateMetrics({ ...validInputs, requestedAdvanceRate: 95 });
      expect(metrics.advanceRate).toBeLessThanOrEqual(0.85);
    });

    test('DSCR is positive for valid inputs', () => {
      const metrics = calculateMetrics(validInputs);
      expect(metrics.dscr).toBeGreaterThan(0);
    });

    test('uses actual debt service when provided', () => {
      const metrics = calculateMetrics({ ...validInputs, actualAnnualDebtService: 2_000_000 });
      expect(metrics.existingDebtService).toBe(2_000_000);
      expect(metrics.debtServiceEstimated).toBe(false);
    });

    test('estimates debt service when not provided', () => {
      const metrics = calculateMetrics(validInputs);
      expect(metrics.debtServiceEstimated).toBe(true);
      expect(metrics.existingDebtService).toBeGreaterThan(0);
    });
  });

  describe('calculateRiskScore', () => {
    test('returns composite score between 0 and 100', () => {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      expect(score.composite).toBeGreaterThanOrEqual(0);
      expect(score.composite).toBeLessThanOrEqual(100);
    });

    test('strong deal scores higher than weak deal', () => {
      const strongInputs = { ...validInputs, ebitda: 15_000_000, creditRating: 'Strong', topCustomerConcentration: 5, dilutionRate: 1 };
      const weakInputs = { ...validInputs, ebitda: 2_000_000, creditRating: 'Weak', topCustomerConcentration: 50, dilutionRate: 15 };

      const strongMetrics = calculateMetrics(strongInputs);
      const weakMetrics = calculateMetrics(weakInputs);
      const strongScore = calculateRiskScore(strongInputs, strongMetrics);
      const weakScore = calculateRiskScore(weakInputs, weakMetrics);

      expect(strongScore.composite).toBeGreaterThan(weakScore.composite);
    });

    test('has expected factor keys', () => {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      expect(score.factors).toHaveProperty('dscr');
      expect(score.factors).toHaveProperty('leverage');
      expect(score.factors).toHaveProperty('arQuality');
      expect(score.factors).toHaveProperty('concentration');
      expect(score.factors).toHaveProperty('dilution');
    });
  });

  describe('getRecommendation', () => {
    test('75+ is Strong Prospect', () => {
      expect(getRecommendation(85).category).toBe('Strong Prospect');
    });

    test('55-74 is Moderate Prospect', () => {
      expect(getRecommendation(65).category).toBe('Moderate Prospect');
    });

    test('35-54 is Borderline', () => {
      expect(getRecommendation(45).category).toBe('Borderline');
    });

    test('<35 is Weak Prospect', () => {
      expect(getRecommendation(20).category).toBe('Weak Prospect');
    });
  });

  describe('runStressTest', () => {
    const stress = runStressTest(validInputs);

    test('returns four scenarios', () => {
      expect(stress).toHaveLength(4);
      expect(stress[0].label).toBe('Base Case');
      expect(stress[3].label).toBe('Severe Stress');
    });

    test('every scenario has finite DSCR and valid score', () => {
      for (const s of stress) {
        expect(Number.isFinite(s.dscr)).toBe(true);
        expect(s.dscr).toBeGreaterThan(0);
        expect(s.borrowingBase).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(100);
      }
    });

    test('severe stress lowers DSCR vs base', () => {
      expect(stress[3].dscr).toBeLessThan(stress[0].dscr);
    });

    test('severe stress shrinks borrowing base (more ineligibles)', () => {
      expect(stress[3].borrowingBase).toBeLessThan(stress[0].borrowingBase);
    });

    test('every scenario reports a finite FCCR', () => {
      for (const s of stress) {
        expect(typeof s.fccr).toBe('number');
        expect(Number.isFinite(s.fccr)).toBe(true);
      }
    });

    test('severe stress FCCR is lower than base case', () => {
      expect(stress[3].fccr).toBeLessThan(stress[0].fccr);
    });
  });

  describe('generateCommentary', () => {
    test('references aging as a percentage, not a sub-1 fraction', () => {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      const commentary = generateCommentary(validInputs, metrics, score);
      const agingComment = commentary.find((c) => /past|days|aging|delinquen/i.test(c));
      expect(agingComment).toBeDefined();
      // Should mention a recognizable percentage like 35% (= over30 + over60 + over90)
      const numbers = (agingComment.match(/(\d+\.?\d*)\s*%/g) || []).map((s) => parseFloat(s));
      expect(numbers.some((n) => n >= 1 && n <= 100)).toBe(true);
    });
  });

  describe('generateExportSummary', () => {
    test('formats aging buckets as percentages, not currency', () => {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      const rec = getRecommendation(score.composite);
      const commentary = generateCommentary(validInputs, metrics, score);
      const structure = getSuggestedStructure(validInputs, metrics, score.composite);
      const text = generateExportSummary(validInputs, metrics, score, rec, commentary, structure);

      expect(text).toMatch(/AR Under 30:\s+65/);
      expect(text).toMatch(/AR Over 90 Days:\s+5/);
      // Must NOT format aging values with a $ prefix
      expect(text).not.toMatch(/AR Under 30:\s+\$65\b/);
    });

    // ---- P0-3 fix: AR DSCR floor is configurable, defaults to 1.10x ABL norm ----
    test('DSCR line defaults to 1.10x when no criteria supplied', () => {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      const rec = getRecommendation(score.composite);
      const commentary = generateCommentary(validInputs, metrics, score);
      const structure = getSuggestedStructure(validInputs, metrics, score.composite);
      const text = generateExportSummary(validInputs, metrics, score, rec, commentary, structure);

      expect(text).toMatch(/DSCR:.*min 1\.10x for ABL/);
    });

    test('DSCR line reflects criteria.minDscrAR when supplied', () => {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      const rec = getRecommendation(score.composite);
      const commentary = generateCommentary(validInputs, metrics, score);
      const structure = getSuggestedStructure(validInputs, metrics, score.composite);
      const criteria = { minDscrAR: 1.20 };
      const text = generateExportSummary(validInputs, metrics, score, rec, commentary, structure, undefined, criteria);

      expect(text).toMatch(/DSCR:.*min 1\.20x for ABL/);
    });
  });
});
