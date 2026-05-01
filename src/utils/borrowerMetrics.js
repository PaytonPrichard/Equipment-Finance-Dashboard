// Universal borrower-profile metrics that apply across every module.
// Display-only for v1: not yet integrated into the composite risk score.

// FCCR (Fixed Charge Coverage Ratio):
//   FCCR = (EBITDA − Maintenance Capex) / Annual Debt Service
// We deliberately exclude taxes and dividends from fixed charges for v1.
// Maintenance capex defaults to 3% of revenue when the user leaves it blank.

export function computeBorrowerExtras(inputs, metrics) {
  const revenue = Number(inputs?.annualRevenue) || 0;
  const ebitda = Number(inputs?.ebitda) || 0;
  const cash = Number(inputs?.cashOnHand) || 0;
  const available = Number(inputs?.availableLiquidity) || 0;
  const totalLiquidity = cash + available;

  const computedDebtService =
    (metrics?.existingDebtService || 0) + (metrics?.newAnnualDebtService || 0);
  const debtService = Number(inputs?.actualAnnualDebtService) || computedDebtService;

  const userMaintCapex = Number(inputs?.maintenanceCapex);
  const maintCapex = userMaintCapex > 0 ? userMaintCapex : revenue * 0.03;
  const maintCapexUserProvided = userMaintCapex > 0;
  const fccr = debtService > 0 ? (ebitda - maintCapex) / debtService : null;

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
    maintCapexUserProvided,
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
