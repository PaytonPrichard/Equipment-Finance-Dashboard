// ============================================================
// Inventory Finance Module — Constants & Configuration
// ============================================================

export const DEFAULT_SOFR = 0.0425;
export const CURRENT_SOFR = DEFAULT_SOFR;
export const EXISTING_DEBT_SERVICE_RATE = 0.08;

export const BASE_SPREAD_BPS = 275;

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

// Inventory-specific advance rate caps by category
export const MAX_ADVANCE_RATE_RAW = 0.50;
export const MAX_ADVANCE_RATE_FINISHED = 0.65;
export const MAX_ADVANCE_RATE_WIP = 0.30;

// Obsolescence threshold — inventory with obsolescence rate above this is flagged
export const OBSOLESCENCE_THRESHOLD = 0.10;

// Minimum healthy turnover ratio
export const MIN_TURNOVER = 4.0;

export const INITIAL_INPUTS = {
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
  // Inventory-specific fields
  totalInventory: 0,
  rawMaterials: 0,
  workInProgress: 0,
  finishedGoods: 0,
  obsoleteInventory: 0,
  inventoryTurnover: 0,
  averageDaysOnHand: 0,
  requestedAdvanceRate: 0,
  nolvPct: 0,
  perishable: false,
};
