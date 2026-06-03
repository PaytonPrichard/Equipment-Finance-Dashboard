// ============================================================
// Covenant test evaluation — shared, asset-class agnostic.
//
// Pure logic: compares a reported value (financial covenants) or a
// deliverable's timeliness (reporting covenants) to the covenant's bands
// and returns pass / flag / fail. No Tailwind, no asset-class branches,
// no DB access. The component layer maps the category to presentation.
// See Monitoring_Phase1_Design.md section 5.
// ============================================================

import type { CovenantKind, CovenantDirection, CovenantStatus, CovenantSeed, TestFrequency } from '../types';

// Add days to an ISO date (date-only or full datetime). Returns YYYY-MM-DD.
function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Date-only portion. YYYY-MM-DD strings compare correctly lexicographically.
function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Financial covenant: compare a reported value to the flag/fail bands.
 * direction 'min' breaches downward (DSCR, turnover); 'max' breaches upward
 * (leverage, LTV, concentration). A null band means "no boundary at this level".
 *
 * Boundaries are strict, matching evaluateScreening: a value exactly at the
 * flag threshold passes. DSCR 1.25 against a 1.25 floor is a pass; 1.24 flags.
 * A value exactly at the fail threshold is not yet a fail (mirrors the
 * `dscr < 1.0` and `leverage > maxLeverage * 1.5` checks in screeningCriteria).
 */
export function evaluateFinancialCovenant(
  direction: CovenantDirection,
  flagValue: number | null,
  failValue: number | null,
  reported: number,
): CovenantStatus {
  if (direction === 'min') {
    if (failValue != null && reported < failValue) return 'fail';
    if (flagValue != null && reported < flagValue) return 'flag';
    return 'pass';
  }
  if (failValue != null && reported > failValue) return 'fail';
  if (flagValue != null && reported > flagValue) return 'flag';
  return 'pass';
}

/**
 * Reporting covenant: was the deliverable in on time?
 * pass = on or before the due date; flag = late but within the cure window;
 * fail = past the cure window, or still unsubmitted and already past cure as
 * of the evaluation date.
 */
export function evaluateReportingCovenant(
  dueDate: string,
  submittedAt: string | null,
  cureDays: number,
  asOf: string,
): CovenantStatus {
  const due = dateOnly(dueDate);
  const cureEnd = addDaysISO(due, cureDays);

  if (submittedAt) {
    const submitted = dateOnly(submittedAt);
    if (submitted <= due) return 'pass';
    if (submitted <= cureEnd) return 'flag';
    return 'fail';
  }

  // Not submitted yet: judge against the evaluation date.
  const now = dateOnly(asOf);
  if (now <= due) return 'pass';      // not yet due
  if (now <= cureEnd) return 'flag';  // late, still curable
  return 'fail';
}

export interface CovenantObservation {
  reportedValue?: number | null;
  submittedAt?: string | null;
  dueDate?: string | null;
  asOf: string;                       // ISO date the test is evaluated as-of
}

interface CovenantEvalShape {
  kind: CovenantKind;
  direction: CovenantDirection | null;
  flag_value: number | null;
  fail_value: number | null;
  cure_days: number;
}

/**
 * Dispatch a covenant test to the right evaluator by kind. Throws on missing
 * required observation fields — those are programmer errors, not user input.
 */
export function evaluateCovenantTest(
  covenant: CovenantEvalShape,
  obs: CovenantObservation,
): CovenantStatus {
  if (covenant.kind === 'financial') {
    if (covenant.direction == null) {
      throw new Error('financial covenant requires a direction');
    }
    if (obs.reportedValue == null) {
      throw new Error('financial covenant test requires a reportedValue');
    }
    return evaluateFinancialCovenant(
      covenant.direction,
      covenant.flag_value,
      covenant.fail_value,
      obs.reportedValue,
    );
  }

  if (!obs.dueDate) {
    throw new Error('reporting covenant test requires a dueDate');
  }
  return evaluateReportingCovenant(
    obs.dueDate,
    obs.submittedAt ?? null,
    covenant.cure_days,
    obs.asOf,
  );
}

// ------- Seed builders -------
// Shared shape helpers used by each module's getDefaultCovenants. They build
// CovenantSeed objects; the module decides which covenants apply to its asset
// class and supplies the thresholds.

/**
 * A financial covenant seed: compares a reported metric to flag/fail bands.
 * `failValue` is optional (null = no hard-breach level, only watch).
 */
export function financialCovenantSeed(
  name: string,
  metricKey: string,
  direction: CovenantDirection,
  flagValue: number,
  failValue: number | null,
  unit: CovenantSeed['unit'],
  frequency: TestFrequency,
): CovenantSeed {
  return {
    name,
    kind: 'financial',
    metric_key: metricKey,
    direction,
    flag_value: flagValue,
    fail_value: failValue,
    unit,
    test_frequency: frequency,
    cure_days: 0,
    source: 'underwritten',
  };
}

/**
 * Advance a date by one covenant test interval. Used to roll next_test_date
 * forward after a test is recorded. Month arithmetic; an end-of-month date can
 * shift by a day or two across a shorter month, which is fine for a calendar.
 */
export function addFrequency(isoDate: string, frequency: TestFrequency): string {
  const months = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : frequency === 'semiannual' ? 6 : 12;
  const d = new Date(dateOnly(isoDate) + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * A reporting (affirmative) covenant seed: no threshold, just a cadence and an
 * optional cure window for a deliverable the borrower owes on a schedule.
 */
export function reportingCovenantSeed(
  name: string,
  frequency: TestFrequency,
  cureDays = 5,
): CovenantSeed {
  return {
    name,
    kind: 'reporting',
    metric_key: null,
    direction: null,
    flag_value: null,
    fail_value: null,
    unit: null,
    test_frequency: frequency,
    cure_days: cureDays,
    source: 'underwritten',
  };
}
