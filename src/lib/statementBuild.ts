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

import { buildBorrowerInputs, validateTreatmentRules, setTreatmentOverride, allJudgmentsConfirmed, TREATMENT_ROWS } from './borrowerBuild';
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
  /** The last time the deal was moved onto newer firm rules. Shown in the memo. */
  rulesRebuilt?: RulesRebuild;
}

export interface RulesRebuild {
  at: string;
  by?: string;
  /** True when an admin rebuilt it with the firm's other open deals. */
  bulk?: boolean;
  from: TreatmentRules;
  to: TreatmentRules;
  /** Rules that differ between from and to, gap tolerance included. */
  changed: (TreatmentRow | 'ebitdaGapTolerance')[];
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
/**
 * A rule that puts an item into debt changes both sides of DSCR: EBITDA
 * rises (its interest is no longer an operating cost), and debt and debt
 * service rise. When the statements build EBITDA but not debt or debt
 * service, only the first half applies and DSCR comes out too high. Saving
 * waits until both sides are built (Joel, 2026-10-12). A typed debt figure
 * with an override reason counts as deliberate and is let through.
 * Returns the message to show, or null.
 */
export function debtGap(state: StatementState, inputs: Inputs | null | undefined): string | null {
  const build = state.build;
  if (!build || build.derivations.ebitda.value === null) return null;
  const present = (id: string) => build.judgments.find((j) => j.id === id)?.value === true;
  const t = build.treatment;
  const items: string[] = [];
  if (present('floorplanPresent') && t.floorplan === 'in') items.push('Floorplan');
  if (present('captiveFleetPresent') && t.captiveFleet === 'consolidated') items.push('Vehicle debt');
  if (present('financeLeasesPresent') && t.financeLeases === 'in') items.push('Finance leases');
  if (t.operatingLeases === 'in') items.push('Operating leases');
  if (!items.length) return null;
  const overrides = inputs?.financials?.fieldOverrides || {};
  const open = (['totalExistingDebt', 'actualAnnualDebtService'] as BuiltField[])
    .filter((f) => build.derivations[f].value === null && !overrides[f]);
  if (!open.length) return null;
  const missing = Array.from(new Set(build.errors
    .filter((e) => / is missing\. Needed for (total debt|debt service)/.test(e))
    .map((e) => e.split(' is missing.')[0])));
  const what = items.join(' and ');
  const verb = items.length === 1 ? 'counts' : 'count';
  const lines = missing.length ? `Enter ${missing.join(', ')} (0 if none)` : 'Complete total debt and debt service';
  return `${what} ${verb} as debt under your rules. ${lines} so leverage and DSCR include ${items.length === 1 ? 'it' : 'them'}.`;
}

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

/** Which rules differ between two sets, gap tolerance included. */
export function changedRules(from: unknown, to: unknown): RulesRebuild['changed'] {
  const a = validateTreatmentRules(from);
  const b = validateTreatmentRules(to);
  const rows: RulesRebuild['changed'] = TREATMENT_ROWS.filter((row) => a[row] !== b[row]);
  if (a.ebitdaGapTolerance !== b.ebitdaGapTolerance) rows.push('ebitdaGapTolerance');
  return rows;
}

/** True when the deal's saved rules differ from the firm's rules today. */
export function rulesOutOfDate(inputs: Inputs | null | undefined, rules: unknown): boolean {
  const saved = inputs?.financials?.firmRules;
  return !!saved && changedRules(saved, rules).length > 0;
}

/**
 * Move a deal onto the firm's current rules. A treatment row whose rule
 * changed goes back to pending, so the analyst confirms it under the new
 * rule. A row the deal overrides is left alone: the firm rule never applied
 * to it. In a bulk rebuild the admin's action is the confirmation, so the
 * changed rows are confirmed in the admin's name instead.
 * Returns the same object when the rules have not changed.
 */
export function rebuildWithCurrentRules<T extends Inputs>(
  inputs: T,
  rules: unknown,
  opts: { by?: string; at?: string; bulk?: boolean } = {},
): { inputs: T; changed: RulesRebuild['changed'] } {
  const f = inputs.financials;
  if (!f) return { inputs, changed: [] };
  const from = firmRulesFor(inputs, rules);
  const to = validateTreatmentRules(rules);
  const changed = changedRules(from, to);
  if (!changed.length) return { inputs, changed };
  const at = opts.at || new Date().toISOString();
  const judgments = { ...(f.judgments || {}) };
  const overrides = f.treatmentOverrides || {};
  const rows = (changed.filter((c) => c !== 'ebitdaGapTolerance') as TreatmentRow[]).filter((row) => !overrides[row]);
  rows.forEach((row) => { delete judgments[`treatment.${row}`]; });
  if (opts.bulk) {
    // Confirm the rows the build asks about under the new rules. That
    // includes a row the new rule brings in (operating leases "in" with no
    // rent line), and skips an item the borrower does not have.
    const asked = buildBorrowerInputs({ ...f, judgments }, to).judgments;
    rows.forEach((row) => {
      const id = `treatment.${row}`;
      if (asked.some((j) => j.id === id)) judgments[id] = { proposed: to[row], confirmed: to[row], by: opts.by, at };
    });
  }
  const rulesRebuilt: RulesRebuild = { at, by: opts.by, from, to, changed, ...(opts.bulk ? { bulk: true } : {}) };
  return { inputs: { ...inputs, financials: { ...f, firmRules: to, judgments, rulesRebuilt } }, changed };
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

export interface OverrideChange {
  kind: 'treatment' | 'field';
  /** Treatment row (floorplan, ...) or built field (ebitda, ...). */
  key: string;
  /** The rule chosen, for a treatment override. */
  rule?: string;
  reason?: string;
  by?: string;
  at?: string;
  /** True when an override that was on the deal has been taken off. */
  removed?: boolean;
}

function overrideChanges(prev: StatementFinancials | null | undefined, next: StatementFinancials | null | undefined): OverrideChange[] {
  const out: OverrideChange[] = [];
  const diff = (kind: OverrideChange['kind'], a: Record<string, any> = {}, b: Record<string, any> = {}) => {
    Object.entries(b).forEach(([key, o]) => {
      if (!o) return;
      const before = a[key];
      if (!before || before.reason !== o.reason || before.rule !== o.rule) {
        out.push({ kind, key, rule: o.rule, reason: o.reason, by: o.by, at: o.at });
      }
    });
    Object.keys(a).forEach((key) => {
      if (a[key] && !b[key]) out.push({ kind, key, removed: true });
    });
  };
  diff('treatment', prev?.treatmentOverrides, next?.treatmentOverrides);
  diff('field', prev?.fieldOverrides, next?.fieldOverrides);
  return out;
}

/**
 * What the server does with a deal before it stores it. Built fields are
 * rebuilt here, so a figure the client sent for a built field never counts
 * (AUDIT P0-1). The deal keeps the firm rules it was first saved with.
 * Every judgment has to be confirmed, and each override that is new since
 * the last save is returned for its own audit entry.
 */
export interface PreparedSave<T> {
  inputs: T;
  pending: number;
  overrides: OverrideChange[];
  /** Set when the rules on the deal are neither its saved rules nor the firm's current ones. */
  rulesError: string | null;
  /** Set when the deal moved onto the firm's current rules in this save. */
  rulesChange: RulesRebuild | null;
  /** Set when a rule puts an item into debt but debt or debt service is not built. */
  debtGap?: string | null;
}

const RULES_ERROR = "The treatment rules on this deal are not your firm's rules. Rebuild with current firm rules, then save.";

export function prepareForSave<T extends Inputs>(
  inputs: T,
  orgRules: unknown,
  previous?: Inputs | null,
  opts: { at?: string; by?: string; bulk?: boolean } = {},
): PreparedSave<T> {
  if (!inputs?.financials) {
    return { inputs, pending: 0, overrides: overrideChanges(previous?.financials, null), rulesError: null, rulesChange: null };
  }
  // The rules a deal builds under are never the client's to choose. They
  // are the rules it was saved with, or the firm's rules today.
  const current = validateTreatmentRules(orgRules);
  const prevRules = previous?.financials?.firmRules ? validateTreatmentRules(previous.financials.firmRules) : null;
  const sent = inputs.financials.firmRules ? validateTreatmentRules(inputs.financials.firmRules) : null;
  const same = (a: unknown, b: unknown) => changedRules(a, b).length === 0;
  let rules: TreatmentRules;
  if (!sent) rules = prevRules || current;
  else if (prevRules && same(sent, prevRules)) rules = prevRules;
  else if (same(sent, current)) rules = current;
  else return { inputs, pending: 0, overrides: [], rulesError: RULES_ERROR, rulesChange: null };

  // The rebuild record is stamped here, not taken from the client. On a
  // per-deal save the name comes from the client, as with judgments. A bulk
  // rebuild passes the admin's name from the server.
  let rulesChange: RulesRebuild | null = null;
  let rulesRebuilt = previous?.financials?.rulesRebuilt;
  if (prevRules && !same(prevRules, rules)) {
    rulesChange = {
      at: opts.at || new Date().toISOString(),
      by: opts.bulk ? opts.by : inputs.financials.rulesRebuilt?.by,
      ...(opts.bulk ? { bulk: true } : {}),
      from: prevRules,
      to: rules,
      changed: changedRules(prevRules, rules),
    };
    rulesRebuilt = rulesChange;
  }
  const financials: StatementFinancials = { ...inputs.financials, firmRules: rules };
  if (rulesRebuilt) financials.rulesRebuilt = rulesRebuilt;
  else delete financials.rulesRebuilt;

  const built = applyStatementBuild({ ...inputs, financials }, rules);
  const state = statementState(built, rules);
  const pending = pendingJudgments(state);
  return { inputs: built, pending, overrides: overrideChanges(previous?.financials, built.financials), rulesError: null, rulesChange, debtGap: debtGap(state, built) };
}
