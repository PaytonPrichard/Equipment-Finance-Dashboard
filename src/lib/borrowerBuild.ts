// ============================================================
// Borrower inputs built from financial statement line items.
//
// A pre-scoring layer shared by every asset class. It writes the same flat
// fields the modules already read (ebitda, totalExistingDebt and so on), so
// no module learns about line items. Design: EBITDA_Build_Design.md.
//
// The principle is that EBITDA and debt agree on every item. Whatever is
// excluded from one is excluded from the other, and a treatment override
// flips EBITDA, debt and debt service together so the pairing cannot break.
//
// Arithmetic is automatic. Judgment calls (where a line sits, which EBITDA
// scores, the maintenance capex proxy) are proposed here and confirmed by the
// analyst. An unconfirmed proposal is used for live scoring and reported as a
// caveat. Missing required lines are errors. Missing optional lines are
// caveats and their output is null, never estimated.
//
// Sign convention: every line item is entered as the statement reports it,
// as a positive magnitude, except operating income, pretax income (either
// can be negative) and the working capital change, which keeps the
// cash-flow statement's sign (negative = cash used = working capital grew).
// ============================================================

export interface LineItemSource {
  document?: string;
  page?: number | string;
}

export interface LineItem {
  value: number | null;
  source?: LineItemSource;
  origin?: 'extracted' | 'typed';
}

export type LineItemKey =
  | 'revenue'
  | 'operatingIncome'
  | 'pretaxIncome'
  | 'interestExpense'
  | 'depreciationAmortization'
  | 'amortizationOfIntangibles'
  | 'floorplanInterest'
  | 'vehicleDepreciation'
  | 'vehicleInterest'
  | 'financeLeaseAmortization'
  | 'financeLeaseInterest'
  | 'rentExpense'
  | 'interestPaid'
  | 'incomeTaxesPaid'
  | 'capitalExpenditures'
  | 'statedMaintenanceCapex'
  | 'workingCapitalChange'
  | 'revolver'
  | 'termLoansAndNotes'
  | 'currentMaturities'
  | 'financeLeaseLiabilities'
  | 'currentFinanceLeaseLiabilities'
  | 'operatingLeaseLiabilities'
  | 'floorplanPayable'
  | 'vehicleDebt'
  | 'currentVehicleDebtMaturities';

export const LINE_ITEM_LABELS: Record<LineItemKey, string> = {
  revenue: 'Revenue',
  operatingIncome: 'Operating income',
  pretaxIncome: 'Pretax income',
  interestExpense: 'Interest expense',
  depreciationAmortization: 'Depreciation and amortization',
  amortizationOfIntangibles: 'Amortization of intangibles',
  floorplanInterest: 'Floorplan interest',
  vehicleDepreciation: 'Vehicle depreciation',
  vehicleInterest: 'Vehicle interest',
  financeLeaseAmortization: 'Finance lease amortization',
  financeLeaseInterest: 'Finance lease interest',
  rentExpense: 'Rent / operating lease cost',
  interestPaid: 'Cash interest paid',
  incomeTaxesPaid: 'Income taxes paid',
  capitalExpenditures: 'Capital expenditures',
  statedMaintenanceCapex: 'Maintenance capex, borrower-stated',
  workingCapitalChange: 'Change in working capital',
  revolver: 'Revolver',
  termLoansAndNotes: 'Term loans and notes, including current portion',
  currentMaturities: 'Current maturities of long-term debt',
  financeLeaseLiabilities: 'Finance lease liabilities, total',
  currentFinanceLeaseLiabilities: 'Current finance lease liabilities',
  operatingLeaseLiabilities: 'Operating lease liabilities, total',
  floorplanPayable: 'Floorplan payable',
  vehicleDebt: 'Vehicle debt, total',
  currentVehicleDebtMaturities: 'Current maturities of vehicle debt',
};

export interface AddBack {
  label: string;
  amount: number;
  source?: LineItemSource;
  decision: 'accepted' | 'rejected' | null;
}

export interface TreatmentOverride<R> {
  rule: R;
  reason: string;
  by?: string;
  at?: string;
}

export interface StoredJudgment {
  proposed?: unknown;
  confirmed?: unknown;
  by?: string;
  at?: string;
}

export interface BorrowerFinancials {
  fiscalYearEnd?: string;
  lineItems: Partial<Record<LineItemKey, LineItem>>;
  ebitdaSource?: EbitdaSource;
  /** One EBITDA figure as the company names it, no bridge. */
  statedEbitda?: { value: number | null; label?: string; source?: LineItemSource };
  /**
   * The company's Adjusted EBITDA total, copied as stated, with the bridge
   * it gives. The value already includes every listed add-back.
   */
  adjustedEbitda?: { value: number | null; label?: string; source?: LineItemSource; addBacks?: AddBack[] };
  treatmentOverrides?: Partial<{ [K in TreatmentRow]: TreatmentOverride<TreatmentRules[K]> }>;
  judgments?: Record<string, StoredJudgment>;
}

export type EbitdaSource = 'built' | 'adjusted' | 'stated';
export type TreatmentRow = 'financeLeases' | 'operatingLeases' | 'floorplan' | 'captiveFleet';

export interface TreatmentRules {
  financeLeases: 'in' | 'out';
  operatingLeases: 'in' | 'out';
  floorplan: 'in' | 'out';
  captiveFleet: 'corporate' | 'consolidated';
  /** Unexplained gap between built and company EBITDA, as a share of built, above which a caveat shows. */
  ebitdaGapTolerance: number;
}

/** Firm defaults (design section 8 and decision 2). Stored per firm in org_settings.treatmentRules. */
export const DEFAULT_TREATMENT_RULES: TreatmentRules = {
  financeLeases: 'in',
  operatingLeases: 'out',
  floorplan: 'out',
  captiveFleet: 'corporate',
  ebitdaGapTolerance: 0.05,
};

/** Where an expense is reported. Below operating income means not yet deducted in operating income. */
export type Placement = 'operatingExpenses' | 'belowOperatingIncome';

export interface Judgment {
  id: string;
  label: string;
  proposed: unknown;
  /** The value the build used: confirmed if confirmed, else proposed. */
  value: unknown;
  options: unknown[];
  confirmed: boolean;
}

export interface Term {
  sign: '+' | '-';
  label: string;
  value: number;
  key?: LineItemKey;
  source?: LineItemSource;
}

export interface Derivation {
  value: number | null;
  label: string;
  /** e.g. "Operating income + Depreciation and amortization - Floorplan interest". */
  formula: string;
  terms: Term[];
  notes: string[];
  estimate?: boolean;
}

export type BuiltField =
  | 'annualRevenue'
  | 'ebitda'
  | 'totalExistingDebt'
  | 'actualAnnualDebtService'
  | 'maintenanceCapex'
  | 'cashTaxes'
  | 'workingCapitalIncrease'
  | 'leasePayments';

export interface EbitdaComparison {
  against: 'adjusted' | 'stated';
  companyLabel: string;
  built: number;
  company: number;
  gap: number;
  /** Add-backs the company lists in its bridge. */
  explainedByAddBacks: number;
  /** Difference caused by the firm's treatment rules, not by the company. */
  explainedByTreatment: number;
  explained: number;
  unexplained: number;
  /** Unexplained as a share of built EBITDA. Null when built EBITDA is 0. */
  unexplainedPct: number | null;
  tolerance: number;
  overTolerance: boolean;
}

export interface BuildResult {
  inputs: Record<BuiltField, number | null>;
  derivations: Record<BuiltField, Derivation>;
  judgments: Judgment[];
  caveats: string[];
  errors: string[];
  /** The treatment actually applied to this deal, after overrides. */
  treatment: TreatmentRules;
  ebitdaSource: EbitdaSource;
  comparisons: EbitdaComparison[];
}

const usd = (n: number) => {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build the scoring inputs from statement line items.
 *
 * `rules` is the firm's treatment rules (org_settings.treatmentRules), merged
 * over the defaults. Per-deal overrides in `financials.treatmentOverrides`
 * win over the firm rules row by row.
 */
export function buildBorrowerInputs(
  financials: BorrowerFinancials,
  rules: Partial<TreatmentRules> = {},
): BuildResult {
  const lines = financials.lineItems || {};
  const stored = financials.judgments || {};
  const errors: string[] = [];
  const caveats: string[] = [];
  const judgments: Judgment[] = [];

  const line = (k: LineItemKey): number | null => num(lines[k]?.value);
  const has = (k: LineItemKey) => line(k) !== null;
  const term = (sign: '+' | '-', k: LineItemKey): Term => ({
    sign, key: k, label: LINE_ITEM_LABELS[k], value: line(k) as number, source: lines[k]?.source,
  });

  /** Register a judgment and return the value the build uses. */
  function judge<T>(id: string, label: string, proposed: T, options: T[], describe: (v: T) => string): T {
    const s = stored[id];
    const isConfirmed = s?.confirmed !== undefined && s?.confirmed !== null && options.includes(s.confirmed as T);
    const value = isConfirmed ? (s!.confirmed as T) : proposed;
    judgments.push({ id, label, proposed, value, options, confirmed: isConfirmed });
    if (!isConfirmed) caveats.push(`Proposed, not confirmed: ${describe(value)}.`);
    return value;
  }

  // ---- Treatment: firm rules, then per-deal overrides --------------------
  const firm: TreatmentRules = { ...DEFAULT_TREATMENT_RULES, ...rules };
  const treatment: TreatmentRules = { ...firm };
  const overrides = financials.treatmentOverrides || {};
  (Object.keys(overrides) as TreatmentRow[]).forEach((row) => {
    const o = overrides[row];
    if (!o) return;
    if (!o.reason || !String(o.reason).trim()) {
      errors.push(`The ${row} override needs a reason.`);
      return;
    }
    (treatment as any)[row] = o.rule;
  });

  // ---- Fiscal year --------------------------------------------------------
  if (financials.fiscalYearEnd) {
    judge('fiscalYear', 'Fiscal year and column', financials.fiscalYearEnd, [financials.fiscalYearEnd],
      (v) => `fiscal year ended ${v} used`);
  } else {
    errors.push('Fiscal year end is missing. Needed to know which column the figures come from.');
  }

  // ---- Which items exist (judgment, proposed from balance sheet lines) ----
  const positive = (k: LineItemKey) => (line(k) ?? 0) > 0;
  const floorplanPresent = judge('floorplanPresent', 'Floorplan financing present',
    positive('floorplanPayable') || positive('floorplanInterest'), [true, false],
    (v) => (v ? 'borrower has floorplan financing' : 'borrower has no floorplan financing'));
  const fleetPresent = judge('captiveFleetPresent', 'Captive fleet debt present',
    positive('vehicleDebt') || positive('vehicleDepreciation') || positive('vehicleInterest'), [true, false],
    (v) => (v ? 'borrower has captive fleet debt' : 'borrower has no captive fleet debt'));
  const financeLeasesPresent = judge('financeLeasesPresent', 'Finance leases present',
    positive('financeLeaseLiabilities'), [true, false],
    (v) => (v ? 'borrower has finance leases' : 'borrower has no finance leases'));

  // A treatment applies only to an item the borrower has. Each applied row is
  // a judgment: the firm default is the proposal, an override is the answer.
  const treatmentJudgment = (row: TreatmentRow, label: string, options: string[]) => {
    const o = overrides[row];
    if (o && o.reason && String(o.reason).trim()) {
      judgments.push({ id: `treatment.${row}`, label, proposed: firm[row], value: o.rule, options, confirmed: true });
      return;
    }
    judge(`treatment.${row}`, label, firm[row] as string, options, (v) => `${label.toLowerCase()} treated as "${v}", the firm default`);
  };
  if (floorplanPresent) treatmentJudgment('floorplan', 'Floorplan treatment', ['out', 'in']);
  if (fleetPresent) treatmentJudgment('captiveFleet', 'Captive fleet treatment', ['corporate', 'consolidated']);
  if (financeLeasesPresent) treatmentJudgment('financeLeases', 'Finance lease treatment', ['in', 'out']);
  if (positive('rentExpense') || treatment.operatingLeases === 'in') {
    treatmentJudgment('operatingLeases', 'Operating lease treatment', ['out', 'in']);
  }

  const requireLine = (k: LineItemKey, why: string) => {
    if (!has(k)) errors.push(`${LINE_ITEM_LABELS[k]} is missing. Needed for ${why}.`);
  };

  // ---- Revenue ------------------------------------------------------------
  requireLine('revenue', 'revenue and margin');
  const revenueDerivation: Derivation = has('revenue')
    ? { value: line('revenue'), label: 'Revenue', formula: LINE_ITEM_LABELS.revenue, terms: [term('+', 'revenue')], notes: [] }
    : { value: null, label: 'Revenue', formula: LINE_ITEM_LABELS.revenue, terms: [], notes: [] };

  // ---- EBITDA start ----------------------------------------------------------
  // Start: operating income + D&A. Without an operating income line (some
  // companies report none), pretax income + interest expense gets there.
  const canOperating = has('operatingIncome');
  const canPretax = has('pretaxIncome') && has('interestExpense');
  const start = (canOperating || canPretax)
    ? judge<'operatingIncome' | 'pretaxIncome'>('ebitdaStart', 'Built EBITDA starts from',
      canOperating ? 'operatingIncome' : 'pretaxIncome', ['operatingIncome', 'pretaxIncome'],
      (v) => (v === 'operatingIncome' ? 'built EBITDA starts from operating income'
        : 'built EBITDA starts from pretax income + interest expense (no operating income line)'))
    : 'operatingIncome';

  // ---- Placement judgments -------------------------------------------------
  // From pretax income, "below operating income" means inside the interest
  // expense added back. The math is the same, the question is worded to match.
  const placementLabel = (v: Placement) => (v === 'belowOperatingIncome'
    ? (start === 'pretaxIncome' ? 'inside interest expense' : 'below operating income')
    : 'inside operating expenses');
  const floorplanPlacement = floorplanPresent
    ? judge<Placement>('floorplanInterestPlacement', 'Where floorplan interest is reported',
      'belowOperatingIncome', ['belowOperatingIncome', 'operatingExpenses'],
      (v) => `floorplan interest reported ${placementLabel(v)}`)
    : null;
  const floorplanInPaid = floorplanPresent
    ? judge('floorplanInterestInInterestPaid', 'Floorplan interest included in cash interest paid',
      true, [true, false], (v) => `floorplan interest ${v ? 'is' : 'is not'} inside cash interest paid`)
    : false;
  const vehiclePlacement = fleetPresent
    ? judge<Placement>('vehicleInterestPlacement', 'Where vehicle interest is reported',
      'belowOperatingIncome', ['belowOperatingIncome', 'operatingExpenses'],
      (v) => `vehicle interest reported ${placementLabel(v)}`)
    : null;
  const vehicleInPaid = fleetPresent
    ? judge('vehicleInterestInInterestPaid', 'Vehicle interest included in cash interest paid',
      true, [true, false], (v) => `vehicle interest ${v ? 'is' : 'is not'} inside cash interest paid`)
    : false;

  // ---- EBITDA, built --------------------------------------------------------
  const built = buildEbitda();

  function buildEbitda(): { derivation: Derivation; missing: string[] } {
    const terms: Term[] = [];
    const notes: string[] = [];
    const missing: string[] = [];
    const need = (k: LineItemKey, why: string) => {
      if (!has(k)) missing.push(`${LINE_ITEM_LABELS[k]} is missing. Needed for ${why}.`);
      return has(k);
    };

    if (start === 'operatingIncome') {
      if (need('operatingIncome', 'built EBITDA')) terms.push(term('+', 'operatingIncome'));
    } else {
      if (need('pretaxIncome', 'built EBITDA')) terms.push(term('+', 'pretaxIncome'));
      if (need('interestExpense', 'built EBITDA')) terms.push(term('+', 'interestExpense'));
      // Pretax income is after every interest charge, so anything below
      // operating income sits inside the interest expense just added back.
      notes.push('No operating income line. Pretax income + interest expense used in its place. This keeps other non-operating income and expense (gains, FX, investment income) in EBITDA, and if interest expense is reported net, interest income too.');
    }
    if (need('depreciationAmortization', 'built EBITDA')) terms.push(term('+', 'depreciationAmortization'));

    // Floorplan. Out: the interest is an operating cost of a dealer, so it is
    // deducted. In: it is financing, so it is added back.
    if (floorplanPresent && need('floorplanInterest', 'floorplan treatment in EBITDA')) {
      if (treatment.floorplan === 'out' && floorplanPlacement === 'belowOperatingIncome') {
        terms.push(term('-', 'floorplanInterest'));
      } else if (treatment.floorplan === 'in' && floorplanPlacement === 'operatingExpenses') {
        terms.push(term('+', 'floorplanInterest'));
      } else {
        notes.push(treatment.floorplan === 'out'
          ? 'Floorplan interest already deducted inside operating expenses.'
          : 'Floorplan interest already excluded, reported below operating income.');
      }
    }

    // Captive fleet. Corporate: EBITDA is after vehicle depreciation (inside
    // cash-flow D&A) and vehicle interest. Consolidated: before both.
    if (fleetPresent) {
      if (treatment.captiveFleet === 'corporate') {
        if (need('vehicleDepreciation', 'corporate-level EBITDA')) terms.push(term('-', 'vehicleDepreciation'));
        if (need('vehicleInterest', 'corporate-level EBITDA')) {
          if (vehiclePlacement === 'belowOperatingIncome') terms.push(term('-', 'vehicleInterest'));
          else notes.push('Vehicle interest already deducted inside operating expenses.');
        }
      } else if (vehiclePlacement === 'operatingExpenses') {
        if (need('vehicleInterest', 'consolidated EBITDA')) terms.push(term('+', 'vehicleInterest'));
      }
    }

    // Finance leases. In: amortization stays in D&A, no adjustment. Out: the
    // lease is treated like rent, so EBITDA is after the whole lease cost.
    // Lease interest sits below operating income (or inside the interest
    // expense added back), so it comes out under either start.
    if (financeLeasesPresent && treatment.financeLeases === 'out') {
      if (need('financeLeaseAmortization', 'EBITDA with finance leases out')) terms.push(term('-', 'financeLeaseAmortization'));
      if (need('financeLeaseInterest', 'EBITDA with finance leases out')) terms.push(term('-', 'financeLeaseInterest'));
    }

    // Operating leases in: rent is financing, added back (EBITDAR).
    if (treatment.operatingLeases === 'in' && need('rentExpense', 'EBITDA with operating leases in')) {
      terms.push(term('+', 'rentExpense'));
    }

    const value = missing.length ? null : sum(terms);
    return {
      derivation: { value, label: 'EBITDA, built from statements', formula: formulaOf(terms), terms, notes },
      missing,
    };
  }

  // ---- EBITDA source --------------------------------------------------------
  const adjusted = financials.adjustedEbitda;
  const stated = financials.statedEbitda;
  const hasAdjusted = num(adjusted?.value) !== null;
  const hasStated = num(stated?.value) !== null;
  const builtOk = built.derivation.value !== null;
  const sourceOptions: EbitdaSource[] = ['built', 'adjusted', 'stated'].filter((s) =>
    (s === 'built' && builtOk) || (s === 'adjusted' && hasAdjusted) || (s === 'stated' && hasStated)) as EbitdaSource[];
  const proposedSource: EbitdaSource = builtOk ? 'built' : hasAdjusted ? 'adjusted' : hasStated ? 'stated' : 'built';
  const storedSource = financials.ebitdaSource;
  let ebitdaSource: EbitdaSource;
  if (storedSource && sourceOptions.includes(storedSource)) {
    ebitdaSource = storedSource;
    judgments.push({ id: 'ebitdaSource', label: 'Which EBITDA scores', proposed: proposedSource, value: storedSource, options: sourceOptions, confirmed: true });
  } else {
    ebitdaSource = judge('ebitdaSource', 'Which EBITDA scores', proposedSource,
      sourceOptions.length ? sourceOptions : ['built'], (v) => `${v} EBITDA scores`);
  }

  // A company figure follows the company's definition. For each treatment
  // row that applies, the analyst says whether the figure is before or after
  // that item. Where it differs from this deal's treatment, Tranche moves it
  // onto the treatment basis, so EBITDA pairs with debt and debt service
  // whichever source scores.
  type BasisRow = { row: TreatmentRow; item: string; matches: boolean; adj: Term[]; missing: string[] };
  function companyBasis(fig: 'adjusted' | 'stated'): BasisRow[] {
    const rows: BasisRow[] = [];
    const add = (row: TreatmentRow, item: string, wantAfter: boolean, keys: LineItemKey[]) => {
      const after = judge(`companyBasis.${fig}.${row}`, `${fig === 'adjusted' ? 'Adjusted' : 'Stated'} EBITDA is before or after ${item}`,
        wantAfter, [true, false], (v) => `company ${fig} EBITDA is ${v ? 'after' : 'before'} ${item}`);
      const matches = after === wantAfter;
      const missing = matches ? [] : keys.filter((k) => !has(k)).map((k) => `${LINE_ITEM_LABELS[k]} is missing. Needed to put company EBITDA on this deal's treatment.`);
      // Company before the item, treatment after: deduct it. And the reverse.
      const sign: '+' | '-' = wantAfter ? '-' : '+';
      const adj = matches || missing.length ? [] : keys.map((k) => ({ ...term(sign, k), label: `${LINE_ITEM_LABELS[k]} (treatment)` }));
      rows.push({ row, item, matches, adj, missing });
    };
    if (floorplanPresent) add('floorplan', 'floorplan interest', treatment.floorplan === 'out', ['floorplanInterest']);
    if (fleetPresent) add('captiveFleet', 'vehicle depreciation and interest', treatment.captiveFleet === 'corporate', ['vehicleDepreciation', 'vehicleInterest']);
    if (financeLeasesPresent) add('financeLeases', 'finance lease cost', treatment.financeLeases === 'out', ['financeLeaseAmortization', 'financeLeaseInterest']);
    if (positive('rentExpense') || treatment.operatingLeases === 'in') add('operatingLeases', 'rent', treatment.operatingLeases === 'out', ['rentExpense']);
    return rows;
  }
  const basis: Partial<Record<'adjusted' | 'stated', BasisRow[]>> = {};
  if (hasAdjusted) basis.adjusted = companyBasis('adjusted');
  if (hasStated) basis.stated = companyBasis('stated');
  const onTreatmentBasis = (d: Derivation, rows: BasisRow[]): Derivation => {
    rows.forEach((r) => errors.push(...r.missing));
    const blocked = rows.some((r) => r.missing.length);
    const adj = rows.flatMap((r) => r.adj);
    if (!adj.length && !blocked) return d;
    const terms = [...d.terms, ...adj];
    return { ...d, value: blocked ? null : sum(terms), terms, formula: formulaOf(terms), notes: [...d.notes, 'Moved onto this deal\'s treatment basis.'] };
  };

  let ebitdaDerivation: Derivation;
  if (ebitdaSource === 'built') {
    ebitdaDerivation = built.derivation;
    errors.push(...built.missing);
  } else if (ebitdaSource === 'adjusted') {
    ebitdaDerivation = onTreatmentBasis(adjustedDerivation(), basis.adjusted || []);
  } else {
    const v = num(stated?.value);
    ebitdaDerivation = {
      value: v,
      label: 'EBITDA, stated, not built',
      formula: stated?.label ? `${stated.label}, as stated` : 'EBITDA, as stated',
      terms: v === null ? [] : [{ sign: '+', label: stated?.label || 'EBITDA, as stated', value: v, source: stated?.source }],
      notes: [],
    };
    ebitdaDerivation = onTreatmentBasis(ebitdaDerivation, basis.stated || []);
    caveats.push('EBITDA is stated, not built from statements. The definition is the company\'s.');
  }
  if (ebitdaSource !== 'built' && built.missing.length) {
    caveats.push(`Built EBITDA not possible: ${built.missing.map((m) => m.split('.')[0]).join(', ')}.`);
  }

  function adjustedDerivation(): Derivation {
    const total = num(adjusted?.value) as number;
    const addBacks = adjusted?.addBacks || [];
    const accepted = addBacks.filter((a) => a.decision === 'accepted');
    const rejected = addBacks.filter((a) => a.decision === 'rejected');
    const undecided = addBacks.filter((a) => a.decision !== 'accepted' && a.decision !== 'rejected');
    // Excluding an unreviewed item is conservative only for an add-back. An
    // unreviewed deduction (a gain the company took out) stays in.
    const undecidedExcluded = undecided.filter((a) => a.amount > 0);
    addBacks.forEach((a, i) => {
      judgments.push({
        id: `addBack.${i}`, label: `Add-back: ${a.label}`, proposed: null, value: a.decision ?? null,
        options: ['accepted', 'rejected'], confirmed: a.decision === 'accepted' || a.decision === 'rejected',
      });
    });
    // The company's total already includes every listed add-back. What
    // scores is that total less every add-back not accepted.
    const terms: Term[] = [{ sign: '+', label: adjusted?.label || 'Adjusted EBITDA, company-stated', value: total, source: adjusted?.source }];
    [...rejected, ...undecidedExcluded].forEach((a) => terms.push({ sign: '-', label: `${a.label} (${a.decision === 'rejected' ? 'rejected' : 'not reviewed'})`, value: a.amount, source: a.source }));
    if (undecidedExcluded.length) {
      caveats.push(`${undecidedExcluded.length} add-back${undecidedExcluded.length === 1 ? '' : 's'} not reviewed, excluded from EBITDA.`);
    }
    if (undecided.length > undecidedExcluded.length) {
      const n = undecided.length - undecidedExcluded.length;
      caveats.push(`${n} deduction${n === 1 ? '' : 's'} in the bridge not reviewed, kept in EBITDA.`);
    }
    return {
      value: sum(terms),
      label: `Adjusted EBITDA, company-stated, ${accepted.length} of ${addBacks.length} add-backs accepted`,
      formula: formulaOf(terms),
      terms,
      notes: [],
    };
  }

  // ---- Built versus company figures -------------------------------------------
  const comparisons: EbitdaComparison[] = [];
  if (builtOk) {
    const b = built.derivation.value as number;
    const compare = (against: 'adjusted' | 'stated', company: number, explainedByAddBacks: number, companyLabel: string) => {
      // Where the company's basis differs from this deal's treatment, that
      // part of the gap is the firm's policy, not the company's bridge.
      // Built = company + treatment adjustment - add-backs, so the treatment
      // explains minus the adjustment.
      const rows = basis[against] || [];
      const explainedByTreatment = rows.some((r) => r.missing.length) ? 0 : -sum(rows.flatMap((r) => r.adj));
      const explained = explainedByAddBacks + explainedByTreatment;
      const gap = company - b;
      const unexplained = gap - explained;
      const unexplainedPct = b === 0 ? null : Math.abs(unexplained) / Math.abs(b);
      const overTolerance = unexplainedPct === null ? unexplained !== 0 : unexplainedPct > treatment.ebitdaGapTolerance;
      comparisons.push({ against, companyLabel, built: b, company, gap, explainedByAddBacks, explainedByTreatment, explained, unexplained, unexplainedPct, tolerance: treatment.ebitdaGapTolerance, overTolerance });
      if (overTolerance) {
        const pct = unexplainedPct === null ? '' : `, ${(unexplainedPct * 100).toFixed(1)}% of built`;
        caveats.push(`${companyLabel} is ${usd(company)} against built ${usd(b)}. Unexplained ${usd(unexplained)}${pct}. Caveat above ${(treatment.ebitdaGapTolerance * 100).toFixed(0)}%, your policy.`);
      }
    };
    if (hasAdjusted) {
      const listed = (adjusted?.addBacks || []).reduce((s, a) => s + (num(a.amount) ?? 0), 0);
      compare('adjusted', num(adjusted?.value) as number, listed, adjusted?.label || 'Company Adjusted EBITDA');
    }
    if (hasStated) compare('stated', num(stated?.value) as number, 0, stated?.label || 'Company EBITDA');
  }
  if (ebitdaDerivation.value !== null && ebitdaDerivation.value <= 0) {
    caveats.push(`EBITDA is ${usd(ebitdaDerivation.value)}. Leverage and coverage cannot be read as normal.`);
  }

  // ---- Debt ---------------------------------------------------------------------
  const debtTerms: Term[] = [];
  const debtNotes: string[] = [];
  let debtComplete = true;
  const debtAdd = (k: LineItemKey, why: string) => {
    if (has(k)) debtTerms.push(term('+', k));
    else {
      errors.push(`${LINE_ITEM_LABELS[k]} is missing. Needed for ${why}.`);
      debtComplete = false;
    }
  };
  debtAdd('revolver', 'total debt (enter 0 if the borrower has none)');
  debtAdd('termLoansAndNotes', 'total debt (enter 0 if the borrower has none)');
  if (financeLeasesPresent) {
    if (treatment.financeLeases === 'in') debtAdd('financeLeaseLiabilities', 'total debt with finance leases in');
    else debtNotes.push('Finance lease liabilities excluded, finance leases treated as rent.');
  }
  if (treatment.operatingLeases === 'in') debtAdd('operatingLeaseLiabilities', 'total debt with operating leases in');
  if (floorplanPresent) {
    if (treatment.floorplan === 'in') debtAdd('floorplanPayable', 'total debt with floorplan in');
    else debtNotes.push('Floorplan payable excluded, floorplan out.');
  }
  if (fleetPresent) {
    if (treatment.captiveFleet === 'consolidated') debtAdd('vehicleDebt', 'total debt with captive fleet consolidated');
    else debtNotes.push('Vehicle debt excluded, analyzed at the corporate level.');
  }
  const debtDerivation: Derivation = {
    value: debtComplete ? sum(debtTerms) : null, label: 'Total debt', formula: formulaOf(debtTerms), terms: debtTerms, notes: debtNotes,
  };

  // ---- Debt service -----------------------------------------------------------------
  // Cash interest paid + principal due within 12 months, on the same debt
  // counted above. Interest on excluded debt comes out of interest paid.
  const dsTerms: Term[] = [];
  const dsNotes: string[] = [];
  let dsComplete = true;
  const dsNeed = (k: LineItemKey, why: string) => {
    if (has(k)) return true;
    errors.push(`${LINE_ITEM_LABELS[k]} is missing. Needed for ${why}.`);
    dsComplete = false;
    return false;
  };
  if (dsNeed('interestPaid', 'debt service')) dsTerms.push(term('+', 'interestPaid'));
  if (dsNeed('currentMaturities', 'debt service')) dsTerms.push(term('+', 'currentMaturities'));

  // Balance sheets often fold lease, fleet or floorplan principal into the
  // current maturities line. The analyst says what the line holds, and
  // Tranche adds or removes principal so it matches the debt counted above.
  const cmIncludes = (what: string, id: string) => judge(`currentMaturitiesInclude.${id}`,
    `Current maturities include ${what}`, false, [false, true],
    (v) => `current maturities ${v ? 'include' : 'exclude'} ${what}`);
  const cmLeases = financeLeasesPresent ? cmIncludes('finance leases', 'financeLeases') : false;
  const cmVehicle = fleetPresent ? cmIncludes('vehicle debt', 'vehicleDebt') : false;
  const cmFloorplan = floorplanPresent ? cmIncludes('floorplan', 'floorplan') : false;

  if (floorplanPresent) {
    const why = 'debt service with floorplan';
    // Floorplan is repaid as units sell, never scheduled principal, under either treatment.
    if (cmFloorplan && dsNeed('floorplanPayable', 'debt service, to take floorplan out of current maturities')) dsTerms.push(term('-', 'floorplanPayable'));
    if (treatment.floorplan === 'out' && floorplanInPaid && dsNeed('floorplanInterest', why)) dsTerms.push(term('-', 'floorplanInterest'));
    if (treatment.floorplan === 'in' && !floorplanInPaid && dsNeed('floorplanInterest', why)) dsTerms.push(term('+', 'floorplanInterest'));
    if (treatment.floorplan === 'in') dsNotes.push('Floorplan counts for interest only. It is repaid as units sell, not on a schedule.');
  }
  if (fleetPresent) {
    if (treatment.captiveFleet === 'corporate') {
      if (vehicleInPaid && dsNeed('vehicleInterest', 'debt service with captive fleet at the corporate level')) dsTerms.push(term('-', 'vehicleInterest'));
      if (cmVehicle && dsNeed('currentVehicleDebtMaturities', 'debt service, to take vehicle debt out of current maturities')) dsTerms.push(term('-', 'currentVehicleDebtMaturities'));
    } else {
      if (!vehicleInPaid && dsNeed('vehicleInterest', 'debt service with captive fleet consolidated')) dsTerms.push(term('+', 'vehicleInterest'));
      if (!cmVehicle && dsNeed('currentVehicleDebtMaturities', 'debt service with captive fleet consolidated')) dsTerms.push(term('+', 'currentVehicleDebtMaturities'));
    }
  }
  if (financeLeasesPresent) {
    if (treatment.financeLeases === 'in') {
      if (cmLeases) dsNotes.push('Lease principal already inside current maturities.');
      else if (has('currentFinanceLeaseLiabilities')) dsTerms.push(term('+', 'currentFinanceLeaseLiabilities'));
      else caveats.push('Current finance lease liabilities not provided. Debt service leaves out lease principal and is understated.');
    } else {
      // ASC 842 puts finance lease interest inside interest paid.
      if (dsNeed('financeLeaseInterest', 'debt service with finance leases out')) dsTerms.push(term('-', 'financeLeaseInterest'));
      if (cmLeases && dsNeed('currentFinanceLeaseLiabilities', 'debt service, to take lease principal out of current maturities')) {
        dsTerms.push(term('-', 'currentFinanceLeaseLiabilities'));
      }
    }
  }
  if (treatment.operatingLeases === 'in' && dsNeed('rentExpense', 'debt service with operating leases in')) {
    dsTerms.push(term('+', 'rentExpense'));
  }

  const revolverMaturing = judge('revolverMaturing', 'Revolver matures within 12 months', false, [false, true],
    (v) => (v ? 'revolver balance matures within 12 months' : 'revolver does not mature within 12 months'));
  if (revolverMaturing && has('revolver')) dsTerms.push(term('+', 'revolver'));
  else dsNotes.push('Revolver balance counts for interest, not as principal due.');

  const dsDerivation: Derivation = {
    value: dsComplete ? sum(dsTerms) : null, label: 'Annual debt service', formula: formulaOf(dsTerms), terms: dsTerms, notes: dsNotes,
  };

  // ---- Maintenance capex (always an estimate unless borrower-stated) ------------------
  const capexOptions: Array<'stated' | 'depreciation' | 'totalCapex'> = [];
  if (has('statedMaintenanceCapex')) capexOptions.push('stated');
  if (has('depreciationAmortization')) capexOptions.push('depreciation');
  if (has('capitalExpenditures')) capexOptions.push('totalCapex');
  let capexDerivation: Derivation = { value: null, label: 'Maintenance capex', formula: '', terms: [], notes: [] };
  if (capexOptions.length) {
    const method = judge('maintenanceCapex', 'Maintenance capex', capexOptions[0], capexOptions, (v) =>
      v === 'stated' ? 'borrower-stated maintenance capex used'
        : v === 'depreciation' ? 'depreciation used as maintenance capex'
          : 'total capex used as maintenance capex');
    capexDerivation = capexFrom(method);
  } else {
    caveats.push('Maintenance capex not provided. No statement figure to estimate it from.');
  }

  function capexFrom(method: 'stated' | 'depreciation' | 'totalCapex'): Derivation {
    if (method === 'stated') {
      return { value: line('statedMaintenanceCapex'), label: 'Maintenance capex, borrower-stated', formula: LINE_ITEM_LABELS.statedMaintenanceCapex, terms: [term('+', 'statedMaintenanceCapex')], notes: [] };
    }
    if (method === 'totalCapex') {
      caveats.push('ESTIMATE: total capex used as maintenance capex. An upper bound, includes growth capex.');
      return { value: line('capitalExpenditures'), label: 'Maintenance capex, estimate (total capex, upper bound)', formula: LINE_ITEM_LABELS.capitalExpenditures, terms: [term('+', 'capitalExpenditures')], notes: [], estimate: true };
    }
    // Depreciation as proxy: D&A less amortization, and less the depreciation
    // of assets that are debt-funded or already deducted in EBITDA. Leased
    // and fleet assets are paid for through principal in debt service (or
    // rent), so counting them again as capex charges them twice. Credit
    // agreements do the same with "unfinanced capex".
    const terms: Term[] = [term('+', 'depreciationAmortization')];
    const notes: string[] = [];
    if (has('amortizationOfIntangibles')) terms.push(term('-', 'amortizationOfIntangibles'));
    else {
      notes.push('Amortization of intangibles not provided. Proxy uses full D&A and overstates capex.');
      caveats.push('Amortization of intangibles not provided. Maintenance capex proxy uses full D&A and overstates capex.');
    }
    const exclude = (present: boolean, k: LineItemKey, what: string) => {
      if (!present) return;
      if (has(k)) terms.push(term('-', k));
      else {
        notes.push(`${LINE_ITEM_LABELS[k]} not provided. Proxy includes ${what} and overstates capex.`);
        caveats.push(`${LINE_ITEM_LABELS[k]} not provided. Maintenance capex proxy includes ${what} and overstates capex.`);
      }
    };
    exclude(fleetPresent, 'vehicleDepreciation', 'fleet depreciation');
    exclude(financeLeasesPresent, 'financeLeaseAmortization', 'finance lease amortization');
    caveats.push('ESTIMATE: depreciation used as maintenance capex.');
    return { value: sum(terms), label: 'Maintenance capex, estimate (depreciation)', formula: formulaOf(terms), terms, notes, estimate: true };
  }

  // ---- Cash taxes, working capital, rent --------------------------------------------
  let taxesDerivation: Derivation = { value: null, label: 'Cash taxes', formula: LINE_ITEM_LABELS.incomeTaxesPaid, terms: [], notes: [] };
  if (has('incomeTaxesPaid')) {
    const paid = line('incomeTaxesPaid') as number;
    // A net refund is not repeatable cash for debt service, so it counts as 0.
    taxesDerivation = { ...taxesDerivation, value: Math.max(0, paid), terms: [term('+', 'incomeTaxesPaid')],
      notes: paid < 0 ? [`Net tax refund ${usd(-paid)}. Counted as 0, a refund is not repeatable.`] : [] };
  }
  if (!has('incomeTaxesPaid')) caveats.push('Income taxes paid not provided. Cash-flow DSCR and FCCR not available.');

  let wcDerivation: Derivation = { value: null, label: 'Increase in working capital', formula: LINE_ITEM_LABELS.workingCapitalChange, terms: [], notes: [] };
  if (has('workingCapitalChange')) {
    const change = line('workingCapitalChange') as number;
    // The cash-flow statement reports a working capital build as a negative
    // (cash used). Only a build counts. A release is not repeatable cash for
    // debt service, so it counts as 0.
    if (change < 0) {
      wcDerivation = { value: -change, label: 'Increase in working capital', formula: `-(${LINE_ITEM_LABELS.workingCapitalChange})`, terms: [term('-', 'workingCapitalChange')], notes: [] };
    } else {
      wcDerivation = { value: 0, label: 'Increase in working capital', formula: LINE_ITEM_LABELS.workingCapitalChange, terms: [term('+', 'workingCapitalChange')], notes: [`Working capital released ${usd(change)}. Counted as 0, a release is not repeatable.`] };
    }
  } else {
    caveats.push('Change in working capital not provided. Cash-flow DSCR not available.');
  }

  let rentDerivation: Derivation;
  if (treatment.operatingLeases === 'in') {
    rentDerivation = { value: 0, label: 'Rent', formula: '', terms: [], notes: ['Rent counted in EBITDA and debt service, operating leases in.'] };
  } else if (has('rentExpense')) {
    rentDerivation = { value: line('rentExpense'), label: 'Rent', formula: LINE_ITEM_LABELS.rentExpense, terms: [term('+', 'rentExpense')], notes: [] };
  } else {
    rentDerivation = { value: null, label: 'Rent', formula: LINE_ITEM_LABELS.rentExpense, terms: [], notes: [] };
    caveats.push('Rent not provided. FCCR not available.');
  }
  // Finance leases out are rent in substance, so their cost joins rent.
  if (financeLeasesPresent && treatment.financeLeases === 'out' && rentDerivation.value !== null
    && has('financeLeaseAmortization') && has('financeLeaseInterest')) {
    const terms = [...rentDerivation.terms, term('+', 'financeLeaseAmortization'), term('+', 'financeLeaseInterest')];
    rentDerivation = { ...rentDerivation, value: sum(terms), formula: formulaOf(terms), terms, notes: [...rentDerivation.notes, 'Finance lease cost included, finance leases treated as rent.'] };
  }

  const derivations: Record<BuiltField, Derivation> = {
    annualRevenue: revenueDerivation,
    ebitda: ebitdaDerivation,
    totalExistingDebt: debtDerivation,
    actualAnnualDebtService: dsDerivation,
    maintenanceCapex: capexDerivation,
    cashTaxes: taxesDerivation,
    workingCapitalIncrease: wcDerivation,
    leasePayments: rentDerivation,
  };
  const inputs = Object.fromEntries(
    (Object.keys(derivations) as BuiltField[]).map((k) => [k, derivations[k].value]),
  ) as Record<BuiltField, number | null>;

  return {
    inputs, derivations, judgments, caveats: dedupe(caveats), errors: dedupe(errors), treatment, ebitdaSource, comparisons,
  };
}

function sum(terms: Term[]): number {
  return terms.reduce((s, t) => s + (t.sign === '-' ? -t.value : t.value), 0);
}

function formulaOf(terms: Term[]): string {
  return terms.map((t, i) => (i === 0 && t.sign === '+' ? t.label : `${t.sign} ${t.label}`)).join(' ');
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

/** True when every judgment has been confirmed. Save to Pipeline requires it. */
export function allJudgmentsConfirmed(result: BuildResult): boolean {
  return result.judgments.every((j) => j.confirmed);
}

const TREATMENT_OPTIONS: { [K in TreatmentRow]: TreatmentRules[K][] } = {
  financeLeases: ['in', 'out'],
  operatingLeases: ['out', 'in'],
  floorplan: ['out', 'in'],
  captiveFleet: ['corporate', 'consolidated'],
};

export const TREATMENT_ROWS = Object.keys(TREATMENT_OPTIONS) as TreatmentRow[];

export function treatmentOptions<R extends TreatmentRow>(row: R): TreatmentRules[R][] {
  return TREATMENT_OPTIONS[row];
}

/**
 * The firm's treatment rules as stored in org_settings.treatmentRules,
 * merged over the defaults. Anything unrecognized falls back to the default,
 * so a malformed saved value can never reach scoring. Used on save and on
 * every read, client and server.
 */
export function validateTreatmentRules(raw: unknown): TreatmentRules {
  const out: TreatmentRules = { ...DEFAULT_TREATMENT_RULES };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  TREATMENT_ROWS.forEach((row) => {
    if ((TREATMENT_OPTIONS[row] as unknown[]).includes(r[row])) (out as any)[row] = r[row];
  });
  const tol = num(r.ebitdaGapTolerance);
  if (tol !== null && tol >= 0 && tol <= 1) out.ebitdaGapTolerance = tol;
  return out;
}

/**
 * Set or clear a per-deal treatment override. An override needs a reason;
 * the deal save writes it to the audit log. Passing the firm rule clears
 * the override, since there is nothing left to explain.
 */
export function setTreatmentOverride<R extends TreatmentRow>(
  financials: BorrowerFinancials,
  row: R,
  rule: TreatmentRules[R],
  reason: string,
  firmRules: TreatmentRules,
  by?: string,
  at: string = new Date().toISOString(),
): { financials: BorrowerFinancials; error: string | null } {
  if (!(TREATMENT_OPTIONS[row] as unknown[]).includes(rule)) {
    return { financials, error: `"${String(rule)}" is not a ${row} treatment.` };
  }
  const overrides = { ...(financials.treatmentOverrides || {}) };
  if (rule === firmRules[row]) {
    delete overrides[row];
    return { financials: { ...financials, treatmentOverrides: overrides }, error: null };
  }
  if (!reason || !reason.trim()) return { financials, error: 'An override needs a reason.' };
  (overrides as any)[row] = { rule, reason: reason.trim(), by, at };
  return { financials: { ...financials, treatmentOverrides: overrides }, error: null };
}
