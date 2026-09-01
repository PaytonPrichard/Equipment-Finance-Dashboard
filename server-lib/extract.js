// ============================================================
// Deal sheet extraction — schema-driven, server-side only.
//
// Sends an uploaded deal sheet (PDF, image, or plain text) to the
// Anthropic Messages API with a forced tool call whose input schema
// is built from the module's field spec. The model never scores
// anything: it extracts raw field values, the analyst reviews them
// in the form, and the existing scoring path stays authoritative.
//
// Requires ANTHROPIC_API_KEY in the environment.
// Model can be overridden with ANTHROPIC_MODEL.
// ============================================================

const {
  VALID_INDUSTRY_SECTORS,
  VALID_CREDIT_RATINGS,
  VALID_EQUIPMENT_TYPES,
  VALID_FINANCING_TYPES,
  VALID_EQUIPMENT_CONDITIONS,
} = require('./validate');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_OUTPUT_TOKENS = 2048;

const SUPPORTED_MEDIA_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
];

// ---- Field specs per module ----
// type: 'currency' | 'number' | 'integer' | 'boolean' | 'enum' | 'string'
// Descriptions double as extraction instructions, so they carry the
// domain mapping rules (e.g. how loan language maps to EFA/FMV/TRAC).

// The thirteen fields every asset class collects about the borrower.
// Shared so the three specs cannot drift apart: a wording fix to how
// EBITDA is described should not have to be made three times.
const BORROWER_FIELDS = [
  { key: 'companyName', type: 'string', description: 'Legal name of the borrower/lessee company.' },
  { key: 'annualRevenue', type: 'currency', description: 'Total annual revenue for the most recent fiscal year, in USD.' },
  { key: 'priorYearRevenue', type: 'currency', description: 'Total revenue for the prior fiscal year, in USD.' },
  { key: 'ebitda', type: 'currency', description: 'EBITDA for the most recent fiscal year, in USD. If only net income plus addbacks is shown, use the stated adjusted EBITDA.' },
  { key: 'priorYearEbitda', type: 'currency', description: 'EBITDA for the prior fiscal year, in USD.' },
  { key: 'yearsInBusiness', type: 'integer', description: 'Years the borrower has been operating. If only a founding year is given, compute years from it.' },
  { key: 'totalExistingDebt', type: 'currency', description: 'Total outstanding existing debt (loans, leases, lines), in USD. Exclude the new financing being requested.' },
  { key: 'actualAnnualDebtService', type: 'currency', description: 'Actual annual debt service on existing debt, in USD, if stated.' },
  { key: 'maintenanceCapex', type: 'currency', description: 'Annual maintenance capital expenditure, in USD, if stated.' },
  { key: 'cashOnHand', type: 'currency', description: 'Unrestricted cash and equivalents from the most recent balance sheet, in USD.' },
  { key: 'availableLiquidity', type: 'currency', description: 'Other available liquidity such as undrawn revolver capacity, in USD. Do not include cash on hand.' },
  { key: 'industrySector', type: 'enum', options: VALID_INDUSTRY_SECTORS, description: 'Borrower industry, mapped to the closest listed option. Use "Other" only if nothing fits.' },
  // Do NOT map silence to "Not Rated". "Not Rated" is a scored credit
  // opinion carrying +100bps of spread (CREDIT_SPREAD_BPS), while the form
  // default is "Adequate" at 0bps. Emitting it for a document that simply
  // never discusses credit quality made the same deal price 100bps wider
  // when uploaded than when typed in, with nothing on screen to say the
  // value was manufactured. Omit the field and let the analyst set it.
  { key: 'creditRating', type: 'enum', options: VALID_CREDIT_RATINGS, description: 'Borrower credit quality, ONLY if the document explicitly characterizes it (investment grade or equivalent = "Strong", middle market = "Adequate", below average = "Weak", explicitly stated as unrated = "Not Rated"). If the document does not discuss credit quality or ratings at all, omit this field entirely. Do not infer it from company size, profitability, or leverage.' },
];

// Percentage-of-total fields are the sharpest edge in this file.
//
// The form stores AR aging and inventory composition as percentages, but
// every real source document states dollars: an aging report shows
// "$3,240,000" in the 31-60 bucket, not "27%". A model that copies the
// dollar figure into a percent field produces a borrowing base that is
// wrong by three orders of magnitude and looks plausible on screen. This
// is the same percent-vs-dollar class that already reached production in
// AR and inventory scoring once.
//
// Two defences: this instruction, and the bucket-sum check in
// checkPercentGroups below.
const PERCENT_OF_TOTAL = (whatOfWhat) =>
  `Percentage of ${whatOfWhat}, as a number from 0 to 100. Source documents usually state DOLLAR amounts per category rather than percentages. If so, divide the category dollar amount by the stated total and multiply by 100. Never copy a dollar amount into this field.`;

const EXTRACTION_SPECS = {
  equipment_finance: {
    label: 'equipment finance',
    fields: [
      ...BORROWER_FIELDS,
      { key: 'equipmentType', type: 'enum', options: VALID_EQUIPMENT_TYPES, description: 'Type of equipment being financed, mapped to the closest listed option.' },
      { key: 'equipmentCondition', type: 'enum', options: VALID_EQUIPMENT_CONDITIONS, description: 'Whether the equipment is new or used.' },
      { key: 'equipmentCost', type: 'currency', description: 'Total purchase price / cost of the equipment being financed, in USD.' },
      { key: 'downPayment', type: 'currency', description: 'Down payment or upfront equity contribution toward the equipment, in USD.' },
      { key: 'financingType', type: 'enum', options: VALID_FINANCING_TYPES, description: 'Financing structure. Loan, equipment finance agreement, or capital/finance lease = "EFA". Fair market value or operating lease = "FMV". TRAC lease (terminal rental adjustment clause, typically titled vehicles) = "TRAC".' },
      { key: 'usefulLife', type: 'integer', description: 'Expected economic useful life of the equipment, in YEARS.' },
      { key: 'loanTerm', type: 'integer', description: 'Requested loan or lease term, in MONTHS. Convert years to months if needed (e.g. 7 years = 84).' },
      { key: 'essentialUse', type: 'boolean', description: 'Whether the equipment is essential/mission-critical to the borrower\'s core revenue operations.' },
    ],
    // Groups of percentage fields that describe one whole. Checked after
    // extraction: if they are all present and do not sum to ~100, the
    // values are kept but the analyst is told.
    percentGroups: [],
  },

  accounts_receivable: {
    label: 'accounts receivable / ABL revolver',
    fields: [
      ...BORROWER_FIELDS,
      { key: 'totalAROutstanding', type: 'currency', description: 'Total accounts receivable balance outstanding as of the most recent reporting date, in USD. Use the gross AR total before ineligibles unless only a net figure is given.' },
      { key: 'requestedAdvanceRate', type: 'number', description: 'Requested advance rate against eligible AR, as a number from 0 to 100 (e.g. 85 for 85%). Only if the document states a requested or proposed advance rate.' },
      { key: 'arUnder30', type: 'number', description: PERCENT_OF_TOTAL('total AR that is current, aged 0 to 30 days') },
      { key: 'arOver30', type: 'number', description: PERCENT_OF_TOTAL('total AR aged 31 to 60 days') },
      { key: 'arOver60', type: 'number', description: PERCENT_OF_TOTAL('total AR aged 61 to 90 days') },
      { key: 'arOver90', type: 'number', description: PERCENT_OF_TOTAL('total AR aged over 90 days') },
      { key: 'topCustomerConcentration', type: 'number', description: 'Share of receivables or revenue attributable to the single largest customer, as a number from 0 to 100. If the document lists customers individually, use the largest one.' },
      { key: 'dilutionRate', type: 'number', description: 'Dilution as a number from 0 to 100: credits, returns, discounts and adjustments as a percentage of gross billings. Only if stated or directly computable from stated credits and billings.' },
      { key: 'ineligiblesPct', type: 'number', description: PERCENT_OF_TOTAL('AR deemed ineligible (cross-aged, contra, government, foreign, intercompany, past the eligibility cutoff)') },
      { key: 'existingABLFacility', type: 'boolean', description: 'Whether the borrower already has an asset-based revolving credit facility in place.' },
    ],
    percentGroups: [
      {
        label: 'AR aging buckets',
        fields: ['arUnder30', 'arOver30', 'arOver60', 'arOver90'],
      },
    ],
  },

  inventory_finance: {
    label: 'inventory finance',
    fields: [
      ...BORROWER_FIELDS,
      { key: 'totalInventory', type: 'currency', description: 'Total inventory value at cost from the most recent balance sheet or inventory report, in USD.' },
      { key: 'requestedAdvanceRate', type: 'number', description: 'Requested advance rate against eligible inventory, as a number from 0 to 100 (e.g. 55 for 55%). Only if the document states a requested or proposed advance rate.' },
      { key: 'rawMaterials', type: 'number', description: PERCENT_OF_TOTAL('total inventory held as raw materials') },
      { key: 'workInProgress', type: 'number', description: PERCENT_OF_TOTAL('total inventory held as work in progress') },
      { key: 'finishedGoods', type: 'number', description: PERCENT_OF_TOTAL('total inventory held as finished goods ready for sale') },
      { key: 'obsoleteInventory', type: 'number', description: PERCENT_OF_TOTAL('total inventory identified as obsolete, slow-moving, or reserved against') },
      { key: 'inventoryTurnover', type: 'number', description: 'Inventory turnover in TURNS PER YEAR (COGS divided by average inventory), e.g. 6 for 6x. Not a percentage. If only days on hand is given, do not compute this; record days on hand instead.' },
      { key: 'averageDaysOnHand', type: 'integer', description: 'Average days inventory is held before sale. If only turnover is given, do not compute this.' },
      { key: 'nolvPct', type: 'number', description: 'Net orderly liquidation value as a percentage of inventory book value, as a number from 0 to 100 (e.g. 55 for 55%). Normally from an appraisal. If the appraisal gives an NOLV dollar amount, divide by the stated book value and multiply by 100.' },
      { key: 'perishable', type: 'boolean', description: 'Whether the inventory is perishable or otherwise time-sensitive (food, pharmaceuticals, seasonal fashion, dated product).' },
    ],
    percentGroups: [
      {
        label: 'inventory composition',
        // Obsolete inventory overlaps the three stage categories rather
        // than sitting beside them, so it is excluded from the sum.
        fields: ['rawMaterials', 'workInProgress', 'finishedGoods'],
      },
    ],
  },
};

// ---- Document classification ----
// The model tags each document as part of the same forced tool call, so
// classification costs nothing extra. The client merge uses it to decide
// which document wins a field. Keep in sync with DocumentType in
// src/lib/extractionMerge.ts.

const DOCUMENT_TYPES = [
  'financial_statement',
  'tax_return',
  'credit_application',
  'deal_sheet',
  'equipment_quote',
  'appraisal',
  'ar_aging',
  'borrowing_base_certificate',
  'other',
];

const DOCUMENT_TYPE_DESCRIPTION =
  'What kind of document this is, which determines how much weight its values carry against other documents for the same deal. ' +
  'financial_statement: audited, reviewed or compiled financials, P&L, balance sheet. ' +
  'tax_return: a filed return. ' +
  'credit_application: an application or borrower questionnaire. ' +
  'deal_sheet: a term sheet, broker summary, cover email, or deal memo. ' +
  'equipment_quote: a vendor or dealer quotation or invoice. ' +
  'appraisal: a valuation or liquidation study, including NOLV appraisals. ' +
  'ar_aging: an accounts receivable aging report or schedule. ' +
  'borrowing_base_certificate: a borrowing base certificate or availability calculation. ' +
  'other: anything else.';

const SUPPORTED_MODULES = Object.keys(EXTRACTION_SPECS);

// ---- Tool schema construction ----

function jsonTypeFor(field) {
  if (field.type === 'currency' || field.type === 'number') return 'number';
  if (field.type === 'integer') return 'integer';
  if (field.type === 'boolean') return 'boolean';
  return 'string';
}

function buildToolSchema(moduleKey) {
  const spec = EXTRACTION_SPECS[moduleKey];
  if (!spec) return null;
  const properties = {};
  for (const field of spec.fields) {
    const prop = { type: jsonTypeFor(field), description: field.description };
    if (field.type === 'enum') prop.enum = field.options;
    if (field.type === 'currency') prop.description += ' Plain number, no currency symbols or commas.';
    properties[field.key] = prop;
  }
  properties._documentType = {
    type: 'string',
    enum: DOCUMENT_TYPES,
    description: DOCUMENT_TYPE_DESCRIPTION,
  };
  properties._notes = {
    type: 'string',
    description: 'Brief notes on anything ambiguous, conflicting, or estimated during extraction. Empty string if none.',
  };
  return {
    name: 'record_extracted_deal',
    description: `Record the deal fields extracted from this ${spec.label} document, and classify what kind of document it is. Omit any field the document does not state or clearly imply. Never guess values.`,
    input_schema: {
      type: 'object',
      properties,
      required: [],
    },
  };
}

function buildSystemPrompt(moduleKey) {
  const spec = EXTRACTION_SPECS[moduleKey];
  return [
    `You are a credit analyst's extraction assistant. You read ${spec.label} deal sheets, term sheets, and credit applications, and extract structured fields for a deal screening platform.`,
    `Today's date is ${new Date().toISOString().slice(0, 10)}. Use it for any date arithmetic, such as computing years in business from a founding year.`,
    'Rules:',
    '- Extract only what the document states or clearly implies. Omit fields that are not present. Never invent or estimate a value unless the field description explicitly allows it.',
    '- All monetary amounts in USD as plain numbers (5000000, not "$5.0M"). Expand abbreviations: 5.0M = 5000000, 250K = 250000.',
    '- If the document shows conflicting values for a field, use the most recent/final one and mention the conflict in _notes.',
    '- Call the record_extracted_deal tool exactly once.',
  ].join('\n');
}

function buildContentBlock(mediaType, fileBase64) {
  if (mediaType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } };
  }
  if (mediaType.startsWith('image/')) {
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } };
  }
  // text/plain, text/csv — decode and inline as text
  const text = Buffer.from(fileBase64, 'base64').toString('utf-8');
  return { type: 'text', text: `Deal sheet contents:\n\n${text}` };
}

function buildRequestBody(moduleKey, mediaType, fileBase64) {
  const tool = buildToolSchema(moduleKey);
  return {
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: buildSystemPrompt(moduleKey),
    tools: [tool],
    tool_choice: { type: 'tool', name: 'record_extracted_deal' },
    messages: [
      {
        role: 'user',
        content: [
          buildContentBlock(mediaType, fileBase64),
          { type: 'text', text: 'Extract the deal fields from this document.' },
        ],
      },
    ],
  };
}

// ---- Response normalization ----

function normalizeEnum(value, options) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = options.find((opt) => opt.toLowerCase() === trimmed.toLowerCase());
  return match || null;
}

function normalizeNumber(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[$,\s]/g, ''));
    if (isFinite(parsed)) return parsed;
  }
  return null;
}

// Maps the raw tool_use input to module inputs. Drops anything that
// doesn't survive normalization and reports it as a warning instead —
// a wrong prefilled value is worse than a blank one.
// Percentage fields that describe one whole should add up to it. When they
// do not, the usual cause is the model copying dollar amounts into percent
// fields, which silently corrupts the borrowing base. The values are kept
// rather than dropped, because a partial aging schedule is still useful and
// the analyst can see all four numbers, but the mismatch is stated plainly.
//
// Closes AUDIT P1-9, which observed that nothing enforced aging buckets
// summing to 100.
const PERCENT_SUM_TOLERANCE = 2;

function checkPercentGroups(spec, inputs, warnings) {
  for (const group of spec.percentGroups || []) {
    const present = group.fields.filter((f) => typeof inputs[f] === 'number');
    if (present.length !== group.fields.length) continue;

    const sum = present.reduce((n, f) => n + inputs[f], 0);
    if (Math.abs(sum - 100) <= PERCENT_SUM_TOLERANCE) continue;

    const parts = present.map((f) => `${f} ${inputs[f]}`).join(', ');
    if (sum > 1000) {
      // Two orders of magnitude past 100 is not a rounding problem. Almost
      // always dollar amounts landed in percent fields.
      warnings.push(
        `${group.label} sum to ${Math.round(sum)}, not ~100 (${parts}). These look like dollar amounts rather than percentages of the total. Check them before scoring.`,
      );
    } else {
      warnings.push(
        `${group.label} sum to ${sum.toFixed(1)}, not ~100 (${parts}). Check them before scoring.`,
      );
    }
  }
}

function mapExtractedFields(moduleKey, raw) {
  const spec = EXTRACTION_SPECS[moduleKey];
  const inputs = {};
  const found = [];
  const warnings = [];

  for (const field of spec.fields) {
    const value = raw[field.key];
    if (value === undefined || value === null || value === '') continue;

    if (field.type === 'enum') {
      const normalized = normalizeEnum(value, field.options);
      if (normalized === null) {
        warnings.push(`${field.key}: extracted value "${value}" is not a valid option; left blank`);
        continue;
      }
      inputs[field.key] = normalized;
    } else if (field.type === 'currency' || field.type === 'number' || field.type === 'integer') {
      const normalized = normalizeNumber(value);
      if (normalized === null || normalized < 0) {
        warnings.push(`${field.key}: extracted value "${value}" is not a usable number; left blank`);
        continue;
      }
      inputs[field.key] = field.type === 'integer' ? Math.round(normalized) : normalized;
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean') {
        warnings.push(`${field.key}: extracted value "${value}" is not a boolean; left blank`);
        continue;
      }
      inputs[field.key] = value;
    } else {
      if (typeof value !== 'string') continue;
      inputs[field.key] = value.trim().slice(0, 200);
    }
    found.push(field.key);
  }

  checkPercentGroups(spec, inputs, warnings);

  const missing = spec.fields.map((f) => f.key).filter((k) => !found.includes(k));
  const notes = typeof raw._notes === 'string' && raw._notes.trim() ? raw._notes.trim() : null;
  // An unrecognised or absent classification falls back to 'other', which
  // sorts last in every precedence group rather than winning by accident.
  const documentType = DOCUMENT_TYPES.includes(raw._documentType) ? raw._documentType : 'other';

  return { inputs, found, missing, warnings, notes, documentType };
}

function parseApiResponse(moduleKey, apiJson) {
  const toolUse = Array.isArray(apiJson?.content)
    ? apiJson.content.find((block) => block.type === 'tool_use' && block.name === 'record_extracted_deal')
    : null;
  if (!toolUse || typeof toolUse.input !== 'object' || toolUse.input === null) {
    return { error: 'Extraction model did not return structured fields' };
  }
  return mapExtractedFields(moduleKey, toolUse.input);
}

// ---- Entry point ----
// fetchImpl is injectable for tests; defaults to global fetch (Node 18+).

async function extractDealSheet({ moduleKey, mediaType, fileBase64, fetchImpl }) {
  if (!SUPPORTED_MODULES.includes(moduleKey)) {
    return { error: `Deal sheet parsing is not yet supported for ${moduleKey}. Supported: ${SUPPORTED_MODULES.join(', ')}` };
  }
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
    return { error: `Unsupported file type ${mediaType}. Supported: PDF, PNG, JPEG, WebP, GIF, TXT, CSV.` };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: 'Deal sheet parsing is not configured (missing API key)' };
  }

  const doFetch = fetchImpl || fetch;
  let res;
  try {
    res = await doFetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(buildRequestBody(moduleKey, mediaType, fileBase64)),
    });
  } catch (err) {
    console.error('[extract] network error:', err.message);
    return { error: 'Could not reach the extraction service' };
  }

  let json;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok) {
    const detail = json?.error?.message || `HTTP ${res.status}`;
    console.error('[extract] API error:', detail);
    return { error: `Extraction service error: ${detail}` };
  }

  return parseApiResponse(moduleKey, json);
}

// Extract a set of documents for one deal, in parallel.
//
// One model call per document, fanned out, so four documents cost roughly
// one document's latency instead of four. A document that fails comes back
// as an error in its own slot rather than failing the batch: three good
// documents and one unreadable scan should still produce a prefilled form.
//
// Merging these results is deliberately NOT done here. It happens in
// src/lib/extractionMerge.ts, on the client, where the analyst can see the
// precedence decisions and override them. Keeping the server stateless
// also means adding or removing a document re-merges without re-parsing
// anything.
async function extractDealSheetSet({ moduleKey, files, fetchImpl }) {
  if (!SUPPORTED_MODULES.includes(moduleKey)) {
    return { error: `Deal sheet parsing is not yet supported for ${moduleKey}. Supported: ${SUPPORTED_MODULES.join(', ')}` };
  }
  if (!Array.isArray(files) || files.length === 0) {
    return { error: 'At least one file is required' };
  }

  const documents = await Promise.all(
    files.map(async (file) => {
      const fileName = typeof file.name === 'string' && file.name.trim()
        ? file.name.trim().slice(0, 200)
        : 'document';
      const result = await extractDealSheet({
        moduleKey,
        mediaType: file.media_type,
        fileBase64: file.data,
        fetchImpl,
      });
      if (result.error) {
        return {
          fileName,
          documentType: 'other',
          inputs: {},
          found: [],
          missing: [],
          warnings: [],
          notes: null,
          error: result.error,
        };
      }
      return { fileName, ...result, error: null };
    }),
  );

  return { documents };
}

module.exports = {
  extractDealSheet,
  extractDealSheetSet,
  buildRequestBody,
  buildToolSchema,
  parseApiResponse,
  mapExtractedFields,
  normalizeEnum,
  normalizeNumber,
  checkPercentGroups,
  EXTRACTION_SPECS,
  SUPPORTED_MODULES,
  SUPPORTED_MEDIA_TYPES,
  DOCUMENT_TYPES,
};
