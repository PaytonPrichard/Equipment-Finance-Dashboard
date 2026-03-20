// ============================================================
// Equipment Finance Module — Constants & Configuration
// ============================================================

export const DEFAULT_SOFR = 0.0425;
export const CURRENT_SOFR = DEFAULT_SOFR;
export const EXISTING_DEBT_SERVICE_RATE = 0.08;

export const BASE_SPREAD_BPS = 200;

export const CREDIT_SPREAD_BPS = {
  Strong: -75,
  Adequate: 0,
  Weak: 200,
  'Not Rated': 100,
};

export const INDUSTRY_RISK_TIER = {
  Healthcare: 'low',
  Infrastructure: 'low',
  Manufacturing: 'low',
  'Transportation/Logistics': 'moderate',
  Energy: 'moderate',
  Rail: 'moderate',
  Construction: 'high',
  Marine: 'high',
  Mining: 'high',
  Aviation: 'high',
  Agriculture: 'high',
  Other: 'moderate',
};

export const TIER_SPREAD_BPS = { low: -25, moderate: 0, high: 75 };

export const EQUIPMENT_DEFAULTS = {
  'Heavy Machinery':       { usefulLifeRange: [10, 20], suggestedType: 'EFA',  typicalDownPct: 15 },
  'Vehicles/Fleet':        { usefulLifeRange: [5, 8],   suggestedType: 'TRAC', typicalDownPct: 10 },
  'Rail Cars':             { usefulLifeRange: [25, 35],  suggestedType: 'EFA',  typicalDownPct: 10 },
  'Marine Vessels':        { usefulLifeRange: [15, 25],  suggestedType: 'EFA',  typicalDownPct: 15 },
  'Aircraft/Helicopters':  { usefulLifeRange: [12, 20],  suggestedType: 'FMV',  typicalDownPct: 20 },
  'Medical Equipment':     { usefulLifeRange: [7, 12],   suggestedType: 'FMV',  typicalDownPct: 10 },
  'IT/Data Center':        { usefulLifeRange: [3, 7],    suggestedType: 'FMV',  typicalDownPct: 10 },
  'Construction Equipment':{ usefulLifeRange: [8, 15],   suggestedType: 'EFA',  typicalDownPct: 15 },
  'Energy/Power Generation':{ usefulLifeRange: [15, 25], suggestedType: 'EFA',  typicalDownPct: 15 },
  'Other':                 { usefulLifeRange: [5, 15],   suggestedType: 'EFA',  typicalDownPct: 10 },
};

export const FINANCING_TYPES = {
  EFA: {
    label: 'EFA',
    fullName: 'Equipment Finance Agreement',
    description: 'Secured loan — borrower owns equipment, fully amortizing payments',
  },
  FMV: {
    label: 'FMV Lease',
    fullName: 'Fair Market Value Lease',
    description: 'Lessee returns or purchases at fair market value at term end — lower payments',
  },
  TRAC: {
    label: 'TRAC Lease',
    fullName: 'Terminal Rental Adjustment Clause',
    description: 'Fleet/vehicle lease with lessee-guaranteed residual value',
  },
};

export const TRAC_ELIGIBLE_TYPES = ['Vehicles/Fleet', 'Rail Cars'];

export const FMV_RESIDUAL_PCT = {
  'Heavy Machinery': 0.15,
  'Vehicles/Fleet': 0.25,
  'Rail Cars': 0.20,
  'Marine Vessels': 0.15,
  'Aircraft/Helicopters': 0.17,
  'Medical Equipment': 0.10,
  'IT/Data Center': 0.05,
  'Construction Equipment': 0.15,
  'Energy/Power Generation': 0.12,
  Other: 0.10,
};

export const TRAC_RESIDUAL_PCT = {
  'Vehicles/Fleet': 0.20,
  'Rail Cars': 0.15,
};

export const INDUSTRY_OPTIONS = [
  'Manufacturing', 'Construction', 'Transportation/Logistics', 'Marine',
  'Rail', 'Energy', 'Healthcare', 'Infrastructure', 'Mining',
  'Agriculture', 'Aviation', 'Other',
];

export const EQUIPMENT_OPTIONS = [
  'Heavy Machinery', 'Vehicles/Fleet', 'Rail Cars', 'Marine Vessels',
  'Aircraft/Helicopters', 'Medical Equipment', 'IT/Data Center',
  'Construction Equipment', 'Energy/Power Generation', 'Other',
];

export const CREDIT_OPTIONS = ['Strong', 'Adequate', 'Weak', 'Not Rated'];

export const INITIAL_INPUTS = {
  companyName: '',
  yearsInBusiness: 0,
  annualRevenue: 0,
  ebitda: 0,
  totalExistingDebt: 0,
  actualAnnualDebtService: 0,
  industrySector: 'Manufacturing',
  creditRating: 'Adequate',
  equipmentType: 'Heavy Machinery',
  equipmentCondition: 'New',
  equipmentCost: 0,
  downPayment: 0,
  financingType: 'EFA',
  usefulLife: 0,
  loanTerm: 0,
  essentialUse: true,
};
