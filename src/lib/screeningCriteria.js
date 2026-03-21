// ============================================================
// Screening Criteria — Pass / Flag / Fail Evaluation
//
// Configurable thresholds that represent a firm's credit policy.
// Stored per-user in user_preferences.screening_criteria.
// ============================================================

export const DEFAULT_CRITERIA = {
  // Score thresholds
  passScore: 75,
  flagScore: 35,

  // Shared metric limits (0 = disabled)
  minDscr: 1.25,
  maxLeverage: 5.0,
  minRevenue: 0,
  minYearsInBusiness: 0,

  // Equipment-specific
  maxLtv: 100,
  maxTermCoverage: 80,

  // AR-specific
  maxConcentration: 25,
  maxDilution: 5,

  // Inventory-specific
  minTurnover: 4.0,
  maxObsolescence: 10,
};

/**
 * Evaluate a screened deal against the criteria.
 * Returns { verdict: 'pass'|'flag'|'fail', reasons: [...] }
 *
 * Reasons are objects: { level: 'fail'|'flag', text: string }
 * A 'fail' reason always forces verdict to 'fail'.
 * A 'flag' reason downgrades verdict from 'pass' to 'flag'.
 */
export function evaluateScreening(criteria, metrics, riskScore, inputs, moduleKey) {
  const c = { ...DEFAULT_CRITERIA, ...criteria };
  const reasons = [];

  // ---- Score-based verdict ----
  if (riskScore.composite < c.flagScore) {
    reasons.push({ level: 'fail', text: `Score ${riskScore.composite} is below minimum (${c.flagScore})` });
  } else if (riskScore.composite < c.passScore) {
    reasons.push({ level: 'flag', text: `Score ${riskScore.composite} is below pass threshold (${c.passScore})` });
  }

  // ---- DSCR ----
  if (c.minDscr > 0 && metrics.dscr > 0 && metrics.dscr < c.minDscr) {
    if (metrics.dscr < 1.0) {
      reasons.push({ level: 'fail', text: `DSCR ${metrics.dscr.toFixed(2)}x is below 1.0x — insufficient to service debt` });
    } else {
      reasons.push({ level: 'flag', text: `DSCR ${metrics.dscr.toFixed(2)}x is below minimum (${c.minDscr}x)` });
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
  const hasFail = reasons.some(r => r.level === 'fail');
  const hasFlag = reasons.some(r => r.level === 'flag');

  let verdict = 'pass';
  if (hasFail) verdict = 'fail';
  else if (hasFlag) verdict = 'flag';

  return { verdict, reasons };
}

/**
 * Validate that a criteria object has all required fields with valid values.
 */
export function validateCriteria(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const merged = { ...DEFAULT_CRITERIA };
  for (const key of Object.keys(DEFAULT_CRITERIA)) {
    if (typeof obj[key] === 'number' && !isNaN(obj[key]) && obj[key] >= 0) {
      merged[key] = obj[key];
    }
  }
  // Ensure passScore > flagScore
  if (merged.passScore <= merged.flagScore) {
    merged.passScore = merged.flagScore + 10;
  }
  return merged;
}
