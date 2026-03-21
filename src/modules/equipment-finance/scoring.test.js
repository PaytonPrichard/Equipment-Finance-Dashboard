import {
  calculateMetrics,
  calculateRiskScore,
  getRecommendation,
  isInputValid,
  getScreeningRate,
} from './scoring';
import { INITIAL_INPUTS } from './constants';

describe('Equipment Finance Scoring', () => {
  const validInputs = {
    ...INITIAL_INPUTS,
    companyName: 'Test Corp',
    annualRevenue: 50000000,
    ebitda: 8000000,
    totalExistingDebt: 15000000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    equipmentType: 'Heavy Machinery',
    equipmentCondition: 'New',
    equipmentCost: 5000000,
    downPayment: 500000,
    financingType: 'EFA',
    usefulLife: 15,
    loanTerm: 84,
    essentialUse: true,
  };

  describe('isInputValid', () => {
    test('returns true for valid inputs', () => {
      expect(isInputValid(validInputs)).toBe(true);
    });

    test('returns false when revenue is 0', () => {
      expect(isInputValid({ ...validInputs, annualRevenue: 0 })).toBe(false);
    });

    test('returns false when EBITDA is 0', () => {
      expect(isInputValid({ ...validInputs, ebitda: 0 })).toBe(false);
    });

    test('returns false when equipment cost is 0', () => {
      expect(isInputValid({ ...validInputs, equipmentCost: 0 })).toBe(false);
    });
  });

  describe('getScreeningRate', () => {
    test('returns correct rate for Strong/Manufacturing', () => {
      const rate = getScreeningRate('Strong', 'Manufacturing', 0.0425);
      expect(rate.allInRate).toBeCloseTo(0.0550, 2); // SOFR + 200 - 75 - 25 = 100 bps spread
    });

    test('Weak credit adds spread', () => {
      const strong = getScreeningRate('Strong', 'Manufacturing', 0.0425);
      const weak = getScreeningRate('Weak', 'Manufacturing', 0.0425);
      expect(weak.allInRate).toBeGreaterThan(strong.allInRate);
    });

    test('High-risk industry adds spread', () => {
      const low = getScreeningRate('Adequate', 'Healthcare', 0.0425);
      const high = getScreeningRate('Adequate', 'Construction', 0.0425);
      expect(high.allInRate).toBeGreaterThan(low.allInRate);
    });
  });

  describe('calculateMetrics', () => {
    test('calculates DSCR > 0 for valid inputs', () => {
      const metrics = calculateMetrics(validInputs, 0.0425);
      expect(metrics.dscr).toBeGreaterThan(0);
    });

    test('calculates leverage > 0', () => {
      const metrics = calculateMetrics(validInputs, 0.0425);
      expect(metrics.leverage).toBeGreaterThan(0);
    });

    test('calculates LTV between 0 and 2', () => {
      const metrics = calculateMetrics(validInputs, 0.0425);
      expect(metrics.ltv).toBeGreaterThan(0);
      expect(metrics.ltv).toBeLessThan(2);
    });

    test('net financed equals cost minus down payment', () => {
      const metrics = calculateMetrics(validInputs, 0.0425);
      expect(metrics.netFinanced).toBe(validInputs.equipmentCost - validInputs.downPayment);
    });

    test('uses actual debt service when provided', () => {
      const withDS = { ...validInputs, actualAnnualDebtService: 2000000 };
      const metrics = calculateMetrics(withDS, 0.0425);
      expect(metrics.existingDebtService).toBe(2000000);
      expect(metrics.debtServiceEstimated).toBe(false);
    });

    test('estimates debt service when not provided', () => {
      const metrics = calculateMetrics(validInputs, 0.0425);
      expect(metrics.debtServiceEstimated).toBe(true);
      expect(metrics.existingDebtService).toBeGreaterThan(0);
    });
  });

  describe('calculateRiskScore', () => {
    test('returns composite score between 0 and 100', () => {
      const metrics = calculateMetrics(validInputs, 0.0425);
      const score = calculateRiskScore(validInputs, metrics);
      expect(score.composite).toBeGreaterThanOrEqual(0);
      expect(score.composite).toBeLessThanOrEqual(100);
    });

    test('strong deal scores higher than weak deal', () => {
      const strongInputs = { ...validInputs, ebitda: 15000000, creditRating: 'Strong' };
      const weakInputs = { ...validInputs, ebitda: 2000000, creditRating: 'Weak', totalExistingDebt: 40000000 };

      const strongMetrics = calculateMetrics(strongInputs, 0.0425);
      const weakMetrics = calculateMetrics(weakInputs, 0.0425);
      const strongScore = calculateRiskScore(strongInputs, strongMetrics);
      const weakScore = calculateRiskScore(weakInputs, weakMetrics);

      expect(strongScore.composite).toBeGreaterThan(weakScore.composite);
    });

    test('has expected factor keys', () => {
      const metrics = calculateMetrics(validInputs, 0.0425);
      const score = calculateRiskScore(validInputs, metrics);
      expect(score.factors).toHaveProperty('dscr');
      expect(score.factors).toHaveProperty('leverage');
      expect(score.factors).toHaveProperty('industry');
      expect(score.factors).toHaveProperty('yearsInBusiness');
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
});
