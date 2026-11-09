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

  describe('runStressTest FCCR', () => {
    const stress = runStressTest(validInputs);

    // FCCR needs cash taxes, maintenance capex and rent. Without them it is
    // not provided (null), never estimated.
    const withCashFlow = runStressTest({ ...validInputs, cashTaxes: 500000, maintenanceCapex: 400000, leasePayments: 0 });

    test('FCCR is not provided when cash-flow inputs are blank', () => {
      for (const s of stress) expect(s.fccr).toBeNull();
    });

    test('every scenario reports a finite FCCR', () => {
      for (const s of withCashFlow) {
        expect(typeof s.fccr).toBe('number');
        expect(Number.isFinite(s.fccr)).toBe(true);
      }
    });

    test('severe stress FCCR is lower than base case', () => {
      expect(withCashFlow[3].fccr).toBeLessThan(withCashFlow[0].fccr);
    });

    test('FCCR degrades monotonically with EBITDA decline', () => {
      expect(withCashFlow[0].fccr).toBeGreaterThan(withCashFlow[1].fccr);
      expect(withCashFlow[1].fccr).toBeGreaterThan(withCashFlow[2].fccr);
      expect(withCashFlow[2].fccr).toBeGreaterThan(withCashFlow[3].fccr);
    });

    test('maintenance capex falls with the decline: -20% uses 400K x 0.80 = 320K', () => {
      const s = withCashFlow[2];
      const debtService = s.ebitda / s.dscr;   // existing + new, the DSCR denominator
      // (EBITDA + rent 0 - capex 320K - taxes 500K) / (debt service + rent 0)
      expect(s.fccr).toBeCloseTo((s.ebitda - 320000 - 500000) / debtService, 6);
    });
  });

  // ---- P0-3 fix: PDF thresholds and commentary read from criteria ----
  describe('generateExportSummary threshold text', () => {
    function buildSummary(criteria) {
      const metrics = calculateMetrics(validInputs);
      const score = calculateRiskScore(validInputs, metrics);
      const rec = getRecommendation(score.composite);
      const commentary = generateCommentary(validInputs, metrics, score, criteria);
      const structure = getSuggestedStructure(validInputs, metrics, score.composite);
      return generateExportSummary(validInputs, metrics, score, rec, commentary, structure, undefined, criteria);
    }

    test('default (no criteria) shows 80% term coverage and 25% revenue concentration', () => {
      const text = buildSummary(null);
      expect(text).toMatch(/Term \/ Life:.*target <80%/);
      expect(text).toMatch(/Rev\. Conc\.:.*target <25%/);
    });

    test('user-configured criteria flow through to PDF text', () => {
      const criteria = { maxTermCoverage: 70, maxRevenueConcentration: 20 };
      const text = buildSummary(criteria);
      expect(text).toMatch(/Term \/ Life:.*target <70%/);
      expect(text).toMatch(/Rev\. Conc\.:.*target <20%/);
    });

    test('DSCR line defaults to 1.25x and reflects criteria.minDscr', () => {
      expect(buildSummary(null)).toMatch(/DSCR:.*min 1\.25x/);
      expect(buildSummary({ minDscr: 1.35 })).toMatch(/DSCR:.*min 1\.35x/);
    });
  });

  describe('generateCommentary revenue concentration threshold', () => {
    // Build inputs where equipmentCost is exactly 20% of revenue so the commentary
    // triggers only when the threshold is lowered below 20.
    const concentratedInputs = {
      ...validInputs,
      annualRevenue: 10_000_000,
      equipmentCost: 2_000_000,
    };

    test('default 25% threshold: 20% concentration does not trigger commentary', () => {
      const metrics = calculateMetrics(concentratedInputs);
      const score = calculateRiskScore(concentratedInputs, metrics);
      const comments = generateCommentary(concentratedInputs, metrics, score, null);
      expect(comments.some((c) => /concentrated exposure/i.test(c))).toBe(false);
    });

    test('lowered threshold (15%): 20% concentration triggers commentary', () => {
      const metrics = calculateMetrics(concentratedInputs);
      const score = calculateRiskScore(concentratedInputs, metrics);
      const comments = generateCommentary(concentratedInputs, metrics, score, { maxRevenueConcentration: 15 });
      expect(comments.some((c) => /concentrated exposure/i.test(c))).toBe(true);
    });
  });
});

describe('Equipment Finance getDefaultCovenants', () => {
  const inputs = {
    ...INITIAL_INPUTS,
    annualRevenue: 50000000,
    ebitda: 8000000,
    totalExistingDebt: 15000000,
    equipmentCost: 5000000,
    downPayment: 500000,
    usefulLife: 15,
    loanTerm: 84,
  };
  const metrics = calculateMetrics(inputs, 0.0425);

  test('seeds DSCR and leverage from default criteria, with screening-aligned fail bands', () => {
    const cov = getDefaultCovenants(inputs, metrics);
    expect(cov.find((x) => x.metric_key === 'dscr')).toMatchObject({
      kind: 'financial', direction: 'min', flag_value: 1.25, fail_value: 1.0, source: 'underwritten',
    });
    expect(cov.find((x) => x.metric_key === 'leverage')).toMatchObject({
      direction: 'max', flag_value: 5.0, fail_value: 7.5,
    });
  });

  test('omits the LTV covenant at the screening default and when disabled (100)', () => {
    expect(getDefaultCovenants(inputs, metrics).find((x) => x.metric_key === 'ltv')).toBeUndefined();
    expect(getDefaultCovenants(inputs, metrics, { maxLtv: 100 }).find((x) => x.metric_key === 'ltv')).toBeUndefined();
  });

  test('seeds the LTV covenant only when the firm enforces a cap', () => {
    const cov = getDefaultCovenants(inputs, metrics, { maxLtv: 85 });
    expect(cov.find((x) => x.metric_key === 'ltv')).toMatchObject({ direction: 'max', flag_value: 85, unit: 'percent' });
  });

  test('includes reporting covenants but no borrowing base for a term facility', () => {
    const reporting = getDefaultCovenants(inputs, metrics).filter((x) => x.kind === 'reporting');
    expect(reporting.length).toBeGreaterThan(0);
    expect(reporting.some((x) => /borrowing base/i.test(x.name))).toBe(false);
    expect(reporting.some((x) => /insurance/i.test(x.name))).toBe(true);
  });

  test('custom criteria flow into the seed', () => {
    const cov = getDefaultCovenants(inputs, metrics, { minDscr: 1.4, maxLeverage: 4 });
    expect(cov.find((x) => x.metric_key === 'dscr').flag_value).toBe(1.4);
    expect(cov.find((x) => x.metric_key === 'leverage').fail_value).toBe(6);
  });
});

describe('Equipment Finance liquidation LTV (resale-2026-10.md)', () => {
  // $1,000,000 cost. Liquidation LTV = net financed / (cost x (1 - haircut)).
  const base = {
    ...INITIAL_INPUTS,
    companyName: 'Hand Check Co',
    annualRevenue: 20000000,
    ebitda: 3000000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    equipmentCost: 1000000,
    financingType: 'EFA',
    usefulLife: 10,
    loanTerm: 60,
    essentialUse: true,
  };
  const m = (over) => calculateMetrics({ ...base, ...over });

  test('new Construction, 15% down: 85% on cost, 850/800 = 106.25% liquidation', () => {
    const r = m({ equipmentType: 'Construction Equipment', equipmentCondition: 'New', downPayment: 150000 });
    expect(r.ltv).toBeCloseTo(0.85, 10);
    expect(r.liquidationValue).toBeCloseTo(800000, 6);
    expect(r.liquidationLtv).toBeCloseTo(1.0625, 10);
    expect(r.liquidationHaircutBasis).toBe('estimated');
  });

  test('used Construction, 15% down: cost LTV no longer carries a haircut, 850/700 = 121.4%', () => {
    const r = m({ equipmentType: 'Construction Equipment', equipmentCondition: 'Used', downPayment: 150000 });
    expect(r.ltv).toBeCloseTo(0.85, 10); // was 100% under the old 0.85 divisor
    expect(r.equipmentValue).toBe(1000000);
    expect(r.liquidationLtv).toBeCloseTo(850 / 700, 10);
    expect(r.liquidationHaircutBasis).toBe('data');
  });

  test('used Other, 30% down: general 30% haircut, exactly 100%', () => {
    const r = m({ equipmentType: 'Other', equipmentCondition: 'Used', downPayment: 300000 });
    expect(r.liquidationHaircut).toBe(0.3);
    expect(r.liquidationHaircutBasis).toBe('general');
    expect(r.liquidationLtv).toBeCloseTo(1.0, 10);
  });

  test('new Other, 24% down: general 25% haircut, 760/750 = 101.3%', () => {
    const r = m({ equipmentType: 'Other', equipmentCondition: 'New', downPayment: 240000 });
    expect(r.liquidationHaircut).toBe(0.25);
    expect(r.liquidationLtv).toBeCloseTo(760 / 750, 10);
  });

  test('new Agricultural Equipment, 20% down: data-backed 25%, 800/750 = 106.7%', () => {
    const r = m({ equipmentType: 'Agricultural Equipment', equipmentCondition: 'New', downPayment: 200000 });
    expect(r.liquidationHaircutBasis).toBe('data');
    expect(r.liquidationLtv).toBeCloseTo(800 / 750, 10);
  });

  test('TRAC uses full net financed, not principal net of residual: 900/800 = 112.5%', () => {
    const r = m({ equipmentType: 'Vehicles/Fleet', equipmentCondition: 'New', financingType: 'TRAC', downPayment: 100000 });
    expect(r.financedPrincipal).toBeLessThan(r.netFinanced);
    expect(r.liquidationLtv).toBeCloseTo(1.125, 10);
  });

  test('zero cost gives 0, not NaN', () => {
    const r = m({ equipmentType: 'Other', equipmentCondition: 'New', equipmentCost: 0, downPayment: 0 });
    expect(r.liquidationLtv).toBe(0);
    expect(r.ltv).toBe(0);
  });

  test('no condition bonus: new and used at the same cost LTV score the same LTV factor', () => {
    const inputsNew = { ...base, equipmentType: 'Other', equipmentCondition: 'New', downPayment: 150000 };
    const inputsUsed = { ...inputsNew, equipmentCondition: 'Used' };
    const fNew = calculateRiskScore(inputsNew, calculateMetrics(inputsNew)).factors.equipmentLtv;
    const fUsed = calculateRiskScore(inputsUsed, calculateMetrics(inputsUsed)).factors.equipmentLtv;
    expect(fNew).toBeCloseTo(65, 6); // 85% on the curve point [0.85, 65], no +12
    expect(fUsed).toBeCloseTo(fNew, 10);
  });
});

describe('Equipment Finance residual coverage at maturity (residual-2026-10.md)', () => {
  // $1,000,000 cost, so every % of cost reads as dollars / 10,000.
  // Coverage = projected forced-sale value at maturity / residual.
  const base = {
    ...INITIAL_INPUTS,
    companyName: 'Residual Check Co',
    annualRevenue: 20000000,
    ebitda: 3000000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    equipmentCost: 1000000,
    downPayment: 100000,
    equipmentCondition: 'New',
    usefulLife: 10,
    essentialUse: true,
  };
  const m = (over) => calculateMetrics({ ...base, ...over });

  test('FMV Vehicles, 60 months: 0.8275^5 x 0.70 = 27.16% vs 25% residual, 1.09x', () => {
    const r = m({ equipmentType: 'Vehicles/Fleet', financingType: 'FMV', loanTerm: 60 });
    expect(r.residualValue).toBeCloseTo(250000, 6);
    expect(r.residualMaturityValue).toBeCloseTo(1000000 * Math.pow(0.8275, 5) * 0.7, 4);
    expect(Math.round(r.residualMaturityValue)).toBe(271605);
    expect(r.residualCoverage).toBeCloseTo(1.0864, 4);
    expect(r.residualCoverageBasis).toBe('estimated');
  });

  test('FMV Vehicles, 84 months: 18.60% vs 25%, 0.74x, under water', () => {
    const r = m({ equipmentType: 'Vehicles/Fleet', financingType: 'FMV', loanTerm: 84 });
    expect(r.residualCoverage).toBeCloseTo((Math.pow(0.8275, 7) * 0.7) / 0.25, 10);
    expect(r.residualCoverage).toBeCloseTo(0.744, 3);
  });

  test('FMV Agricultural, 60 months: Iowa State combine age 5 is 39% auction value, no haircut, 2.60x', () => {
    const r = m({ equipmentType: 'Agricultural Equipment', financingType: 'FMV', loanTerm: 60 });
    expect(r.residualMaturityValue).toBeCloseTo(390000, 6);
    expect(r.residualCoverage).toBeCloseTo(2.6, 10);
    expect(r.residualCoverageBasis).toBe('data');
  });

  test('FMV Agricultural, 54 months: halfway between age 4 (44%) and age 5 (39%), 41.5 / 15 = 2.77x', () => {
    const r = m({ equipmentType: 'Agricultural Equipment', financingType: 'FMV', loanTerm: 54 });
    expect(r.residualCoverage).toBeCloseTo(41.5 / 15, 10);
  });

  test('FMV Aircraft, 120 months: straight line to 15% at 25 yrs is 66%, x 0.70 = 46.2% vs 17%, 2.72x', () => {
    const r = m({ equipmentType: 'Aircraft/Helicopters', financingType: 'FMV', loanTerm: 120 });
    expect(r.residualMaturityValue).toBeCloseTo(462000, 6);
    expect(r.residualCoverage).toBeCloseTo(0.462 / 0.17, 10);
  });

  test('types with no public curve are not checked', () => {
    const r = m({ equipmentType: 'Medical Equipment', financingType: 'FMV', loanTerm: 60 });
    expect(r.residualValue).toBeCloseTo(100000, 6);
    expect(r.residualCoverage).toBeNull();
    expect(r.residualMaturityValue).toBeNull();
    expect(r.residualCoverageBasis).toBeNull();
  });

  test('Agricultural past the 20-year table is not checked', () => {
    expect(m({ equipmentType: 'Agricultural Equipment', financingType: 'FMV', loanTerm: 252 }).residualCoverage).toBeNull();
  });

  test('EFA has no residual and no coverage', () => {
    const r = m({ equipmentType: 'Vehicles/Fleet', financingType: 'EFA', loanTerm: 60 });
    expect(r.residualValue).toBe(0);
    expect(r.residualCoverage).toBeNull();
  });

  test('TRAC Vehicles, 84 months: computed against the 20% TRAC residual, 0.93x', () => {
    const r = m({ equipmentType: 'Vehicles/Fleet', financingType: 'TRAC', loanTerm: 84 });
    expect(r.residualCoverage).toBeCloseTo((Math.pow(0.8275, 7) * 0.7) / 0.2, 10);
  });

  test('the export summary prints coverage, or says it was not checked', () => {
    const summary = (inputs) => {
      const met = calculateMetrics(inputs);
      const score = calculateRiskScore(inputs, met);
      const commentary = generateCommentary(inputs, met, score, null);
      const structure = getSuggestedStructure(inputs, met, score.composite);
      return generateExportSummary(inputs, met, score, getRecommendation(score.composite), commentary, structure);
    };
    const inputs = { ...base, equipmentType: 'Vehicles/Fleet', financingType: 'FMV', loanTerm: 84 };
    expect(summary(inputs)).toMatch(/Residual Cover: {3}0\.74x {2}\(forced-sale value at maturity, estimated; min 1\.00x\)/);
    expect(summary({ ...inputs, equipmentType: 'Medical Equipment' }))
      .toMatch(/Residual Cover: {3}not checked \(no public value data for Medical Equipment at this term\)/);
  });
});

