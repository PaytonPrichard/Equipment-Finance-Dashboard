// Universal borrower-profile metrics that apply across every module.
// Display-only: not part of the composite risk score.
//
// FCCR moved to src/utils/cashFlowMetrics.ts, which owns the formula and the
// rule that a metric with missing inputs reads "not provided". It used to
// live here with a 3%-of-revenue capex default, which put an invented number
// on the card behind a small note.

import { fccrFor, providedValue } from './cashFlowMetrics';

export function computeBorrowerExtras(inputs, metrics) {
  const revenue = Number(inputs?.annualRevenue) || 0;
  const ebitda = Number(inputs?.ebitda) || 0;
  const cash = Number(inputs?.cashOnHand) || 0;
  const available = Number(inputs?.availableLiquidity) || 0;
  const totalLiquidity = cash + available;

  // Existing plus new. existingDebtService already holds the actual figure
  // when one was entered. Using the actual figure alone, as this once did,
  // left the new facility's payments out of both FCCR and liquidity months.
  const debtService =
    (metrics?.existingDebtService || 0) + (metrics?.newAnnualDebtService || 0);

  const maintCapex = providedValue(inputs, 'maintenanceCapex');
  const fccr = fccrFor(inputs, ebitda, debtService);

  const monthsOfDebtServiceCoverage =
    debtService > 0 ? totalLiquidity / (debtService / 12) : null;

  const priorRevenue = Number(inputs?.priorYearRevenue) || 0;
  const priorEbitda = Number(inputs?.priorYearEbitda) || 0;
  const revenueGrowth = priorRevenue > 0 ? (revenue - priorRevenue) / priorRevenue : null;
  const currentMargin = revenue > 0 ? ebitda / revenue : null;
  const priorMargin = priorRevenue > 0 ? priorEbitda / priorRevenue : null;
  const marginTrendBps =
    currentMargin != null && priorMargin != null
      ? (currentMargin - priorMargin) * 10000
      : null;

  return {
    fccr,
    maintenanceCapex: maintCapex,
    totalLiquidity,
    cashOnHand: cash,
    availableLiquidity: available,
    monthsOfDebtServiceCoverage,
    annualDebtService: debtService,
    revenueGrowth,
    currentMargin,
    priorMargin,
    marginTrendBps,
  };
}

// Status band for a coverage ratio against the firm's floor. Presentation
// only: the floor itself, not these bands, decides flag or fail.
export function coverageStatus(value, floor) {
  if (value == null) return undefined;
  if (value < 1.0) return 'weak';
  if (floor > 0 && value < floor) return 'adequate';
  if (value < Math.max(floor, 1.0) * 1.25) return 'good';
  return 'excellent';
}

export function fccrStatus(fccr) {
  if (fccr == null) return null;
  if (fccr >= 1.5) return 'excellent';
  if (fccr >= 1.25) return 'good';
  if (fccr >= 1.0) return 'adequate';
  return 'weak';
}

export function liquidityCoverageStatus(months) {
  if (months == null) return null;
  if (months >= 12) return 'excellent';
  if (months >= 6) return 'good';
  if (months >= 3) return 'adequate';
  return 'weak';
}

export function revenueGrowthStatus(growth) {
  if (growth == null) return null;
  if (growth >= 0.10) return 'excellent';
  if (growth >= 0.0) return 'good';
  if (growth >= -0.05) return 'adequate';
  return 'weak';
}
