// Industry tiers after the public equipment ABS benchmarks (2026-10-09):
// Trucking split out of Transportation/Logistics at high risk, Agriculture
// moved from high to moderate. See scripts/real-deals/benchmarks/abs-2026-10.md.

import * as efConst from '../modules/equipment-finance/constants';
import * as arConst from '../modules/accounts-receivable/constants';
import * as invConst from '../modules/inventory-finance/constants';
import { getScreeningRate, calculateMetrics, calculateRiskScore } from '../modules/equipment-finance/scoring';

const { VALID_INDUSTRY_SECTORS } = require('../../server-lib/validate');

describe.each([
  ['equipment_finance', efConst],
  ['accounts_receivable', arConst],
  ['inventory_finance', invConst],
])('%s tiers', (_, c) => {
  test('Trucking is high, Agriculture moderate, Transportation/Logistics unchanged', () => {
    expect(c.INDUSTRY_RISK_TIER.Trucking).toBe('high');
    expect(c.INDUSTRY_RISK_TIER.Agriculture).toBe('moderate');
    expect(c.INDUSTRY_RISK_TIER['Transportation/Logistics']).toBe('moderate');
  });
  test('Trucking is a selectable option', () => {
    expect(c.INDUSTRY_OPTIONS).toContain('Trucking');
  });
});

test('every selectable sector passes server validation, including Trucking', () => {
  for (const s of efConst.INDUSTRY_OPTIONS) expect(VALID_INDUSTRY_SECTORS).toContain(s);
  expect(VALID_INDUSTRY_SECTORS).toContain('Trucking');
});

test('spreads: Trucking +75 bps, Agriculture 0 bps', () => {
  expect(getScreeningRate('Adequate', 'Trucking').industryAdj).toBe(75);
  expect(getScreeningRate('Adequate', 'Agriculture').industryAdj).toBe(0);
});

test('industry factor: Trucking scores 35, Agriculture 65', () => {
  const base = {
    ...efConst.INITIAL_INPUTS, companyName: 'T', yearsInBusiness: 10, annualRevenue: 50e6, ebitda: 8e6,
    totalExistingDebt: 15e6, creditRating: 'Adequate', equipmentType: 'Vehicles/Fleet', equipmentCondition: 'New',
    equipmentCost: 5e6, downPayment: 5e5, financingType: 'EFA', usefulLife: 7, loanTerm: 60, essentialUse: true,
  };
  const score = (sector) => {
    const inputs = { ...base, industrySector: sector };
    return calculateRiskScore(inputs, calculateMetrics(inputs)).factors.industry;
  };
  expect(score('Trucking')).toBe(35);
  expect(score('Agriculture')).toBe(65);
});
