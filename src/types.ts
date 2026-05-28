// ============================================================
// Shared types for Tranche.
//
// Phase 1 of the TypeScript migration. See AUDIT.md "TypeScript Migration Plan".
// Imported by scoring modules, lib utilities, and (eventually) components.
// ============================================================

// ───────────────────────────────────────────────────────────────
// Asset classes
// ───────────────────────────────────────────────────────────────

export type AssetClass =
  | 'equipment_finance'
  | 'accounts_receivable'
  | 'inventory_finance';

export type UserRole = 'analyst' | 'senior_analyst' | 'credit_committee' | 'admin';

export const ASSET_CLASSES: readonly AssetClass[] = [
  'equipment_finance',
  'accounts_receivable',
  'inventory_finance',
] as const;

// ───────────────────────────────────────────────────────────────
// Categorical enums (kept in sync with VALID_* arrays in server-lib/validate.js)
// ───────────────────────────────────────────────────────────────

export type IndustrySector =
  | 'Manufacturing'
  | 'Construction'
  | 'Transportation/Logistics'
  | 'Marine'
  | 'Rail'
  | 'Energy'
  | 'Healthcare'
  | 'Infrastructure'
  | 'Mining'
  | 'Agriculture'
  | 'Aviation'
  | 'Other';

export type CreditRating = 'Strong' | 'Adequate' | 'Weak' | 'Not Rated';

export type IndustryTier = 'low' | 'moderate' | 'high';

export type EquipmentType =
  | 'Heavy Machinery'
  | 'Vehicles/Fleet'
  | 'Rail Cars'
  | 'Marine Vessels'
  | 'Aircraft/Helicopters'
  | 'Medical Equipment'
  | 'IT/Data Center'
  | 'Construction Equipment'
  | 'Energy/Power Generation'
  | 'Other';

export type FinancingType = 'EFA' | 'FMV' | 'TRAC';

export type EquipmentCondition = 'New' | 'Used';

// ───────────────────────────────────────────────────────────────
// Branded numeric types
//
// Several values in the codebase flip between percent (0-100) and decimal (0-1)
// using the same field name. Branded types make the unit explicit so the
// compiler catches accidental mixing.
// ───────────────────────────────────────────────────────────────

export type Percent = number & { readonly __brand: 'Percent' };       // 0-100
export type Fraction = number & { readonly __brand: 'Fraction' };     // 0-1
export type Bps = number & { readonly __brand: 'Bps' };               // basis points
export type USD = number;                                              // dollars
export type Years = number;
export type Months = number;

// Helpers for crossing the unit boundary explicitly.
export const asPercent = (n: number): Percent => n as Percent;
export const asFraction = (n: number): Fraction => n as Fraction;
export const asBps = (n: number): Bps => n as Bps;
export const percentToFraction = (p: Percent): Fraction => (p / 100) as Fraction;
export const fractionToPercent = (f: Fraction): Percent => (f * 100) as Percent;

// ───────────────────────────────────────────────────────────────
// Per-module input shapes
// ───────────────────────────────────────────────────────────────

/** Fields every deal carries regardless of asset class. */
export interface BaseDealInputs {
  companyName: string;
  yearsInBusiness: number;
  annualRevenue: USD;
  ebitda: USD;
  priorYearRevenue?: USD;
  priorYearEbitda?: USD;
  totalExistingDebt: USD;
  actualAnnualDebtService?: USD;
  maintenanceCapex?: USD;
  cashOnHand?: USD;
  availableLiquidity?: USD;
  industrySector: IndustrySector;
  creditRating: CreditRating;
}

export interface EquipmentFinanceInputs extends BaseDealInputs {
  equipmentType: EquipmentType;
  equipmentCondition: EquipmentCondition;
  equipmentCost: USD;
  downPayment: USD;
  financingType: FinancingType;
  usefulLife: Years;
  loanTerm: Months;
  essentialUse: boolean;
}

export interface AccountsReceivableInputs extends BaseDealInputs {
  totalAROutstanding: USD;
  /** Percentages — fields are stored as 0-100 in the form, see scoring.js:108 for the /100 conversion. */
  arUnder30?: number;
  arOver30?: number;
  arOver60?: number;
  arOver90?: number;
  topCustomerConcentration?: number;
  dilutionRate?: number;
  ineligiblesPct?: number;
  requestedAdvanceRate?: number;
  existingABLFacility?: boolean;
}

export interface InventoryFinanceInputs extends BaseDealInputs {
  totalInventory: USD;
  rawMaterials?: number;
  workInProgress?: number;
  finishedGoods?: number;
  obsoleteInventory?: number;
  inventoryTurnover?: number;
  averageDaysOnHand?: number;
  requestedAdvanceRate?: number;
  nolvPct?: number;
  perishable?: boolean;
}

/** Discriminated by AssetClass at the boundary. Modules deal in their own concrete shape internally. */
export type DealInputs =
  | EquipmentFinanceInputs
  | AccountsReceivableInputs
  | InventoryFinanceInputs;

// ───────────────────────────────────────────────────────────────
// Metrics — what calculateMetrics returns. Module-specific extensions.
// ───────────────────────────────────────────────────────────────

export interface RateInfo {
  sofr: number;
  baseSpread: Bps;
  creditAdj: Bps;
  industryAdj: Bps;
  totalSpread: Bps;
  allInRate: number;
}

export interface BaseMetrics {
  dscr: number;
  leverage: number;
  rateInfo: RateInfo;
  newAnnualDebtService: USD;
  existingDebtService: USD;
  debtServiceEstimated: boolean;
}

export interface EquipmentMetrics extends BaseMetrics {
  rate: number;
  ltv: number;                      // fraction (0-1+)
  termCoverage: number;             // percent 0-100+
  revenueConcentration: number;     // percent 0-100+
  ebitdaMargin: number;             // percent
  debtYield: number;                // percent
  monthlyPayment: USD;
  netFinanced: USD;
  financedPrincipal: USD;
  residualValue: USD;
  equipmentValue: USD;
}

export interface AccountsReceivableMetrics extends BaseMetrics {
  effectiveRate: number;
  eligibleAR: USD;
  borrowingBase: USD;
  dso: number;                      // days
  concentrationRisk: Fraction;
  dilutionRate: Fraction;
  advanceRate: Fraction;
  netAvailability: USD;
  ineligibleAmount: USD;
  totalAROutstanding: USD;
}

export interface CompositionMix {
  rawPct: number;
  wipPct: number;
  finishedPct: number;
  obsoletePct: number;
}

export interface InventoryFinanceMetrics extends BaseMetrics {
  eligibleInventory: USD;
  borrowingBase: USD;
  turnoverRatio: number;
  daysOnHand: number;
  obsolescenceRate: number;
  compositionMix: CompositionMix;
  blendedAdvanceRate: number;
  appliedAdvanceRate: number;
  effectiveRate: number;
  rate: number;
}

export type Metrics = EquipmentMetrics | AccountsReceivableMetrics | InventoryFinanceMetrics;

// ───────────────────────────────────────────────────────────────
// Scoring
// ───────────────────────────────────────────────────────────────

/** A factor's score is 0-100. */
export type FactorScore = number;

export interface RiskScore {
  composite: number;                          // 0-100
  factors: Record<string, FactorScore>;
}

export interface FactorDescriptor {
  key: string;
  label: string;
  score: FactorScore;
  weight: number;                  // 0-1, sums to 1.0 across all factors
  caption: string;                 // e.g. "1.45x" or "32%"
  target: string;                  // e.g. "≥ 1.25x"
  passed: boolean;
}

// ───────────────────────────────────────────────────────────────
// Recommendation
//
// Per AUDIT.md P1-3: today these include Tailwind class strings, which leaks
// presentation into scoring. The migration target is for the scoring layer to
// return only `category` and let components map to classes. The legacy fields
// are marked optional and deprecated to ease the transition.
// ───────────────────────────────────────────────────────────────

export type RecommendationCategory = 'strong' | 'moderate' | 'borderline' | 'weak';

export interface Recommendation {
  category: string;                // legacy display string; "Strong Prospect" etc.
  detail: string;

  /** @deprecated presentation concern — should move to component layer. */
  colorClass?: string;
  /** @deprecated presentation concern. */
  bgClass?: string;
  /** @deprecated presentation concern. */
  textClass?: string;
  /** @deprecated presentation concern. */
  badgeBg?: string;
}

// ───────────────────────────────────────────────────────────────
// Screening verdict (from src/lib/screeningCriteria.js)
// ───────────────────────────────────────────────────────────────

export type Verdict = 'pass' | 'flag' | 'fail';

export interface ScreeningReason {
  level: 'fail' | 'flag';
  text: string;
}

export interface ScreeningResult {
  verdict: Verdict;
  reasons: ScreeningReason[];
}

export interface ScreeningCriteria {
  passScore: number;
  flagScore: number;
  minDscr: number;
  minDscrAR: number;
  maxLeverage: number;
  minRevenue: number;
  minYearsInBusiness: number;
  maxLtv: number;
  maxTermCoverage: number;
  maxRevenueConcentration: number;
  maxConcentration: number;
  maxDilution: number;
  minTurnover: number;
  maxObsolescence: number;
}

export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'move' | 'update_stage' | 'login' | 'logout';
export type AuditEntityType = 'saved_deal' | 'pipeline_deal' | 'user' | 'org' | 'session' | 'invitation';

// ───────────────────────────────────────────────────────────────
// Stress test
// ───────────────────────────────────────────────────────────────

export interface StressScenario {
  label: string;
  decline: number;                 // EBITDA decline as a fraction (0-1)
  ebitda: USD;
  dscr: number;
  leverage: number;
  fccr?: number;
  score: number;
  /** AR-specific. */
  borrowingBase?: USD;
  eligibleAR?: USD;
}

// ───────────────────────────────────────────────────────────────
// The asset-class module contract
//
// Every module under src/modules/<asset-class>/index.js exports this shape.
// Pinning it as a type lets new modules be checked against the contract.
// ───────────────────────────────────────────────────────────────

export interface AssetClassModule<TInputs extends BaseDealInputs = BaseDealInputs, TMetrics extends BaseMetrics = BaseMetrics> {
  calculateMetrics: (inputs: TInputs, sofr?: number) => TMetrics;
  calculateRiskScore: (inputs: TInputs, metrics: TMetrics) => RiskScore;
  describeFactors: (inputs: TInputs, metrics: TMetrics, riskScore: RiskScore) => FactorDescriptor[];
  getRecommendation: (compositeScore: number) => Recommendation;
  generateCommentary: (inputs: TInputs, metrics: TMetrics, riskScore: RiskScore, criteria?: unknown) => string[];
  getSuggestedStructure: (inputs: TInputs, metrics: TMetrics, compositeScore: number, sofr?: number) => unknown;
  runStressTest: (inputs: TInputs, sofr?: number) => StressScenario[];
  generateExportSummary: (
    inputs: TInputs,
    metrics: TMetrics,
    riskScore: RiskScore,
    recommendation: Recommendation,
    commentary: string[],
    structure: unknown,
    sofr?: number,
    criteria?: unknown,
  ) => string;
  parseCsvDeals: (csvText: string) => { id: string; inputs: TInputs }[];
  isInputValid: (inputs: Partial<TInputs>) => boolean;
}
