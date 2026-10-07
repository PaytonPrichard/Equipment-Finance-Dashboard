// ============================================================
// Fixture -> Tranche inputs.
//
// Every derived input records the formula that produced it, so the
// report can show the arithmetic next to the citation. Missing figures
// stay null and block the case. They are never filled with a default.
// ============================================================

const REQUIRED_ASSUMPTIONS = [
  'industrySector',
  'creditRating',
  'equipmentType',
  'equipmentCondition',
  'equipmentCost',
  'downPayment',
  'financingType',
  'usefulLife',
  'loanTerm',
  'essentialUse',
];

function figureValue(fig) {
  if (!fig) return null;
  if (fig.manual) return fig.manual.value ?? null;
  return fig.value ?? null;
}

function assumptionValue(a) {
  return a == null ? null : a.value ?? null;
}

function derive(fx) {
  const fig = (k) => figureValue(fx.figures[k]);
  const derivations = [];
  const blockers = [];

  const record = (field, value, formula) => {
    derivations.push({ field, value, formula });
    if (value == null) blockers.push(`${field} is missing (${formula})`);
    return value;
  };

  const annualRevenue = record('annualRevenue', fig('revenue'), 'revenue');

  let ebitda;
  if (fx.figures.ebitda) {
    ebitda = record('ebitda', fig('ebitda'), 'EBITDA as cited (company-defined, see figure note)');
  } else {
    const oi = fig('operatingIncome');
    const da = fig('depreciationAmortization');
    ebitda = record(
      'ebitda',
      oi != null && da != null ? oi + da : null,
      'operatingIncome + depreciationAmortization',
    );
  }

  const totalExistingDebt = record('totalExistingDebt', fig('totalDebt'), 'totalDebt');

  // Debt service: cash interest paid plus principal due in the next twelve
  // months. Optional in Tranche; without it the module estimates 8% of debt,
  // which the report flags.
  const interestPaid = fig('interestPaid');
  const currentMaturities = fig('currentMaturities');
  const actualAnnualDebtService =
    interestPaid != null && currentMaturities != null ? interestPaid + currentMaturities : null;
  derivations.push({
    field: 'actualAnnualDebtService',
    value: actualAnnualDebtService,
    formula: 'interestPaid + currentMaturities',
  });

  const yearsInBusiness = record('yearsInBusiness', fig('yearsInBusiness'), 'yearsInBusiness');

  const a = fx.assumptions || {};
  for (const key of REQUIRED_ASSUMPTIONS) {
    if (assumptionValue(a[key]) == null) blockers.push(`assumption ${key} is not set`);
  }

  const inputs = {
    companyName: fx.borrower.name,
    yearsInBusiness,
    annualRevenue,
    ebitda,
    totalExistingDebt,
    industrySector: assumptionValue(a.industrySector),
    creditRating: assumptionValue(a.creditRating),
    equipmentType: assumptionValue(a.equipmentType),
    equipmentCondition: assumptionValue(a.equipmentCondition),
    equipmentCost: assumptionValue(a.equipmentCost),
    downPayment: assumptionValue(a.downPayment),
    financingType: assumptionValue(a.financingType),
    usefulLife: assumptionValue(a.usefulLife),
    loanTerm: assumptionValue(a.loanTerm),
    essentialUse: assumptionValue(a.essentialUse),
  };
  if (actualAnnualDebtService != null) inputs.actualAnnualDebtService = actualAnnualDebtService;
  const maintenanceCapex = assumptionValue(a.maintenanceCapex);
  if (maintenanceCapex != null) inputs.maintenanceCapex = maintenanceCapex;

  return { inputs, derivations, blockers };
}

module.exports = { derive, figureValue, assumptionValue, REQUIRED_ASSUMPTIONS };
