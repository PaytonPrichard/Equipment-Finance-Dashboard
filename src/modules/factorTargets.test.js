// Guards the single-source-of-truth property for underwriting targets.
//
// The committee memo prints "(target <X)" next to a metric, and the results
// view prints the same target beside the same factor. Before FACTOR_TARGETS
// those numbers were literals repeated across describeFactors and
// generateExportSummary, and they drifted: the PDF told committees the term
// coverage target was 60% while the platform flagged at 80% (AUDIT P0-3).
// These tests fail if anyone reintroduces a literal.

import * as equipment from './equipment-finance/scoring';
import * as ar from './accounts-receivable/scoring';
import * as inventory from './inventory-finance/scoring';
import { FACTOR_TARGETS as EQ_TARGETS } from './equipment-finance/constants';
import { FACTOR_TARGETS as AR_TARGETS } from './accounts-receivable/constants';
import { FACTOR_TARGETS as INV_TARGETS } from './inventory-finance/constants';
import { INITIAL_INPUTS as EQ_INPUTS } from './equipment-finance/constants';
import { INITIAL_INPUTS as AR_INPUTS } from './accounts-receivable/constants';
import { INITIAL_INPUTS as INV_INPUTS } from './inventory-finance/constants';

function factorsFor(mod, inputs) {
  const metrics = mod.calculateMetrics(inputs);
  const riskScore = mod.calculateRiskScore(inputs, metrics);
  return { metrics, factors: mod.describeFactors(inputs, metrics, riskScore) };
}

// generateExportSummary takes the full derived set. Build it the way App.js does.
function summaryFor(mod, inputs) {
  const metrics = mod.calculateMetrics(inputs);
  const riskScore = mod.calculateRiskScore(inputs, metrics);
  const recommendation = mod.getRecommendation(riskScore.composite);
  const commentary = mod.generateCommentary(inputs, metrics, riskScore);
  const structure = mod.getSuggestedStructure(inputs, metrics, riskScore);
  return mod.generateExportSummary(inputs, metrics, riskScore, recommendation, commentary, structure);
}

function targetOf(factors, key) {
  const f = factors.find((x) => x.key === key);
  if (!f) throw new Error(`no factor "${key}"`);
  return f.target;
}

describe('FACTOR_TARGETS is the only source of displayed targets', () => {
  const equipmentInputs = {
    ...EQ_INPUTS,
    companyName: 'Target Test Co',
    annualRevenue: 50000000,
    ebitda: 8000000,
    totalExistingDebt: 15000000,
    yearsInBusiness: 12,
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

  const arInputs = {
    ...AR_INPUTS,
    companyName: 'AR Target Co',
    annualRevenue: 40000000,
    ebitda: 6000000,
    totalExistingDebt: 12000000,
    yearsInBusiness: 9,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    totalAROutstanding: 10000000,
    arUnder30: 70,
    arOver30: 20,
    arOver60: 7,
    arOver90: 3,
    topCustomerConcentration: 15,
    dilutionRate: 3,
  };

  const inventoryInputs = {
    ...INV_INPUTS,
    companyName: 'Inv Target Co',
    annualRevenue: 45000000,
    ebitda: 7000000,
    totalExistingDebt: 14000000,
    yearsInBusiness: 11,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    totalInventory: 9000000,
    rawMaterials: 30,
    workInProgress: 15,
    finishedGoods: 50,
    obsoleteInventory: 5,
    inventoryTurnover: 6,
    nolvPct: 60,
  };

  test('equipment finance factor targets render from FACTOR_TARGETS', () => {
    const { factors } = factorsFor(equipment, equipmentInputs);
    expect(targetOf(factors, 'dscr')).toBe(`≥ ${EQ_TARGETS.minDscr.toFixed(2)}x`);
    expect(targetOf(factors, 'leverage')).toBe(`≤ ${EQ_TARGETS.maxLeverage.toFixed(1)}x`);
    expect(targetOf(factors, 'equipmentLtv')).toBe(`≤ ${(EQ_TARGETS.maxLtv * 100).toFixed(0)}%`);
    expect(targetOf(factors, 'termCoverage')).toBe(`< ${EQ_TARGETS.maxTermCoverage}%`);
    expect(targetOf(factors, 'yearsInBusiness')).toBe(`≥ ${EQ_TARGETS.minYearsInBusiness} yrs`);
  });

  test('AR factor targets render from FACTOR_TARGETS', () => {
    const { factors } = factorsFor(ar, arInputs);
    expect(targetOf(factors, 'leverage')).toBe(`≤ ${AR_TARGETS.maxLeverage.toFixed(1)}x`);
    expect(targetOf(factors, 'arQuality')).toBe(`< ${AR_TARGETS.maxAgingOver30}%`);
    expect(targetOf(factors, 'yearsInBusiness')).toBe(`≥ ${AR_TARGETS.minYearsInBusiness} yrs`);
  });

  test('inventory factor targets render from FACTOR_TARGETS', () => {
    const { factors } = factorsFor(inventory, inventoryInputs);
    expect(targetOf(factors, 'dscr')).toBe(`≥ ${INV_TARGETS.minDscr.toFixed(2)}x`);
    expect(targetOf(factors, 'leverage')).toBe(`≤ ${INV_TARGETS.maxLeverage.toFixed(1)}x`);
    expect(targetOf(factors, 'composition')).toBe(`≥ ${INV_TARGETS.minFinishedGoodsPct}% finished`);
    expect(targetOf(factors, 'liquidationValue')).toBe(`≥ ${(INV_TARGETS.minNolv * 100).toFixed(0)}%`);
    expect(targetOf(factors, 'yearsInBusiness')).toBe(`≥ ${INV_TARGETS.minYearsInBusiness} yrs`);
  });

  // The export summary is what becomes the committee memo. A target printed
  // there that no longer matches FACTOR_TARGETS is the P0-3 failure mode.
  test('export summary leverage target matches the factor target, per module', () => {
    const cases = [
      [equipment, equipmentInputs, EQ_TARGETS],
      [ar, arInputs, AR_TARGETS],
      [inventory, inventoryInputs, INV_TARGETS],
    ];
    for (const [mod, inputs, targets] of cases) {
      expect(summaryFor(mod, inputs)).toContain(`(target <${targets.maxLeverage.toFixed(1)}x)`);
    }
  });

  test('equipment export summary LTV target matches the factor target', () => {
    expect(summaryFor(equipment, equipmentInputs))
      .toContain(`(target <${(EQ_TARGETS.maxLtv * 100).toFixed(0)}%)`);
  });
});
