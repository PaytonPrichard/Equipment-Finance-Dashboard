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
  getDefaultCovenants,
} from './scoring';
import { INITIAL_INPUTS } from './constants';

describe('Inventory Finance Scoring', () => {
  const validInputs = {
    ...INITIAL_INPUTS,
    companyName: 'Test Corp',
    yearsInBusiness: 10,
    annualRevenue: 50000000,
    ebitda: 8000000,
    totalExistingDebt: 20000000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    totalInventory: 8000000,
    rawMaterials: 30,
    workInProgress: 15,
    finishedGoods: 50,
    obsoleteInventory: 5,
    inventoryTurnover: 6,
    averageDaysOnHand: 60,
    requestedAdvanceRate: 60,
    nolvPct: 55,
  };

  describe('isInputValid', () => {
    test('returns true for valid inputs', () => {
      expect(isInputValid(validInputs)).toBe(true);
    });

    test('returns false when total inventory is 0', () => {
      expect(isInputValid({ ...validInputs, totalInventory: 0 })).toBe(false);
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
    test('composition mix is in 0-1 fraction form', () => {
      const metrics = calculateMetrics(validInputs);
      expect(metrics.compositionMix.rawPct).toBeCloseTo(0.30, 3);
      expect(metrics.compositionMix.wipPct).toBeCloseTo(0.15, 3);
      expect(metrics.compositionMix.finishedPct).toBeCloseTo(0.50, 3);
      expect(metrics.compositionMix.obsoletePct).toBeCloseTo(0.05, 3);
    });

    test('obsolescence rate matches input percentage in 0-1 form', () => {
      const metrics = calculateMetrics(validInputs);
      expect(metrics.obsolescenceRate).toBeCloseTo(0.05, 3);
    });

    test('eligible inventory is a meaningful $ amount', () => {
      const metrics = calculateMetrics(validInputs);
      // $8M - 5% obsolete - WIP haircut. Roughly $6.9M.
      expect(metrics.eligibleInventory).toBeGreaterThan(6_000_000);
      expect(metrics.eligibleInventory).toBeLessThan(8_000_000);
    });

    test('blended advance rate is between WIP cap (0.30) and finished cap (0.65)', () => {
      const metrics = calculateMetrics(validInputs);
      expect(metrics.blendedAdvanceRate).toBeGreaterThan(0.30);
      expect(metrics.blendedAdvanceRate).toBeLessThan(0.65);
    });

    test('borrowing base sits within $2M-$6M for sample inputs', () => {
      const metrics = calculateMetrics(validInputs);
      expect(metrics.borrowingBase).toBeGreaterThan(2_000_000);
      expect(metrics.borrowingBase).toBeLessThan(6_000_000);
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

    test('perishable flag applies 15% haircut to applied advance rate', () => {
      const baseline = calculateMetrics(validInputs);
      const perishable = calculateMetrics({ ...validInputs, perishable: true });
      expect(perishable.appliedAdvanceRate).toBeLessThan(baseline.appliedAdvanceRate);
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
      const strongInputs = { ...validInputs, ebitda: 15_000_000, creditRating: 'Strong', inventoryTurnover: 10, obsoleteInventory: 1, nolvPct: 75 };
      const weakInputs = { ...validInputs, ebitda: 2_000_000, creditRating: 'Weak', inventoryTurnover: 2, obsoleteInventory: 20, nolvPct: 25 };

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
      expect(score.factors).toHaveProperty('inventoryQuality');
      expect(score.factors).toHaveProperty('composition');
      expect(score.factors).toHaveProperty('liquidationValue');
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

    test('obsolescence rate stays in 0-1 fraction range across scenarios', () => {
      for (const s of stress) {
        expect(s.obsolescenceRate).toBeGreaterThanOrEqual(0);
        expect(s.obsolescenceRate).toBeLessThanOrEqual(1);
      }
    });

    test('severe stress shifts obsolescence 15 percentage points', () => {
      // Base 5% → severe 20%
      expect(stress[0].obsolescenceRate).toBeCloseTo(0.05, 2);
      expect(stress[3].obsolescenceRate).toBeCloseTo(0.20, 2);
    });

    test('every scenario has finite DSCR, valid score, non-negative BB', () => {
      for (const s of stress) {
        expect(Number.isFinite(s.dscr)).toBe(true);
        expect(s.borrowingBase).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(100);
      }
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
    test('references NOLV as a sensible percentage (not multiplied by 100)', () => {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      const commentary = generateCommentary(validInputs, metrics, score);
      const nolvComment = commentary.find((c) => /NOLV|liquidation value/i.test(c));
      expect(nolvComment).toBeDefined();
      expect(nolvComment).toMatch(/55%/);
      expect(nolvComment).not.toMatch(/5500/);
    });
  });

  describe('generateExportSummary', () => {
    test('composition rows show derived $ amount alongside %', () => {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      const rec = getRecommendation(score.composite);
      const commentary = generateCommentary(validInputs, metrics, score);
      const structure = getSuggestedStructure(validInputs, metrics, score.composite);
      const text = generateExportSummary(validInputs, metrics, score, rec, commentary, structure);

      // 30% of $8M = $2.4M for raw materials
      expect(text).toMatch(/Raw Materials.*2,400,000.*30\.0%/);
      expect(text).toMatch(/NOLV %:\s+55%/);
    });
  });

  describe('getSuggestedStructure', () => {
    test('sublimits computed from totalInv * pct * categoryCap', () => {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      const structure = getSuggestedStructure(validInputs, metrics, score.composite);

      // Raw: $8M * 30% * 50% = $1.2M
      expect(structure.sublimits.rawMaterials.amount).toBeCloseTo(1_200_000, -3);
      // WIP: $8M * 15% * 30% = $360K
      expect(structure.sublimits.workInProgress.amount).toBeCloseTo(360_000, -3);
      // Finished: $8M * 50% * 65% = $2.6M
      expect(structure.sublimits.finishedGoods.amount).toBeCloseTo(2_600_000, -3);
    });
  });
});

describe('Inventory Finance getDefaultCovenants', () => {
  const inputs = {
    ...INITIAL_INPUTS,
    annualRevenue: 50000000,
    ebitda: 8000000,
    totalExistingDebt: 20000000,
    totalInventory: 8000000,
  };
  const metrics = calculateMetrics(inputs, 0.0425);

  test('uses the standard DSCR floor (1.25), not the AR floor', () => {
    expect(getDefaultCovenants(inputs, metrics).find((x) => x.metric_key === 'dscr')).toMatchObject({
      flag_value: 1.25, fail_value: 1.0,
    });
  });

  test('seeds turnover (min) and obsolescence (max) covenants', () => {
    const cov = getDefaultCovenants(inputs, metrics);
    expect(cov.find((x) => x.metric_key === 'turnover')).toMatchObject({ direction: 'min', flag_value: 4.0, unit: 'ratio' });
    expect(cov.find((x) => x.metric_key === 'obsolescence')).toMatchObject({ direction: 'max', flag_value: 10, unit: 'percent' });
  });

  test('includes a monthly borrowing base and an annual appraisal', () => {
    const cov = getDefaultCovenants(inputs, metrics);
    expect(cov.find((x) => /borrowing base/i.test(x.name))).toMatchObject({ test_frequency: 'monthly' });
    expect(cov.find((x) => /appraisal/i.test(x.name))).toMatchObject({ test_frequency: 'annual' });
  });
});
