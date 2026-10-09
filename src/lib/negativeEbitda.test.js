// AUDIT P0-7: zero or negative EBITDA.
//
// Leverage used to read 0.0x and score 100 (best possible) for a loss-making
// borrower, and the DSCR gate skipped negative coverage. Now leverage is not
// meaningful (null), the factor drops out of the composite, and the verdict
// fails on one reason that says why.

import * as ef from '../modules/equipment-finance/scoring';
import * as ar from '../modules/accounts-receivable/scoring';
import * as inv from '../modules/inventory-finance/scoring';
import { INITIAL_INPUTS as EF_INIT } from '../modules/equipment-finance/constants';
import { INITIAL_INPUTS as AR_INIT } from '../modules/accounts-receivable/constants';
import { INITIAL_INPUTS as INV_INIT } from '../modules/inventory-finance/constants';
import { evaluateScreening, DEFAULT_CRITERIA } from './screeningCriteria';
import { weightedComposite, formatRatio } from '../utils/format';

const borrower = {
  companyName: 'Loss Co',
  yearsInBusiness: 10,
  annualRevenue: 50000000,
  ebitda: -1000000,
  totalExistingDebt: 20000000,
  industrySector: 'Manufacturing',
  creditRating: 'Adequate',
};

const MODULES = [
  {
    key: 'equipment_finance', mod: ef,
    weights: { dscr: 0.25, leverage: 0.2, industry: 0.15, essentiality: 0.1, equipmentLtv: 0.1, yearsInBusiness: 0.1, termCoverage: 0.1 },
    inputs: { ...EF_INIT, ...borrower, equipmentType: 'Heavy Machinery', equipmentCondition: 'New', equipmentCost: 5000000, downPayment: 500000, financingType: 'EFA', usefulLife: 15, loanTerm: 84, essentialUse: true },
  },
  {
    key: 'accounts_receivable', mod: ar,
    weights: { dscr: 0.25, leverage: 0.15, arQuality: 0.2, concentration: 0.15, dilution: 0.1, yearsInBusiness: 0.1, industry: 0.05 },
    inputs: { ...AR_INIT, ...borrower, totalAROutstanding: 12000000, arUnder30: 65, arOver30: 20, arOver60: 10, arOver90: 5, topCustomerConcentration: 15, dilutionRate: 3, ineligiblesPct: 15, requestedAdvanceRate: 80 },
  },
  {
    key: 'inventory_finance', mod: inv,
    weights: { dscr: 0.2, leverage: 0.15, inventoryQuality: 0.2, composition: 0.15, liquidationValue: 0.1, yearsInBusiness: 0.1, industry: 0.1 },
    inputs: { ...INV_INIT, ...borrower, totalInventory: 8000000, rawMaterials: 30, workInProgress: 15, finishedGoods: 50, obsoleteInventory: 5, inventoryTurnover: 6, averageDaysOnHand: 60, requestedAdvanceRate: 60, nolvPct: 55 },
  },
];

describe('weightedComposite', () => {
  test('skips null factors and re-normalizes the rest', () => {
    // (80 * 0.5 + 40 * 0.2) / 0.7 = 48 / 0.7 = 68.57
    expect(weightedComposite([[80, 0.5], [null, 0.3], [40, 0.2]])).toBe(69);
  });
  test('with nothing null it is the plain weighted average', () => {
    expect(weightedComposite([[80, 0.5], [60, 0.3], [40, 0.2]])).toBe(66); // 40 + 18 + 8
  });
});

test('formatRatio prints NM for a ratio that is not meaningful', () => {
  expect(formatRatio(null)).toBe('NM');
  expect(formatRatio(1.234)).toBe('1.23x');
});

describe.each(MODULES)('negative EBITDA: $key', ({ key, mod, weights, inputs }) => {
  const metrics = mod.calculateMetrics(inputs);
  const risk = mod.calculateRiskScore(inputs, metrics);

  test('leverage is not meaningful, not zero', () => {
    expect(metrics.leverage).toBeNull();
    expect(risk.factors.leverage).toBeNull();
  });

  test('the composite leaves leverage out and re-weights the other factors', () => {
    const others = Object.entries(weights).filter(([k]) => k !== 'leverage');
    const sum = others.reduce((s, [k, w]) => s + risk.factors[k] * w, 0);
    const weight = others.reduce((s, [, w]) => s + w, 0);
    expect(risk.composite).toBe(Math.round(sum / weight));
  });

  test('the verdict fails on one reason that names EBITDA, with no duplicate DSCR or leverage reason', () => {
    const result = evaluateScreening(DEFAULT_CRITERIA, metrics, risk, inputs, key);
    expect(result.verdict).toBe('fail');
    const ebitdaReasons = result.reasons.filter((r) => r.text.startsWith('EBITDA is -$1.0M'));
    expect(ebitdaReasons).toHaveLength(1);
    expect(ebitdaReasons[0].level).toBe('fail');
    expect(result.reasons.some((r) => /^(DSCR|Leverage|Cash-flow DSCR|FCCR)/.test(r.text))).toBe(false);
  });
});

test('equipment commentary no longer calls a loss-making borrower low-leverage', () => {
  const { inputs } = MODULES[0];
  const metrics = ef.calculateMetrics(inputs);
  const comments = ef.generateCommentary(inputs, metrics, ef.calculateRiskScore(inputs, metrics), null);
  const text = JSON.stringify(comments);
  expect(text).not.toMatch(/Low leverage/);
  expect(text).toMatch(/Leverage is not meaningful because EBITDA is not positive/);
});

test('zero EBITDA is treated the same as negative', () => {
  const { inputs } = MODULES[0];
  const zero = { ...inputs, ebitda: 0 };
  const metrics = ef.calculateMetrics(zero);
  const result = evaluateScreening(DEFAULT_CRITERIA, metrics, ef.calculateRiskScore(zero, metrics), zero, 'equipment_finance');
  expect(metrics.leverage).toBeNull();
  expect(result.reasons.some((r) => r.text.startsWith('EBITDA is $0.0M'))).toBe(true);
});

test('a missing EBITDA is an incomplete input, not a loss-making borrower', () => {
  const missing = { annualRevenue: 50000000, yearsInBusiness: 10 };
  const result = evaluateScreening(DEFAULT_CRITERIA, { dscr: 2, leverage: 2.5, ltv: 0.75, termCoverage: 60 }, { composite: 80, factors: {} }, missing, 'equipment_finance');
  expect(result.reasons.some((r) => r.text.startsWith('EBITDA is'))).toBe(false);
});

test.each(MODULES)('$key factor table shows leverage as NM, not a passing 0.0x', ({ mod, inputs }) => {
  const metrics = mod.calculateMetrics(inputs);
  const row = mod.describeFactors(inputs, metrics, mod.calculateRiskScore(inputs, metrics)).find((f) => f.key === 'leverage');
  expect(row.score).toBeNull();
  expect(row.caption).toBe('NM (EBITDA not positive)');
  expect(row.passed).toBe(false);
});
