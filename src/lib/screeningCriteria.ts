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
import { computeCashFlowAnalysis, describeMissing } from '../utils/cashFlowMetrics';

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

  // Cash-flow coverage floors. Applied only when the inputs are provided.
  // 1.10x FCCR is a common springing covenant level in ABL. Cash-flow DSCR
  // has no market standard; 1.15x sits under the 1.20-1.25x that term
  // lenders put on plain DSCR, because this measure is stricter.
  minCashFlowDscr: 1.15,
  minFccr: 1.10,

  // Cash-flow stress scenarios. Deal_Screening_Model_Assumptions.md section 7.
  stressRevenueDeclineMild: 10,
  stressRevenueDeclineModerate: 20,
  stressRevenueDeclineSevere: 30,
  stressMarginCompressionBps: 200,
  stressRateShockBps: 200,
  stressWcDelayDays: 20,
  stressCombinedRevenueDecline: 20,
  stressCombinedMarginBps: 200,
};

/**
 * The DSCR floor a deal is judged against.
 *
 * AR facilities self-liquidate through collections, so they carry a lower
 * floor than a term facility. This used to be inline in evaluateScreening,
 * which meant the DSCR metric card printed a hardcoded "Min 1.25x" on an AR
 * deal that was actually being judged at 1.10x.
 */
export function dscrFloorFor(
  criteria: Partial<ScreeningCriteria> | null | undefined,
  moduleKey: AssetClass,
): number {
  const c: ScreeningCriteria = { ...DEFAULT_CRITERIA, ...criteria };
  return moduleKey === 'accounts_receivable' ? c.minDscrAR : c.minDscr;
}

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

  // ---- Non-positive EBITDA (AUDIT P0-7) ----
  // Coverage is negative and leverage is not meaningful. One reason says so,
  // in place of the DSCR, leverage and cash-flow floor reasons, which would
  // each restate the same failure. A missing EBITDA is not this case: that is
  // an incomplete input, not a loss-making borrower.
  const ebitdaValue = (inputs as { ebitda?: unknown }).ebitda;
  const ebitdaNotPositive = ebitdaValue != null && ebitdaValue !== '' && Number(ebitdaValue) <= 0;
  if (ebitdaNotPositive) {
    const e = Number(ebitdaValue);
    reasons.push({
      level: 'fail',
      text: `EBITDA is ${e < 0 ? '-' : ''}$${Math.abs(e / 1e6).toFixed(1)}M. Earnings cannot cover debt service, and leverage is not meaningful`,
    });
  }

  // ---- DSCR ----
  const dscrFloor = dscrFloorFor(c, moduleKey);
  if (!ebitdaNotPositive && dscrFloor > 0 && metrics.dscr > 0 && metrics.dscr < dscrFloor) {
    if (metrics.dscr < 1.0) {
      reasons.push({ level: 'fail', text: `DSCR ${metrics.dscr.toFixed(2)}x is below 1.0x, insufficient to service debt` });
    } else {
      reasons.push({ level: 'flag', text: `DSCR ${metrics.dscr.toFixed(2)}x is below minimum (${dscrFloor}x)` });
    }
  }

  // ---- Leverage ----
  if (c.maxLeverage > 0 && metrics.leverage != null && metrics.leverage > c.maxLeverage) {
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
    // The `c.maxLtv < 100` guard that used to be here disabled the check
    // entirely at the default of 100, so LTV was never evaluated in the
    // verdict under stock settings: a deal at 150% LTV screened PASS with no
    // LTV reason given. That contradicted everything around it. The spec says
    // "LTV above 100% means the lender has negative equity from day one"
    // (Deal_Screening_Model_Assumptions.md), generateCommentary flags
    // ltv > 1.0 in prose, and describeFactors marks the factor failed above
    // 85%. Only the verdict stayed silent.
    //
    // The convention in this file is 0 = disabled, per the note on the
    // shared limits above. maxLtv keeps its default of 100; it is now
    // actually applied.
    if (c.maxLtv > 0 && metrics.ltv && metrics.ltv * 100 > c.maxLtv) {
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
    if (c.minTurnover > 0 && metrics.turnoverRatio != null && metrics.turnoverRatio > 0 && metrics.turnoverRatio < c.minTurnover) {
      reasons.push({ level: 'flag', text: `Turnover ${metrics.turnoverRatio.toFixed(1)}x is below minimum (${c.minTurnover}x)` });
    }
    if (c.maxObsolescence > 0 && metrics.obsolescenceRate && metrics.obsolescenceRate * 100 > c.maxObsolescence) {
      reasons.push({ level: 'flag', text: `Obsolescence ${(metrics.obsolescenceRate * 100).toFixed(1)}% exceeds maximum (${c.maxObsolescence}%)` });
    }
  }

  // ---- Cash-flow coverage ----
  // Judged only when the analyst gave the inputs. A metric that is not
  // provided cannot pass or fail; it becomes a note the reader sees.
  const notes: string[] = [];
  const cf = computeCashFlowAnalysis(inputs as unknown as Record<string, unknown>, metrics, c);
  const floorCheck = (value: number | null, floor: number, name: string, covers: string) => {
    if (value == null || !(floor > 0) || value >= floor) return;
    if (value < 1.0) {
      reasons.push({ level: 'fail', text: `${name} ${value.toFixed(2)}x is below 1.0x, insufficient to cover ${covers}` });
    } else {
      reasons.push({ level: 'flag', text: `${name} ${value.toFixed(2)}x is below minimum (${floor}x)` });
    }
  };
  if (!ebitdaNotPositive) {
    floorCheck(cf.base.cashFlowDscr, c.minCashFlowDscr, 'Cash-flow DSCR', 'debt service');
    floorCheck(cf.base.fccr, c.minFccr, 'FCCR', 'fixed charges');
  }

  const severe = cf.scenarios.find((s) => s.kind === 'combined');
  if (severe && !ebitdaNotPositive) {
    const broken = [
      severe.cashFlowDscr != null && severe.cashFlowDscr < 1.0 ? `cash-flow DSCR ${severe.cashFlowDscr.toFixed(2)}x` : null,
      severe.fccr != null && severe.fccr < 1.0 ? `FCCR ${severe.fccr.toFixed(2)}x` : null,
    ].filter(Boolean);
    // Only flag what the base case did not already flag or fail on.
    const baseBroken = (cf.base.cashFlowDscr != null && cf.base.cashFlowDscr < 1.0) || (cf.base.fccr != null && cf.base.fccr < 1.0);
    if (broken.length > 0 && !baseBroken) {
      reasons.push({ level: 'flag', text: `Breaks under stress: ${broken.join(' and ')} in the combined severe case (${severe.detail.toLowerCase()})` });
    }
  }

  if (cf.missing.cashFlowDscr.length > 0) {
    notes.push(`Cash-flow DSCR not provided: missing ${describeMissing(cf.missing.cashFlowDscr)}.`);
  }
  if (cf.missing.fccr.length > 0) {
    notes.push(`FCCR not provided: missing ${describeMissing(cf.missing.fccr)}.`);
  }

  // ---- Determine final verdict ----
  const hasFail = reasons.some((r) => r.level === 'fail');
  const hasFlag = reasons.some((r) => r.level === 'flag');

  let verdict: 'pass' | 'flag' | 'fail' = 'pass';
  if (hasFail) verdict = 'fail';
  else if (hasFlag) verdict = 'flag';

  return { verdict, reasons, notes };
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
