// ============================================================
// Fixture -> Tranche inputs.
//
// Every derived input records the formula that produced it, so the
// report can show the arithmetic next to the citation. Missing figures
// stay null and block the case. They are never filled with a default.
//
// Companies present the same economics in different places (floorplan
// interest above or below operating income, fleet depreciation in its
// own line). The treatment rules are fixed for every case (README).
// A fixture's `builds` only says which of its figures implement them.
//
// A build marked `estimate` produces a caveat automatically, so an
// estimated input can never reach the report without being called out.
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

const DEFAULT_BUILDS = {
  ebitda: { terms: [['+', 'operatingIncome'], ['+', 'depreciationAmortization']] },
  debtService: { terms: [['+', 'interestPaid'], ['+', 'currentMaturities']] },
};

const money = (n) => `$${(Math.abs(n) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;

function figureValue(fig) {
  if (!fig) return null;
  if (fig.manual) return fig.manual.value ?? null;
  return fig.value ?? null;
}

function assumptionValue(a) {
  return a == null ? null : a.value ?? null;
}

/** Sum signed figure terms. Null if any term is missing. */
function evaluateBuild(build, figures) {
  const formula = build.terms
    .map(([sign, key], i) => (i === 0 && sign === '+' ? key : `${sign} ${key}`))
    .join(' ');
  let value = 0;
  for (const [sign, key] of build.terms) {
    const v = figureValue(figures[key]);
    if (v == null) return { value: null, formula };
    value += sign === '-' ? -v : v;
  }
  return { value, formula };
}

function derive(fx) {
  const fig = (k) => figureValue(fx.figures[k]);
  const builds = { ...DEFAULT_BUILDS, ...(fx.builds || {}) };
  const derivations = [];
  const blockers = [];
  const caveats = [];

  const record = (field, value, formula, { required = true } = {}) => {
    derivations.push({ field, value, formula });
    if (required && value == null) blockers.push(`${field} is missing (${formula})`);
    return value;
  };
  const fromBuild = (field, opts) => {
    const b = builds[field];
    if (!b) return null;
    const { value, formula } = evaluateBuild(b, fx.figures);
    if (b.estimate && value != null) caveats.push(`ESTIMATE, ${field}: ${b.estimate}`);
    return record(field, value, formula, opts);
  };

  const annualRevenue = record('annualRevenue', fig('revenue'), 'revenue');
  const ebitda =
    fx.figures.ebitda && !fx.builds?.ebitda
      ? record('ebitda', fig('ebitda'), 'EBITDA as cited (company-defined, see figure note)')
      : fromBuild('ebitda');
  const totalExistingDebt = record('totalExistingDebt', fig('totalDebt'), 'totalDebt');
  // Optional in Tranche; without it the module estimates 8% of debt, which
  // the report flags.
  const actualAnnualDebtService = fromBuild('debtService', { required: false });
  const yearsInBusiness = record('yearsInBusiness', fig('yearsInBusiness'), 'yearsInBusiness');

  const a = fx.assumptions || {};
  for (const key of REQUIRED_ASSUMPTIONS) {
    if (assumptionValue(a[key]) == null) blockers.push(`assumption ${key} is not set`);
  }

  // Maintenance capex: a build from the filing beats a typed-in number,
  // and either beats the module's silent 3%-of-revenue fallback.
  const maintenanceCapex = builds.maintenanceCapex
    ? fromBuild('maintenanceCapex', { required: false })
    : assumptionValue(a.maintenanceCapex);

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
  if (maintenanceCapex != null) inputs.maintenanceCapex = maintenanceCapex;

  // Cash-flow inputs for main's cash-flow DSCR and FCCR. Optional: when one
  // is missing, the screening says so in a note and the metric reads
  // "not provided". It is never filled in.
  // A working-capital release or a net tax refund counts as 0: neither is
  // repeatable cash for debt service. Same rule as the app's borrower build
  // (src/lib/borrowerBuild.ts), and always shown as a caveat.
  const RELEASE_NOTE = {
    workingCapitalIncrease: (v) => `RULE, working capital: released ${money(-v)}. Counted as 0, a release is not repeatable.`,
    cashTaxes: (v) => `RULE, cash taxes: net refund of ${money(-v)}. Counted as 0, a refund is not repeatable.`,
  };
  for (const key of ['cashTaxes', 'workingCapitalIncrease', 'leasePayments']) {
    const v = fig(key);
    if (v != null && v < 0 && RELEASE_NOTE[key]) {
      caveats.push(RELEASE_NOTE[key](v));
      derivations.push({ field: key, value: 0, formula: `max(0, ${key}) (filed ${money(v)})` });
      inputs[key] = 0;
      continue;
    }
    derivations.push({ field: key, value: v, formula: key });
    if (v != null) inputs[key] = v;
  }

  return { inputs, derivations, blockers, caveats: [...caveats, ...(fx.caveats || [])] };
}

module.exports = { derive, evaluateBuild, figureValue, assumptionValue, REQUIRED_ASSUMPTIONS };
