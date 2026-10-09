const { derive } = require('./derive');

const terms = {
  industrySector: 'Manufacturing', creditRating: 'Adequate', equipmentType: 'Heavy Machinery',
  equipmentCondition: 'New', equipmentCost: 20e6, downPayment: 2e6, financingType: 'EFA',
  usefulLife: 12, loanTerm: 60, essentialUse: true,
};
const assumptions = Object.fromEntries(Object.entries(terms).map(([k, v]) => [k, { value: v, why: 't' }]));

function fixture(figures) {
  return { borrower: { name: 'Test Co' }, figures, assumptions };
}

const full = {
  revenue: { value: 100e6 },
  operatingIncome: { value: 8e6 },
  depreciationAmortization: { value: 2e6 },
  totalDebt: { value: 30e6 },
  interestPaid: { value: 2e6 },
  currentMaturities: { value: 1e6 },
  yearsInBusiness: { manual: { value: 25, cite: 'p.1' } },
};

test('EBITDA is operating income plus D&A, debt service is interest plus current maturities', () => {
  const { inputs, blockers } = derive(fixture(full));
  expect(blockers).toEqual([]);
  expect(inputs.ebitda).toBe(10e6);
  expect(inputs.actualAnnualDebtService).toBe(3e6);
  expect(inputs.yearsInBusiness).toBe(25);
});

test('a cited EBITDA overrides the build-up', () => {
  const { inputs } = derive(fixture({ ...full, ebitda: { manual: { value: 7e6, cite: 'MD&A' } } }));
  expect(inputs.ebitda).toBe(7e6);
});

test('a missing figure blocks the case and is never defaulted', () => {
  const { inputs, blockers } = derive(fixture({ ...full, depreciationAmortization: { manual: { value: null } } }));
  expect(inputs.ebitda).toBeNull();
  expect(blockers.some((b) => b.startsWith('ebitda'))).toBe(true);
});

test('missing debt service is omitted, so the module fallback fires and the report can flag it', () => {
  const { inputs, blockers } = derive(fixture({ ...full, interestPaid: { value: null } }));
  expect(blockers).toEqual([]);
  expect('actualAnnualDebtService' in inputs).toBe(false);
});

test('an unset deal term blocks the case', () => {
  const fx = fixture(full);
  fx.assumptions = { ...assumptions, loanTerm: { value: null, why: '' } };
  expect(derive(fx).blockers).toContain('assumption loanTerm is not set');
});

test('a custom build applies signed terms, e.g. EBITDA after floorplan interest', () => {
  const fx = fixture({ ...full, floorplanInterest: { value: 1.5e6 } });
  fx.builds = { ebitda: { terms: [['+', 'operatingIncome'], ['+', 'depreciationAmortization'], ['-', 'floorplanInterest']] } };
  const { inputs, derivations } = derive(fx);
  expect(inputs.ebitda).toBe(8.5e6);
  expect(derivations.find((d) => d.field === 'ebitda').formula).toBe('operatingIncome + depreciationAmortization - floorplanInterest');
});

test('an estimated build always produces a caveat', () => {
  const fx = fixture({ ...full, depreciation: { value: 1.8e6 } });
  fx.builds = { maintenanceCapex: { terms: [['+', 'depreciation']], estimate: 'depreciation used as proxy' } };
  const { inputs, caveats } = derive(fx);
  expect(inputs.maintenanceCapex).toBe(1.8e6);
  expect(caveats).toEqual(['ESTIMATE, maintenanceCapex: depreciation used as proxy']);
});

test('cash-flow inputs pass through when cited and stay absent when missing', () => {
  const { inputs } = derive(fixture({ ...full, cashTaxes: { value: 1e6 }, leasePayments: { manual: { value: 0, cite: 'none' } } }));
  expect(inputs.cashTaxes).toBe(1e6);
  expect(inputs.leasePayments).toBe(0); // an entered 0 is an answer, not missing
  expect('workingCapitalIncrease' in inputs).toBe(false);
});
