// ============================================================
// Accounts Receivable Module — Constants & Configuration
// ============================================================

export const DEFAULT_SOFR = 0.0425;
export const CURRENT_SOFR = DEFAULT_SOFR;
export const EXISTING_DEBT_SERVICE_RATE = 0.08;

export const BASE_SPREAD_BPS = 250;

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

export const INDUSTRY_OPTIONS = [
  'Manufacturing', 'Construction', 'Transportation/Logistics', 'Marine',
  'Rail', 'Energy', 'Healthcare', 'Infrastructure', 'Mining',
  'Agriculture', 'Aviation', 'Other',
];

export const CREDIT_OPTIONS = ['Strong', 'Adequate', 'Weak', 'Not Rated'];

// AR-specific thresholds
export const MAX_ADVANCE_RATE = 0.85;
export const CONCENTRATION_THRESHOLD = 0.25;
export const DILUTION_THRESHOLD = 0.05;

export const INITIAL_INPUTS = {
  // Shared borrower fields
  companyName: '',
  yearsInBusiness: 0,
  annualRevenue: 0,
  ebitda: 0,
  totalExistingDebt: 0,
  actualAnnualDebtService: 0,
  industrySector: 'Manufacturing',
  creditRating: 'Adequate',
  // AR-specific fields
  totalAROutstanding: 0,
  arUnder30: 0,
  arOver30: 0,
  arOver60: 0,
  arOver90: 0,
  topCustomerConcentration: 0,
  dilutionRate: 0,
  ineligiblesPct: 0,
  requestedAdvanceRate: 80,
  existingABLFacility: false,
};
