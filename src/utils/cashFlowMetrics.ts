// ============================================================
// Cash-flow coverage and cash-flow stress, shared by every module.
//
// DSCR divides EBITDA by debt service. EBITDA is not cash: the borrower
// still pays taxes, keeps its equipment running and funds its receivables
// before a dollar reaches the lender. These metrics take those out.
//
//   Free cash flow for debt service
//     = EBITDA - cash taxes - maintenance capex - increase in working capital
//   Cash-flow DSCR
//     = free cash flow for debt service / (existing + new debt service)
//   FCCR
//     = (EBITDA + rent - maintenance capex - cash taxes)
//       / (existing + new debt service + rent)
//
// Rent is added back on top because EBITDA is already after rent. Putting
// rent in the denominator without the add-back charges it twice. This is the
// standard EBITDAR form of the fixed charge coverage ratio.
//
// Missing inputs are never filled in. A metric whose inputs are incomplete is
// null, and `missing` names what was not provided. A partial number would
// always read better than the truth, because every omitted item is a cost.
//
// Not part of the composite score. These metrics feed the verdict through
// floors in the screening criteria (src/lib/screeningCriteria.ts).
// ============================================================

import type { ScreeningCriteria } from '../types';

export type CashFlowInputKey =
  | 'maintenanceCapex'
  | 'cashTaxes'
  | 'workingCapitalIncrease'
  | 'leasePayments';

export const CASH_FLOW_INPUT_LABELS: Record<CashFlowInputKey, string> = {
  maintenanceCapex: 'maintenance capex',
  cashTaxes: 'cash taxes',
  workingCapitalIncrease: 'change in working capital',
  leasePayments: 'rent',
};

const CF_DSCR_INPUTS: CashFlowInputKey[] = ['cashTaxes', 'maintenanceCapex', 'workingCapitalIncrease'];
const FCCR_INPUTS: CashFlowInputKey[] = ['cashTaxes', 'maintenanceCapex', 'leasePayments'];

/** The criteria fields this file reads. Defaults live in DEFAULT_CRITERIA. */
export type CashFlowCriteria = Pick<
  ScreeningCriteria,
  | 'minCashFlowDscr'
  | 'minFccr'
  | 'stressRevenueDeclineMild'
  | 'stressRevenueDeclineModerate'
  | 'stressRevenueDeclineSevere'
  | 'stressMarginCompressionBps'
  | 'stressRateShockBps'
  | 'stressWcDelayDays'
  | 'stressCombinedRevenueDecline'
  | 'stressCombinedMarginBps'
>;

interface CashFlowMetricsIn {
  existingDebtService?: number;
  newAnnualDebtService?: number;
  debtServiceEstimated?: boolean;
  /** Principal of the new facility that floats with SOFR. 0 for a fixed-rate term deal. */
  newFloatingPrincipal?: number;
}

type InputsIn = Record<string, unknown>;

/**
 * The value an analyst gave for a cash-flow input, or null if none.
 *
 * Blank, null and undefined are "not provided". For the new fields an
 * entered 0 is an answer: a borrower with no leases enters 0 rent.
 * Maintenance capex is the exception. The form stored a blank capex field
 * as 0 for as long as the field has existed, so on saved deals a 0 cannot
 * be told apart from "not entered". A real maintenance capex of zero is
 * not a credible figure for an operating business, so 0 reads as not
 * provided.
 */
export function providedValue(inputs: InputsIn | null | undefined, key: CashFlowInputKey | 'floatingRateDebtPct'): number | null {
  const raw = inputs?.[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (key === 'maintenanceCapex' && n <= 0) return null;
  return n;
}

function missingFrom(inputs: InputsIn | null | undefined, keys: CashFlowInputKey[]): CashFlowInputKey[] {
  return keys.filter((k) => providedValue(inputs, k) === null);
}

interface Coverage {
  dscr: number | null;
  cashFlowDscr: number | null;
  fccr: number | null;
  /** EBITDA - taxes - capex - working capital. Null when not computable. */
  freeCashFlow: number | null;
}

function coverage(
  ebitda: number,
  debtService: number,
  vals: { taxes: number | null; capex: number | null; wc: number | null; rent: number | null },
  cfDscrComplete: boolean,
  fccrComplete: boolean,
): Coverage {
  const hasDs = debtService > 0;
  const freeCashFlow = cfDscrComplete
    ? ebitda - (vals.taxes as number) - (vals.capex as number) - (vals.wc as number)
    : null;
  const cashFlowDscr = freeCashFlow != null && hasDs ? freeCashFlow / debtService : null;
  let fccr: number | null = null;
  if (fccrComplete) {
    const rent = vals.rent as number;
    const denom = debtService + rent;
    if (denom > 0) fccr = (ebitda + rent - (vals.capex as number) - (vals.taxes as number)) / denom;
  }
  return { dscr: hasDs ? ebitda / debtService : null, cashFlowDscr, fccr, freeCashFlow };
}

export type CashFlowScenarioKind = 'base' | 'revenue' | 'margin' | 'rate' | 'working_capital' | 'combined';

export interface CashFlowScenario extends Coverage {
  key: string;
  kind: CashFlowScenarioKind;
  label: string;
  /** One line on what moved, for the table and the memo. */
  detail: string;
  ebitda: number;
  debtService: number;
  workingCapitalIncrease: number | null;
}

export interface CashFlowAnalysis {
  base: CashFlowScenario;
  scenarios: CashFlowScenario[];
  /** Inputs each metric still needs. Empty array means the metric is computed. */
  missing: { cashFlowDscr: CashFlowInputKey[]; fccr: CashFlowInputKey[] };
  /** Caveats a reader needs next to the numbers. Plain sentences. */
  assumptions: string[];
  debtServiceEstimated: boolean;
}

const pct = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/**
 * Base-case cash-flow coverage plus the stress scenarios.
 *
 * Maintenance capex moves with revenue: a borrower selling less runs its
 * assets less and replaces fewer of them. Cash taxes and rent are held.
 * Taxes would fall with lower earnings, so holding them is conservative.
 */
export function computeCashFlowAnalysis(
  inputs: InputsIn | null | undefined,
  metrics: CashFlowMetricsIn | null | undefined,
  criteria: CashFlowCriteria,
): CashFlowAnalysis {
  const revenue = Number(inputs?.annualRevenue) || 0;
  const ebitda = Number(inputs?.ebitda) || 0;
  const existingDs = metrics?.existingDebtService || 0;
  const newDs = metrics?.newAnnualDebtService || 0;
  const debtService = existingDs + newDs;

  const vals = {
    taxes: providedValue(inputs, 'cashTaxes'),
    capex: providedValue(inputs, 'maintenanceCapex'),
    wc: providedValue(inputs, 'workingCapitalIncrease'),
    rent: providedValue(inputs, 'leasePayments'),
  };
  const missing = {
    cashFlowDscr: missingFrom(inputs, CF_DSCR_INPUTS),
    fccr: missingFrom(inputs, FCCR_INPUTS),
  };
  const cfComplete = missing.cashFlowDscr.length === 0;
  const fccrComplete = missing.fccr.length === 0;

  const scenario = (
    key: string,
    kind: CashFlowScenarioKind,
    label: string,
    detail: string,
    e: number,
    ds: number,
    wc: number | null,
    revenueFactor = 1,
  ): CashFlowScenario => ({
    key, kind, label, detail, ebitda: e, debtService: ds, workingCapitalIncrease: wc,
    ...coverage(e, ds, { ...vals, capex: vals.capex != null ? vals.capex * revenueFactor : null, wc }, cfComplete && wc != null, fccrComplete),
  });

  const base = scenario('base', 'base', 'Base case', 'As entered', ebitda, debtService, vals.wc);
  const scenarios: CashFlowScenario[] = [base];
  const assumptions: string[] = [];

  // Revenue declines at a constant EBITDA margin.
  const declines = [
    ['revenue_mild', criteria.stressRevenueDeclineMild],
    ['revenue_moderate', criteria.stressRevenueDeclineModerate],
    ['revenue_severe', criteria.stressRevenueDeclineSevere],
  ] as const;
  for (const [key, d] of declines) {
    if (!(d > 0)) continue;
    scenarios.push(scenario(key, 'revenue', `Revenue -${pct(d)}`, 'EBITDA and maintenance capex fall in line, margin held', ebitda * (1 - d / 100), debtService, vals.wc, 1 - d / 100));
  }

  // Margin compression on the same revenue.
  const mBps = criteria.stressMarginCompressionBps;
  if (mBps > 0 && revenue > 0) {
    scenarios.push(scenario('margin', 'margin', `Margin -${mBps} bps`, 'Same revenue, lower EBITDA margin', ebitda - revenue * (mBps / 10000), debtService, vals.wc));
  }

  // Floating-rate shock. The new facility's floating principal always takes
  // it. Existing debt takes it only on the share the analyst says floats.
  const rBps = criteria.stressRateShockBps;
  if (rBps > 0) {
    const newFloating = metrics?.newFloatingPrincipal || 0;
    const floatingPct = providedValue(inputs, 'floatingRateDebtPct');
    const existingDebt = Number(inputs?.totalExistingDebt) || 0;
    const existingFloating = floatingPct != null ? existingDebt * Math.min(Math.max(floatingPct, 0), 100) / 100 : 0;
    const extra = (newFloating + existingFloating) * (rBps / 10000);
    const covers = [
      newFloating > 0 ? 'the new facility' : null,
      existingFloating > 0 ? `${pct(floatingPct as number)} of existing debt` : null,
    ].filter(Boolean).join(' and ');
    scenarios.push(scenario('rate', 'rate', `Rates +${rBps} bps`, covers ? `Applied to ${covers}` : 'No floating-rate debt entered', ebitda, debtService + extra, vals.wc));
    const existingUnknown = existingDebt > 0 && floatingPct == null;
    if (newFloating === 0 && existingFloating === 0) {
      assumptions.push(existingUnknown
        ? 'Rate shock changes nothing here. The new facility is fixed rate and the floating share of existing debt was not provided.'
        : 'Rate shock changes nothing here. The new facility is fixed rate and no existing debt is marked floating.');
    } else if (existingUnknown) {
      assumptions.push('Rate shock does not cover existing debt. Floating share of existing debt not provided.');
    }
  }

  // Customers pay later: cash tied up in receivables.
  const days = criteria.stressWcDelayDays;
  if (days > 0 && revenue > 0) {
    const drag = revenue * (days / 365);
    scenarios.push(scenario('working_capital', 'working_capital', `Customers pay ${days} days slower`, `${formatUsdShort(drag)} more tied up in receivables`, ebitda, debtService, vals.wc != null ? vals.wc + drag : null));
  }

  // Combined downturn: revenue and margin together.
  const cD = criteria.stressCombinedRevenueDecline;
  const cBps = criteria.stressCombinedMarginBps;
  if ((cD > 0 || cBps > 0) && revenue > 0) {
    const stressedRevenue = revenue * (1 - cD / 100);
    const e = ebitda * (1 - cD / 100) - stressedRevenue * (cBps / 10000);
    scenarios.push(scenario('combined', 'combined', 'Combined severe', `Revenue -${pct(cD)} and margin -${cBps} bps`, e, debtService, vals.wc, 1 - cD / 100));
  }

  assumptions.push('Maintenance capex falls with revenue. Cash taxes and rent are held at base-case levels in every scenario.');
  if (metrics?.debtServiceEstimated) {
    assumptions.push('Existing debt service is estimated at 8% of existing debt, not reported.');
  }

  return { base, scenarios, missing, assumptions, debtServiceEstimated: !!metrics?.debtServiceEstimated };
}

/** "cash taxes and maintenance capex" */
export function describeMissing(keys: CashFlowInputKey[]): string {
  const names = keys.map((k) => CASH_FLOW_INPUT_LABELS[k]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function formatUsdShort(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

/**
 * FCCR for one EBITDA figure against total debt service, or null when cash
 * taxes, maintenance capex or rent is not provided. The module stress
 * tables use this so their FCCR column matches the metric card.
 */
export function fccrFor(inputs: InputsIn | null | undefined, ebitda: number, debtService: number): number | null {
  if (missingFrom(inputs, FCCR_INPUTS).length > 0) return null;
  const rent = providedValue(inputs, 'leasePayments') as number;
  const denom = debtService + rent;
  if (!(denom > 0)) return null;
  return (ebitda + rent - (providedValue(inputs, 'maintenanceCapex') as number) - (providedValue(inputs, 'cashTaxes') as number)) / denom;
}
