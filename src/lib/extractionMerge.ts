// ============================================================
// Merge field extractions from several documents into one input set.
//
// The design rule for the whole ingest path: the model extracts, this
// file merges. There is no second model call to reconcile documents.
// Reconciliation is a precedence table and a numeric tolerance, so it is
// deterministic, inspectable, and unit-testable, and the claim that
// nothing in a deal is model-invented survives the merge layer.
//
// Precedence is per field group, not one global ranking. A dealer quote
// is authoritative about equipment and worthless about EBITDA; reviewed
// financials are the reverse. A single ordering would get one of them
// wrong.
//
// When two documents disagree, the higher-precedence value wins AND the
// disagreement is recorded. Silently picking is the failure this file
// exists to prevent: an analyst who never learns the broker email said
// something different cannot exercise judgment about which is right.
// ============================================================

import type { AssetClass } from '../types';

// ---- Document classes ----
// Assigned by the extraction model as part of its forced tool call, so
// classification costs no extra request. Keep in sync with the
// _documentType enum in server-lib/extract.js.

export type DocumentType =
  | 'financial_statement'
  | 'tax_return'
  | 'credit_application'
  | 'deal_sheet'
  | 'equipment_quote'
  | 'appraisal'
  | 'ar_aging'
  | 'borrowing_base_certificate'
  | 'other';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  financial_statement: 'Financial statements',
  tax_return: 'Tax return',
  credit_application: 'Credit application',
  deal_sheet: 'Deal sheet',
  equipment_quote: 'Equipment quote',
  appraisal: 'Appraisal',
  ar_aging: 'AR aging report',
  borrowing_base_certificate: 'Borrowing base certificate',
  other: 'Other document',
};

// ---- Inputs and outputs ----

/** One document's extraction result, as returned by /api/parse-deal. */
export interface DocumentExtraction {
  fileName: string;
  documentType: DocumentType;
  inputs: Record<string, unknown>;
  found: string[];
  warnings: string[];
  notes: string | null;
  /** Set when this document failed; inputs will be empty. */
  error?: string | null;
}

export interface FieldSource {
  value: unknown;
  fileName: string;
  documentType: DocumentType;
}

export interface FieldConflict {
  field: string;
  /** The value the merge used, and where it came from. */
  chosen: FieldSource;
  /** Every value that lost, with its source. Never empty. */
  alternatives: FieldSource[];
}

export interface MergeResult {
  inputs: Record<string, unknown>;
  /** Where each merged value came from. Keyed by field. */
  fieldSources: Record<string, FieldSource>;
  conflicts: FieldConflict[];
  /** Spec fields no document supplied. */
  missing: string[];
  /** Documents that failed to parse, so the UI can say which. */
  failed: { fileName: string; error: string }[];
}

// ---- Precedence ----
//
// Read each row as "for this group of fields, trust these document types
// in this order". A type absent from a group's list still supplies the
// value if nothing better did; it just loses to anything listed.

type FieldGroup = 'financials' | 'identity' | 'equipment' | 'structure' | 'collateral';

const GROUP_PRECEDENCE: Record<FieldGroup, DocumentType[]> = {
  // Audited or reviewed statements beat a return, which beats what the
  // borrower wrote on an application, which beats a broker's summary.
  financials: ['financial_statement', 'tax_return', 'credit_application', 'deal_sheet', 'other'],
  // The borrower's own application is the authority on who they are.
  identity: ['credit_application', 'financial_statement', 'deal_sheet', 'tax_return', 'other'],
  // The dealer selling the equipment knows what it is and what it costs.
  equipment: ['equipment_quote', 'appraisal', 'deal_sheet', 'credit_application', 'other'],
  // How the deal is structured is what the parties negotiated, not what
  // the accountant recorded.
  structure: ['deal_sheet', 'credit_application', 'equipment_quote', 'other'],
  // Collateral schedules are prepared specifically to state collateral.
  collateral: [
    'borrowing_base_certificate',
    'ar_aging',
    'appraisal',
    'financial_statement',
    'credit_application',
    'deal_sheet',
    'other',
  ],
};

const FIELD_GROUPS: Record<string, FieldGroup> = {
  // Identity
  companyName: 'identity',
  yearsInBusiness: 'identity',
  industrySector: 'identity',
  creditRating: 'identity',

  // Financials
  annualRevenue: 'financials',
  priorYearRevenue: 'financials',
  ebitda: 'financials',
  priorYearEbitda: 'financials',
  totalExistingDebt: 'financials',
  actualAnnualDebtService: 'financials',
  maintenanceCapex: 'financials',
  cashOnHand: 'financials',
  availableLiquidity: 'financials',

  // Equipment
  equipmentType: 'equipment',
  equipmentCondition: 'equipment',
  equipmentCost: 'equipment',
  usefulLife: 'equipment',

  // Structure
  downPayment: 'structure',
  financingType: 'structure',
  loanTerm: 'structure',
  essentialUse: 'structure',

  // AR collateral
  totalAROutstanding: 'collateral',
  arUnder30: 'collateral',
  arOver30: 'collateral',
  arOver60: 'collateral',
  arOver90: 'collateral',
  topCustomerConcentration: 'collateral',
  dilutionRate: 'collateral',
  ineligiblesPct: 'collateral',
  existingABLFacility: 'collateral',

  // Inventory collateral
  totalInventory: 'collateral',
  rawMaterials: 'collateral',
  workInProgress: 'collateral',
  finishedGoods: 'collateral',
  obsoleteInventory: 'collateral',
  inventoryTurnover: 'collateral',
  averageDaysOnHand: 'collateral',
  nolvPct: 'collateral',
  perishable: 'collateral',

  // Shared across AR and inventory
  requestedAdvanceRate: 'structure',
};

/** Fields not in the table fall back to financial-statement-first ordering. */
const DEFAULT_GROUP: FieldGroup = 'financials';

export function groupForField(field: string): FieldGroup {
  return FIELD_GROUPS[field] || DEFAULT_GROUP;
}

function rankOf(documentType: DocumentType, group: FieldGroup): number {
  const order = GROUP_PRECEDENCE[group];
  const i = order.indexOf(documentType);
  // Unlisted types sort after every listed one, but still ahead of nothing.
  return i === -1 ? order.length : i;
}

// ---- Agreement ----

/**
 * Whether two extracted values are the same fact.
 *
 * Numbers get a 1% band because prose rounds: a broker writing "just over
 * 38MM" against statements showing 38,400,000 is not a disagreement worth
 * putting in front of an analyst. Anything wider is.
 */
export const NUMERIC_TOLERANCE = 0.01;

export function valuesAgree(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return true;
    const scale = Math.max(Math.abs(a), Math.abs(b));
    if (scale === 0) return true;
    return Math.abs(a - b) / scale <= NUMERIC_TOLERANCE;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return a === b;
}

// ---- Merge ----

/**
 * Merge per-document extractions into one input set.
 *
 * @param documents  one entry per uploaded document, in upload order
 * @param specFields every field the module's extraction spec defines, used
 *                   to report what no document supplied
 */
export function mergeExtractions(
  documents: DocumentExtraction[],
  specFields: string[] = [],
): MergeResult {
  const failed: { fileName: string; error: string }[] = [];
  const candidates: Record<string, FieldSource[]> = {};

  for (const doc of documents) {
    if (doc.error) {
      failed.push({ fileName: doc.fileName, error: doc.error });
      continue;
    }
    for (const [field, value] of Object.entries(doc.inputs || {})) {
      if (value === undefined || value === null || value === '') continue;
      if (!candidates[field]) candidates[field] = [];
      candidates[field].push({
        value,
        fileName: doc.fileName,
        documentType: doc.documentType,
      });
    }
  }

  const inputs: Record<string, unknown> = {};
  const fieldSources: Record<string, FieldSource> = {};
  const conflicts: FieldConflict[] = [];

  for (const [field, sources] of Object.entries(candidates)) {
    const group = groupForField(field);

    // Stable sort by precedence: equal ranks keep upload order, so two
    // financial statements resolve to the one the analyst added first
    // rather than to whichever way the sort happened to fall.
    const ranked = sources
      .map((s, i) => ({ s, rank: rankOf(s.documentType, group), i }))
      .sort((a, b) => (a.rank - b.rank) || (a.i - b.i))
      .map((x) => x.s);

    const chosen = ranked[0];
    inputs[field] = chosen.value;
    fieldSources[field] = chosen;

    const dissenting = ranked.slice(1).filter((s) => !valuesAgree(s.value, chosen.value));
    if (dissenting.length > 0) {
      conflicts.push({ field, chosen, alternatives: dissenting });
    }
  }

  const missing = specFields.filter((f) => !(f in inputs));

  return { inputs, fieldSources, conflicts, missing, failed };
}

/**
 * Apply an analyst's choice of a losing value. Returns a new MergeResult
 * with that field switched and the conflict re-pointed, so the panel can
 * keep showing what the alternative was after the switch.
 */
export function chooseAlternative(
  result: MergeResult,
  field: string,
  alternative: FieldSource,
): MergeResult {
  const conflict = result.conflicts.find((c) => c.field === field);
  if (!conflict) return result;

  const previous = conflict.chosen;
  const alternatives = conflict.alternatives
    .filter((a) => a.fileName !== alternative.fileName)
    .concat(previous);

  return {
    ...result,
    inputs: { ...result.inputs, [field]: alternative.value },
    fieldSources: { ...result.fieldSources, [field]: alternative },
    conflicts: result.conflicts.map((c) =>
      c.field === field ? { ...c, chosen: alternative, alternatives } : c,
    ),
  };
}

/**
 * The document set a deal's numbers came from, deduplicated, for the
 * memo's source-document section. Order follows first use.
 */
export function sourceDocuments(result: MergeResult): { fileName: string; documentType: DocumentType; fieldCount: number }[] {
  const byFile = new Map<string, { fileName: string; documentType: DocumentType; fieldCount: number }>();
  for (const source of Object.values(result.fieldSources)) {
    const existing = byFile.get(source.fileName);
    if (existing) {
      existing.fieldCount += 1;
    } else {
      byFile.set(source.fileName, {
        fileName: source.fileName,
        documentType: source.documentType,
        fieldCount: 1,
      });
    }
  }
  return Array.from(byFile.values());
}

// Kept for callers that want to know which module a merge was built for
// without threading it separately.
export type { AssetClass };

/**
 * Fold a new merge into the form without destroying the analyst's work.
 *
 * Three claims have to hold at once, and they pull against each other:
 *
 *   1. Starting a new deal clears the old one. Commit fae01c1 fixed real
 *      cross-deal contamination by resetting to INITIAL_INPUTS on upload;
 *      that reset must survive.
 *   2. Adding a second document adds to the first rather than replacing it.
 *   3. Anything the analyst typed or corrected outranks extraction. They
 *      looked at the document; the model only read it.
 *
 * So: start from defaults, lay the merged extraction over them, then lay
 * the analyst's own edits over that. An edit is either a field they changed
 * away from what extraction last produced, or a non-default value in a
 * field no document ever supplied.
 *
 * Passing previousMerged as null treats every non-default value as an
 * analyst edit, which is the right reading for the first upload of a
 * session where they had already started typing.
 */
export function applyMergeToForm({
  initial,
  current,
  previousMerged,
  nextMerged,
}: {
  initial: Record<string, unknown>;
  current: Record<string, unknown>;
  previousMerged: Record<string, unknown> | null;
  nextMerged: Record<string, unknown>;
}): Record<string, unknown> {
  const analystEdits: Record<string, unknown> = {};

  for (const key of Object.keys(current)) {
    const value = current[key];
    const wasExtracted = previousMerged !== null && key in previousMerged;

    if (wasExtracted) {
      // They changed a value extraction had supplied. That is a correction.
      if (!valuesAgree(value, previousMerged[key])) analystEdits[key] = value;
    } else if (!valuesAgree(value, initial[key])) {
      // No document ever supplied this and it is not the default, so they
      // typed it.
      analystEdits[key] = value;
    }
  }

  return { ...initial, ...nextMerged, ...analystEdits };
}

/**
 * The storable shape of a merge, for pipeline_deals.extraction_provenance.
 *
 * Only what the audit view and the memo need: where each field came from,
 * what disagreed, and which documents contributed. The per-document
 * extraction results are not kept, since re-parsing is not something a
 * saved deal ever does.
 */
export interface StoredProvenance {
  fieldSources: Record<string, FieldSource>;
  conflicts: FieldConflict[];
  documents: { fileName: string; documentType: DocumentType; fieldCount: number }[];
  capturedAt: string;
}

export function toStoredProvenance(result: MergeResult | null): StoredProvenance | null {
  if (!result || Object.keys(result.fieldSources).length === 0) return null;
  return {
    fieldSources: result.fieldSources,
    conflicts: result.conflicts,
    documents: sourceDocuments(result),
    capturedAt: new Date().toISOString(),
  };
}

/** Rehydrate enough of a MergeResult for the audit view and the memo. */
export function fromStoredProvenance(stored: unknown): MergeResult | null {
  if (!stored || typeof stored !== 'object') return null;
  const s = stored as Partial<StoredProvenance>;
  if (!s.fieldSources || typeof s.fieldSources !== 'object') return null;
  const inputs: Record<string, unknown> = {};
  for (const [field, source] of Object.entries(s.fieldSources)) {
    inputs[field] = source.value;
  }
  return {
    inputs,
    fieldSources: s.fieldSources,
    conflicts: Array.isArray(s.conflicts) ? s.conflicts : [],
    missing: [],
    failed: [],
  };
}
