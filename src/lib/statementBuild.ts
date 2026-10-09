// ============================================================
// Financial statements on the New Deal form.
//
// The analyst types (or, from Phase 2, extraction fills) statement line
// items into inputs.financials. Whatever the line items are enough to build,
// Tranche builds, and writes into the same flat fields the modules score
// (ebitda, totalExistingDebt and so on). Fields the build cannot produce yet
// stay as the analyst typed them. A partial build is fine.
//
// A built field cannot be typed over silently: the analyst fixes the line
// item, or overrides the field with a reason, which hands it back to typing.
// When a field stops being built, it keeps its last value as a typed value.
// Design: EBITDA_Build_Design.md, "Step 3 form design".
// ============================================================

import { buildBorrowerInputs, validateTreatmentRules, setTreatmentOverride, allJudgmentsConfirmed } from './borrowerBuild';
import type { BorrowerFinancials, BuildResult, BuiltField, TreatmentRules, TreatmentRow } from './borrowerBuild';

export interface FieldOverride {
  reason: string;
  by?: string;
  at: string;
}

/** Statement sections the analyst opened. Display only, never scored. */
export type StatementSection = 'noOperatingIncome' | 'floorplan' | 'captiveFleet' | 'financeLeases' | 'operatingLeasesIn';

export interface StatementFinancials extends BorrowerFinancials {
  fieldOverrides?: Partial<Record<BuiltField, FieldOverride>>;
  show?: Partial<Record<StatementSection, boolean>>;
  /**
   * The firm's treatment rules when the deal was first saved. A saved deal
   * keeps the rules it was built with, even after the firm changes them.
   */
  firmRules?: TreatmentRules;
}

export const BUILT_FIELDS: BuiltField[] = [
  'annualRevenue', 'ebitda', 'totalExistingDebt', 'actualAnnualDebtService',
  'maintenanceCapex', 'cashTaxes', 'workingCapitalIncrease', 'leasePayments',
];

type Inputs = Record<string, unknown> & { financials?: StatementFinancials | null };

export interface StatementState {
  build: BuildResult | null;
  /** Fields the build produced, with their values. Overridden fields are not here. */
  built: Partial<Record<BuiltField, number>>;
  /** Caveats from mixing built and typed figures. */
  pairingCaveats: string[];
}

export function hasStatements(financials: StatementFinancials | null | undefined): boolean {
  const given = (v: unknown) => v !== null && v !== undefined && v !== '';
  const items = financials?.lineItems || {};
  // A company EBITDA figure alone is enough to start: it can score as stated.
  return Object.values(items).some((li) => li && given(li.value))
    || given(financials?.statedEbitda?.value) || given(financials?.adjustedEbitda?.value);
}

/** What the statements build right now, and which fields that covers. */
export function statementState(inputs: Inputs | null | undefined, rules: unknown): StatementState {
  const financials = inputs?.financials;
  if (!financials || !hasStatements(financials)) return { build: null, built: {}, pairingCaveats: [] };
  const treatment: TreatmentRules = firmRulesFor(inputs, rules);
  const build = buildBorrowerInputs(financials, treatment);
  const overrides = financials.fieldOverrides || {};
  const built: Partial<Record<BuiltField, number>> = {};
  BUILT_FIELDS.forEach((f) => {
    const v = build.derivations[f].value;
    if (v !== null && v !== undefined && !overrides[f]) built[f] = v;
  });
  return { build, built, pairingCaveats: pairingCaveats(build, built) };
}

// EBITDA built under a treatment rule pairs with debt and debt service built
// under the same rule. A typed debt figure may not follow it, and Tranche
// cannot check, so it says which item to confirm.
function pairingCaveats(build: BuildResult, built: Partial<Record<BuiltField, number>>): string[] {
  if (built.ebitda === undefined) return [];
  const typed = (['totalExistingDebt', 'actualAnnualDebtService'] as BuiltField[]).filter((f) => built[f] === undefined);
  if (!typed.length) return [];
  const present = (id: string) => build.judgments.find((j) => j.id === id)?.value === true;
  const t = build.treatment;
  const items: string[] = [];
  if (present('floorplanPresent')) items.push(t.floorplan === 'out' ? 'excludes the floorplan payable' : 'includes the floorplan payable');
  if (present('captiveFleetPresent')) items.push(t.captiveFleet === 'corporate' ? 'excludes vehicle debt' : 'includes vehicle debt');
  if (present('financeLeasesPresent')) items.push(t.financeLeases === 'in' ? 'includes finance lease liabilities' : 'excludes finance lease liabilities');
  if (t.operatingLeases === 'in') items.push('includes operating lease liabilities');
  if (!items.length) return [];
  const which = typed.map((f) => (f === 'totalExistingDebt' ? 'debt' : 'debt service')).join(' and ');
  return [`EBITDA is built from statements, ${which} typed. Confirm the typed figure ${items.join(', ')}, to match EBITDA.`];
}

/** The firm rules this deal builds under: its saved copy, else the firm's current rules. */
export function firmRulesFor(inputs: Inputs | null | undefined, rules: unknown): TreatmentRules {
  return validateTreatmentRules(inputs?.financials?.firmRules ?? rules);
}

/** Judgments still waiting for the analyst. Save to Pipeline needs zero. */
export function pendingJudgments(state: StatementState): number {
  if (!state.build) return 0;
  return allJudgmentsConfirmed(state.build) ? 0 : state.build.judgments.filter((j) => !j.confirmed).length;
}

/** Confirm a proposal, or pick another option, for one judgment. */
export function confirmJudgment<T extends Inputs>(inputs: T, id: string, value: unknown, proposed: unknown, by?: string, at: string = new Date().toISOString()): T {
  const f = inputs.financials || { lineItems: {} };
  if (id === 'ebitdaSource') return { ...inputs, financials: { ...f, ebitdaSource: value as StatementFinancials['ebitdaSource'] } };
  const judgments = { ...(f.judgments || {}), [id]: { proposed, confirmed: value, by, at } };
  return { ...inputs, financials: { ...f, judgments } };
}

/** Override one treatment row for this deal, or return it to the firm rule. */
export function setDealTreatment<T extends Inputs>(inputs: T, row: TreatmentRow, rule: string, reason: string, rules: unknown, by?: string): { inputs: T; error: string | null } {
  const f = inputs.financials || { lineItems: {} };
  const r = setTreatmentOverride(f, row, rule as never, reason, firmRulesFor(inputs, rules), by);
  if (r.error) return { inputs, error: r.error };
  return { inputs: { ...inputs, financials: r.financials as StatementFinancials }, error: null };
}

/** Keep a copy of the firm rules on the deal at save, unless it has one. */
export function withRulesSnapshot<T extends Inputs>(inputs: T, rules: unknown): T {
  const f = inputs.financials;
  if (!f || f.firmRules) return inputs;
  return { ...inputs, financials: { ...f, firmRules: validateTreatmentRules(rules) } };
}

/**
 * Write the built values into the flat fields. Returns the same object when
 * nothing changes, so it is safe to run on every inputs change.
 */
export function applyStatementBuild<T extends Inputs>(inputs: T, rules: unknown): T {
  const { built } = statementState(inputs, rules);
  let next: T | null = null;
  BUILT_FIELDS.forEach((f) => {
    if (built[f] === undefined) return;
    if (inputs[f] === built[f]) return;
    next = next || ({ ...inputs } as T);
    (next as Inputs)[f] = built[f];
  });
  return next || inputs;
}

/** Hand a built field back to typing. It starts from its current value. */
export function overrideField<T extends Inputs>(inputs: T, field: BuiltField, reason: string, by?: string, at: string = new Date().toISOString()): { inputs: T; error: string | null } {
  if (!reason || !reason.trim()) return { inputs, error: 'An override needs a reason.' };
  const f = inputs.financials || { lineItems: {} };
  const fieldOverrides = { ...(f.fieldOverrides || {}), [field]: { reason: reason.trim(), by, at } };
  return { inputs: { ...inputs, financials: { ...f, fieldOverrides } }, error: null };
}

/** Undo an override: the field is built again. */
export function clearFieldOverride<T extends Inputs>(inputs: T, field: BuiltField): T {
  const f = inputs.financials;
  if (!f?.fieldOverrides?.[field]) return inputs;
  const fieldOverrides = { ...f.fieldOverrides };
  delete fieldOverrides[field];
  return { ...inputs, financials: { ...f, fieldOverrides } };
}

/** Remove the statements. Every field keeps its last value, now typed. */
export function clearStatements<T extends Inputs>(inputs: T): T {
  const next = { ...inputs };
  delete next.financials;
  return next;
}
