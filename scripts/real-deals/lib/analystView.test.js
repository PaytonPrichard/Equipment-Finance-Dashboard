const { liquidityRunway, whatWouldChange, maturityWall } = require('./analystView');

const criteria = { minDscr: 1.25, maxLeverage: 5.0, maxLtv: 100, maxTermCoverage: 80, passScore: 75 };
const factors = [
  { label: 'DSCR', weight: 0.25, score: 40 },
  { label: 'Leverage', weight: 0.2, score: 70 },
  { label: 'Industry', weight: 0.15, score: 100 },
];

test('liquidity runway: months of debt service and cash after a year', () => {
  const r = liquidityRunway({ cash: 6e6, availability: 4e6, ebitda: 5e6, maintenanceCapex: 1e6, debtService: 12e6 });
  expect(r.liquidity).toBe(10e6);
  expect(r.monthsOfDebtService).toBeCloseTo(10); // 10M / (12M / 12)
  expect(r.cashAfterYear).toBe(2e6); // 10 + (5 - 1) - 12
});

test('DSCR breach inverts to the EBITDA and debt service that would clear it', () => {
  // EBITDA 10, debt service 8 + 2 = 10, DSCR 1.0x. Need 12.5 EBITDA, or DS at 8.
  const inputs = { ebitda: 10e6, totalExistingDebt: 20e6, equipmentCost: 5e6, usefulLife: 10 };
  const metrics = { dscr: 1.0, leverage: 2.4, existingDebtService: 8e6, newAnnualDebtService: 2e6, netFinanced: 4e6, ltv: 0.8, equipmentValue: 5e6, termCoverage: 50 };
  const { changes, headroom } = whatWouldChange(inputs, metrics, { composite: 60 }, factors, criteria);
  expect(changes[0]).toBe('DSCR 1.00x vs 1.25x floor: EBITDA would need to reach $12.5M (+25%), or total debt service fall to $8M from $10M.');
  expect(changes.some((c) => c.startsWith('Fails before this loan'))).toBe(false); // 8 * 1.25 = 10, not above 10
  expect(headroom[0]).toBe('EBITDA can fall 52% before leverage reaches the 5x ceiling.'); // 1 - 24/50
  expect(changes[changes.length - 1]).toBe('Score 60 vs 75 to pass: 15 points short. Most points lost on DSCR (-15.0), Leverage (-6.0), Industry (-0.0).');
});

test('LTV and term breaches give the down payment and term that clear them', () => {
  const inputs = { ebitda: 10e6, totalExistingDebt: 0, equipmentCost: 10e6, usefulLife: 10 };
  const metrics = { dscr: 3, leverage: 1, existingDebtService: 0, newAnnualDebtService: 2e6, netFinanced: 10e6, ltv: 1.176, equipmentValue: 8.5e6, termCoverage: 90 };
  const { changes } = whatWouldChange(inputs, metrics, { composite: 80 }, factors, criteria);
  expect(changes).toContain('LTV 118% vs 100% limit: a down payment of $1.5M clears it.'); // 10 - 8.5
  expect(changes).toContain('Term is 90% of useful life vs 80% limit: a term of 96 months or less clears it.');
});

test('negative EBITDA says no loan terms fix it, and computes nothing', () => {
  const { changes, headroom } = whatWouldChange({ ebitda: -1e6 }, { netFinanced: 0 }, { composite: 80 }, factors, criteria);
  expect(changes[0]).toMatch(/^EBITDA is -\$1M\. No change to this loan's terms fixes/);
  expect(headroom).toEqual([]);
});

test('maturity wall keeps missing years as null', () => {
  const v = { maturityY1: 5, maturityY3: 7 };
  expect(maturityWall((k) => v[k] ?? null).map((m) => m.amount)).toEqual([5, null, 7, null, null]);
});

test('cash-flow DSCR, FCCR and severe-case breaches invert to the cash flow that clears them', () => {
  const crit = { ...criteria, minCashFlowDscr: 1.15, minFccr: 1.1 };
  const inputs = { ebitda: 20e6, totalExistingDebt: 10e6, leasePayments: 2e6, equipmentCost: 1e6, usefulLife: 10 };
  const metrics = { dscr: 2, leverage: 1, existingDebtService: 8e6, newAnnualDebtService: 2e6, netFinanced: 1e6, ltv: 0.8, equipmentValue: 1.25e6, termCoverage: 50 };
  // Base: debt service 10, FCF 8 -> 0.80x. FCCR 0.90x on (10 + 2 rent) = 12.
  const cf = { base: { debtService: 10e6, freeCashFlow: 8e6, cashFlowDscr: 0.8, fccr: 0.9 }, scenarios: [] };
  const { changes } = whatWouldChange(inputs, metrics, { composite: 80 }, factors, crit, cf);
  expect(changes).toContain('Cash-flow DSCR 0.80x vs 1.15x floor: free cash flow for debt service would need to reach $11.5M from $8M, or debt service fall to $7M from $10M.');
  expect(changes).toContain('FCCR 0.90x vs 1.1x floor: EBITDA plus rent, less maintenance capex and cash taxes, would need to reach $13.2M from $10.8M.');

  // Base fine, severe case below 1.0x: 9 / 10.
  const cf2 = { base: { debtService: 10e6, freeCashFlow: 15e6, cashFlowDscr: 1.5, fccr: 1.6 },
    scenarios: [{ kind: 'combined', detail: 'Revenue -20% and margin -200 bps', debtService: 10e6, freeCashFlow: 9e6, cashFlowDscr: 0.9 }] };
  const r2 = whatWouldChange(inputs, metrics, { composite: 80 }, factors, crit, cf2);
  expect(r2.changes).toContain('Combined severe case (revenue -20% and margin -200 bps): cash-flow DSCR 0.90x. Free cash flow in that case would need to reach $10M from $9M to cover debt service.');
  expect(r2.headroom).toContain('Free cash flow can fall 23% before cash-flow DSCR reaches the 1.15x floor.'); // 1 - 11.5/15
});
