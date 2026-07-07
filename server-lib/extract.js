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

const EXTRACTION_SPECS = {
  equipment_finance: {
    label: 'equipment finance',
    fields: [
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
      { key: 'creditRating', type: 'enum', options: VALID_CREDIT_RATINGS, description: 'Borrower credit quality if characterized in the document (investment grade or equivalent = "Strong", middle market = "Adequate", below average = "Weak"). Use "Not Rated" if not addressed.' },
      { key: 'equipmentType', type: 'enum', options: VALID_EQUIPMENT_TYPES, description: 'Type of equipment being financed, mapped to the closest listed option.' },
      { key: 'equipmentCondition', type: 'enum', options: VALID_EQUIPMENT_CONDITIONS, description: 'Whether the equipment is new or used.' },
      { key: 'equipmentCost', type: 'currency', description: 'Total purchase price / cost of the equipment being financed, in USD.' },
      { key: 'downPayment', type: 'currency', description: 'Down payment or upfront equity contribution toward the equipment, in USD.' },
      { key: 'financingType', type: 'enum', options: VALID_FINANCING_TYPES, description: 'Financing structure. Loan, equipment finance agreement, or capital/finance lease = "EFA". Fair market value or operating lease = "FMV". TRAC lease (terminal rental adjustment clause, typically titled vehicles) = "TRAC".' },
      { key: 'usefulLife', type: 'integer', description: 'Expected economic useful life of the equipment, in YEARS.' },
      { key: 'loanTerm', type: 'integer', description: 'Requested loan or lease term, in MONTHS. Convert years to months if needed (e.g. 7 years = 84).' },
      { key: 'essentialUse', type: 'boolean', description: 'Whether the equipment is essential/mission-critical to the borrower\'s core revenue operations.' },
    ],
  },
};

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
  properties._notes = {
    type: 'string',
    description: 'Brief notes on anything ambiguous, conflicting, or estimated during extraction. Empty string if none.',
  };
  return {
    name: 'record_extracted_deal',
    description: `Record the deal fields extracted from a ${spec.label} deal sheet. Omit any field the document does not state or clearly imply. Never guess values.`,
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

  const missing = spec.fields.map((f) => f.key).filter((k) => !found.includes(k));
  const notes = typeof raw._notes === 'string' && raw._notes.trim() ? raw._notes.trim() : null;

  return { inputs, found, missing, warnings, notes };
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

module.exports = {
  extractDealSheet,
  buildRequestBody,
  buildToolSchema,
  parseApiResponse,
  mapExtractedFields,
  normalizeEnum,
  normalizeNumber,
  EXTRACTION_SPECS,
  SUPPORTED_MODULES,
  SUPPORTED_MEDIA_TYPES,
};
