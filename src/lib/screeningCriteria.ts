// ============================================================
// Screening Criteria — Pass / Flag / Fail Evaluation
//
// Configurable thresholds that represent a firm's credit policy.
// Stored per-user in user_preferences.screening_criteria.
// ============================================================

import type {
  ScreeningCriteria,
  ScreeningResult,
  ScreeningReason,
  RiskScore,
  BaseDealInputs,
  AssetClass,
  BaseMetrics,
} from '../types';

// Widened metrics type to allow access to module-specific fields across all three modules.
// Each field is guarded by the moduleKey check at the call site, so access is safe at runtime.
type ModuleMetrics = BaseMetrics & {
  ltv?: number;
  termCoverage?: number;
  concentrationRisk?: number;
  dilutionRate?: number;
  turnoverRatio?: number;
  obsolescenceRate?: number;
};

export const DEFAULT_CRITERIA: ScreeningCriteria = {
  // Score thresholds
  passScore: 75,
  flagScore: 35,

  // Shared metric limits (0 = disabled)
  minDscr: 1.25,
  // ABL facilities self-liquidate through AR collections, so industry
  // norm is a lower DSCR floor than equipment finance. Applied only when
  // moduleKey === 'accounts_receivable'.
  minDscrAR: 1.10,
  maxLeverage: 5.0,
  minRevenue: 0,
  minYearsInBusiness: 0,

  // Equipment-specific
  maxLtv: 100,
  maxTermCoverage: 80,
  maxRevenueConcentration: 25,

  // AR-specific
  maxConcentration: 25,
  maxDilution: 5,

  // Inventory-specific
  minTurnover: 4.0,
  maxObsolescence: 10,
};

export function evaluateScreening(
  criteria: Partial<ScreeningCriteria> | null | undefined,
  metrics: ModuleMetrics,
  riskScore: RiskScore,
  inputs: BaseDealInputs,
  moduleKey: AssetClass,
): ScreeningResult {
  const c: ScreeningCriteria = { ...DEFAULT_CRITERIA, ...criteria };
  const reasons: ScreeningReason[] = [];

  // ---- Score-based verdict ----
  if (riskScore.composite < c.flagScore) {
    reasons.push({ level: 'fail', text: `Score ${riskScore.composite} is below minimum (${c.flagScore})` });
  } else if (riskScore.composite < c.passScore) {
    reasons.push({ level: 'flag', text: `Score ${riskScore.composite} is below pass threshold (${c.passScore})` });
  }

  // ---- DSCR ----
  // AR module uses a lower floor (ABL norm); other modules use minDscr.
  const dscrFloor = moduleKey === 'accounts_receivable' ? c.minDscrAR : c.minDscr;
  if (dscrFloor > 0 && metrics.dscr > 0 && metrics.dscr < dscrFloor) {
    if (metrics.dscr < 1.0) {
      reasons.push({ level: 'fail', text: `DSCR ${metrics.dscr.toFixed(2)}x is below 1.0x — insufficient to service debt` });
    } else {
      reasons.push({ level: 'flag', text: `DSCR ${metrics.dscr.toFixed(2)}x is below minimum (${dscrFloor}x)` });
    }
  }

  // ---- Leverage ----
  if (c.maxLeverage > 0 && metrics.leverage > c.maxLeverage) {
    if (metrics.leverage > c.maxLeverage * 1.5) {
      reasons.push({ level: 'fail', text: `Leverage ${metrics.leverage.toFixed(1)}x far exceeds maximum (${c.maxLeverage}x)` });
    } else {
      reasons.push({ level: 'flag', text: `Leverage ${metrics.leverage.toFixed(1)}x exceeds maximum (${c.maxLeverage}x)` });
    }
  }

  // ---- Revenue minimum ----
  if (c.minRevenue > 0 && inputs.annualRevenue > 0 && inputs.annualRevenue < c.minRevenue) {
    reasons.push({ level: 'flag', text: `Revenue $${(inputs.annualRevenue / 1e6).toFixed(1)}M is below minimum ($${(c.minRevenue / 1e6).toFixed(1)}M)` });
  }

  // ---- Years in business ----
  if (c.minYearsInBusiness > 0 && inputs.yearsInBusiness > 0 && inputs.yearsInBusiness < c.minYearsInBusiness) {
    reasons.push({ level: 'flag', text: `${inputs.yearsInBusiness} years in business is below minimum (${c.minYearsInBusiness})` });
  }

  // ---- Equipment-specific ----
  if (moduleKey === 'equipment_finance') {
    if (c.maxLtv > 0 && c.maxLtv < 100 && metrics.ltv && metrics.ltv * 100 > c.maxLtv) {
      reasons.push({ level: 'flag', text: `LTV ${(metrics.ltv * 100).toFixed(0)}% exceeds maximum (${c.maxLtv}%)` });
    }
    if (c.maxTermCoverage > 0 && metrics.termCoverage && metrics.termCoverage > c.maxTermCoverage) {
      reasons.push({ level: 'flag', text: `Term coverage ${metrics.termCoverage.toFixed(0)}% exceeds maximum (${c.maxTermCoverage}%)` });
    }
  }

  // ---- AR-specific ----
  if (moduleKey === 'accounts_receivable') {
    if (c.maxConcentration > 0 && metrics.concentrationRisk && metrics.concentrationRisk * 100 > c.maxConcentration) {
      reasons.push({ level: 'flag', text: `Top customer concentration ${(metrics.concentrationRisk * 100).toFixed(0)}% exceeds maximum (${c.maxConcentration}%)` });
    }
    if (c.maxDilution > 0 && metrics.dilutionRate && metrics.dilutionRate * 100 > c.maxDilution) {
      reasons.push({ level: 'flag', text: `Dilution rate ${(metrics.dilutionRate * 100).toFixed(1)}% exceeds maximum (${c.maxDilution}%)` });
    }
  }

  // ---- Inventory-specific ----
  if (moduleKey === 'inventory_finance') {
    if (c.minTurnover > 0 && metrics.turnoverRatio > 0 && metrics.turnoverRatio < c.minTurnover) {
      reasons.push({ level: 'flag', text: `Turnover ${metrics.turnoverRatio.toFixed(1)}x is below minimum (${c.minTurnover}x)` });
    }
    if (c.maxObsolescence > 0 && metrics.obsolescenceRate && metrics.obsolescenceRate * 100 > c.maxObsolescence) {
      reasons.push({ level: 'flag', text: `Obsolescence ${(metrics.obsolescenceRate * 100).toFixed(1)}% exceeds maximum (${c.maxObsolescence}%)` });
    }
  }

  // ---- Determine final verdict ----
  const hasFail = reasons.some((r) => r.level === 'fail');
  const hasFlag = reasons.some((r) => r.level === 'flag');

  let verdict: 'pass' | 'flag' | 'fail' = 'pass';
  if (hasFail) verdict = 'fail';
  else if (hasFlag) verdict = 'flag';

  return { verdict, reasons };
}

export function validateCriteria(obj: unknown): ScreeningCriteria | null {
  if (!obj || typeof obj !== 'object') return null;
  const merged: ScreeningCriteria = { ...DEFAULT_CRITERIA };
  for (const key of Object.keys(DEFAULT_CRITERIA) as (keyof ScreeningCriteria)[]) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'number' && !isNaN(val) && val >= 0) {
      (merged as unknown as Record<string, number>)[key] = val;
    }
  }
  // Ensure passScore > flagScore
  if (merged.passScore <= merged.flagScore) {
    merged.passScore = merged.flagScore + 10;
  }
  return merged;
}
