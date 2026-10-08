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
