// ============================================================
// Calculation Engine — Re-export Shim
//
// This file re-exports from the active module + shared utilities
// so that ALL existing component imports continue to work unchanged.
//
// The actual logic lives in:
//   src/modules/equipment-finance/  (scoring, constants)
//   src/utils/format.js             (shared formatters)
// ============================================================

// Shared utilities (used by all modules)
export {
  formatCurrency,
  formatCurrencyFull,
  formatPercent,
  formatRatio,
  lerp,
  calculateMonthlyPayment,
  generateAmortizationSchedule,
} from './format';

// Equipment Finance module (default) — constants
export {
  DEFAULT_SOFR,
  CURRENT_SOFR,
  EXISTING_DEBT_SERVICE_RATE,
  EQUIPMENT_DEFAULTS,
  FINANCING_TYPES,
  TRAC_ELIGIBLE_TYPES,
  INITIAL_INPUTS,
  INDUSTRY_OPTIONS,
  EQUIPMENT_OPTIONS,
  CREDIT_OPTIONS,
} from '../modules/equipment-finance/constants';

// Equipment Finance module (default) — scoring & calculations
export {
  getScreeningRate,
  getResidualValue,
  calculateMetrics,
  calculateRiskScore,
  getRecommendation,
  generateCommentary,
  getSuggestedStructure,
  runStressTest,
  generateExportSummary,
  parseCsvDeals,
  isInputValid,
} from '../modules/equipment-finance/scoring';
