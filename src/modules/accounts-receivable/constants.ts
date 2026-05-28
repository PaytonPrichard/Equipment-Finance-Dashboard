// ============================================================
// Accounts Receivable Module — Constants & Configuration
// ============================================================

import type {
  CreditRating,
  IndustrySector,
  IndustryTier,
  AccountsReceivableInputs,
} from '../../types';

export const DEFAULT_SOFR: number = 0.0425;
export const CURRENT_SOFR: number = DEFAULT_SOFR;
export const EXISTING_DEBT_SERVICE_RATE: number = 0.08;

export const BASE_SPREAD_BPS: number = 250;

export const CREDIT_SPREAD_BPS: Record<CreditRating, number> = {
  Strong: -75,
  Adequate: 0,
  Weak: 200,
  'Not Rated': 100,
};

export const INDUSTRY_RISK_TIER: Record<IndustrySector, IndustryTier> = {
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

export const TIER_SPREAD_BPS: Record<IndustryTier, number> = { low: -25, moderate: 0, high: 75 };

export const INDUSTRY_OPTIONS: IndustrySector[] = [
  'Manufacturing', 'Construction', 'Transportation/Logistics', 'Marine',
  'Rail', 'Energy', 'Healthcare', 'Infrastructure', 'Mining',
  'Agriculture', 'Aviation', 'Other',
];

export const CREDIT_OPTIONS: CreditRating[] = ['Strong', 'Adequate', 'Weak', 'Not Rated'];

// AR-specific thresholds
export const MAX_ADVANCE_RATE: number = 0.85;
export const CONCENTRATION_THRESHOLD: number = 0.25;
export const DILUTION_THRESHOLD: number = 0.05;

export const INITIAL_INPUTS: AccountsReceivableInputs = {
  // Shared borrower fields
  companyName: '',
  yearsInBusiness: 0,
  annualRevenue: 0,
  priorYearRevenue: 0,
  ebitda: 0,
  priorYearEbitda: 0,
  totalExistingDebt: 0,
  actualAnnualDebtService: 0,
  maintenanceCapex: 0,
  cashOnHand: 0,
  availableLiquidity: 0,
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
