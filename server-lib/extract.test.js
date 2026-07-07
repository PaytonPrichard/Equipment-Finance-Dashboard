/**
 * @jest-environment node
 *
 * Run with: npx jest server-lib --testEnvironment node
 * (CommonJS on purpose — server-lib is outside the CRA babel pipeline.)
 */

const {
  extractDealSheet,
  buildRequestBody,
  buildToolSchema,
  parseApiResponse,
  mapExtractedFields,
  normalizeEnum,
  normalizeNumber,
  EXTRACTION_SPECS,
  SUPPORTED_MODULES,
} = require('./extract');

const MODULE = 'equipment_finance';

function toolUseResponse(input) {
  return {
    content: [
      { type: 'text', text: 'Extracting…' },
      { type: 'tool_use', name: 'record_extracted_deal', input },
    ],
  };
}

describe('buildToolSchema', () => {
  test('includes every spec field plus _notes', () => {
    const schema = buildToolSchema(MODULE);
    const keys = Object.keys(schema.input_schema.properties);
    for (const field of EXTRACTION_SPECS[MODULE].fields) {
      expect(keys).toContain(field.key);
    }
    expect(keys).toContain('_notes');
  });

  test('enum fields carry their valid options', () => {
    const schema = buildToolSchema(MODULE);
    expect(schema.input_schema.properties.financingType.enum).toEqual(['EFA', 'FMV', 'TRAC']);
    expect(schema.input_schema.properties.equipmentCondition.enum).toEqual(['New', 'Used']);
  });

  test('returns null for unknown module', () => {
    expect(buildToolSchema('unknown_module')).toBeNull();
  });
});

describe('buildRequestBody', () => {
  test('PDF becomes a document block and tool choice is forced', () => {
    const body = buildRequestBody(MODULE, 'application/pdf', 'BASE64DATA');
    expect(body.messages[0].content[0]).toEqual({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'BASE64DATA' },
    });
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'record_extracted_deal' });
  });

  test('images become image blocks', () => {
    const body = buildRequestBody(MODULE, 'image/png', 'IMGDATA');
    expect(body.messages[0].content[0].type).toBe('image');
    expect(body.messages[0].content[0].source.media_type).toBe('image/png');
  });

  test('system prompt carries today\'s date for founding-year math', () => {
    const body = buildRequestBody(MODULE, 'application/pdf', 'X');
    expect(body.system).toContain(new Date().toISOString().slice(0, 10));
  });

  test('text files are decoded inline', () => {
    const base64 = Buffer.from('Equipment cost: $5M').toString('base64');
    const body = buildRequestBody(MODULE, 'text/plain', base64);
    expect(body.messages[0].content[0].type).toBe('text');
    expect(body.messages[0].content[0].text).toContain('Equipment cost: $5M');
  });
});

describe('normalization', () => {
  test('normalizeEnum matches case-insensitively', () => {
    expect(normalizeEnum('efa', ['EFA', 'FMV', 'TRAC'])).toBe('EFA');
    expect(normalizeEnum(' Used ', ['New', 'Used'])).toBe('Used');
    expect(normalizeEnum('Operating Lease', ['EFA', 'FMV', 'TRAC'])).toBeNull();
  });

  test('normalizeNumber coerces formatted strings', () => {
    expect(normalizeNumber(5000000)).toBe(5000000);
    expect(normalizeNumber('5,000,000')).toBe(5000000);
    expect(normalizeNumber('$1,250,000')).toBe(1250000);
    expect(normalizeNumber('TBD')).toBeNull();
    expect(normalizeNumber(null)).toBeNull();
  });
});

describe('mapExtractedFields', () => {
  test('maps a clean extraction to module inputs', () => {
    const result = mapExtractedFields(MODULE, {
      companyName: 'Acme Trucking LLC',
      annualRevenue: 50000000,
      ebitda: 8000000,
      equipmentCost: 5000000,
      financingType: 'EFA',
      equipmentCondition: 'New',
      loanTerm: 84,
      usefulLife: 15,
      essentialUse: true,
      _notes: '',
    });
    expect(result.inputs.companyName).toBe('Acme Trucking LLC');
    expect(result.inputs.loanTerm).toBe(84);
    expect(result.inputs.essentialUse).toBe(true);
    expect(result.found).toContain('equipmentCost');
    expect(result.missing).toContain('downPayment');
    expect(result.warnings).toEqual([]);
    expect(result.notes).toBeNull();
  });

  test('invalid enum values become warnings, not inputs', () => {
    const result = mapExtractedFields(MODULE, { financingType: 'Operating Lease' });
    expect(result.inputs.financingType).toBeUndefined();
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('financingType');
  });

  test('negative and non-numeric currency values are rejected', () => {
    const result = mapExtractedFields(MODULE, { equipmentCost: -100, ebitda: 'unknown' });
    expect(result.inputs.equipmentCost).toBeUndefined();
    expect(result.inputs.ebitda).toBeUndefined();
    expect(result.warnings.length).toBe(2);
  });

  test('integer fields are rounded, booleans type-checked', () => {
    const result = mapExtractedFields(MODULE, { loanTerm: 84.4, essentialUse: 'yes' });
    expect(result.inputs.loanTerm).toBe(84);
    expect(result.inputs.essentialUse).toBeUndefined();
    expect(result.warnings.some((w) => w.includes('essentialUse'))).toBe(true);
  });

  test('surfaces model notes', () => {
    const result = mapExtractedFields(MODULE, { _notes: 'Two EBITDA figures shown; used FY2025.' });
    expect(result.notes).toBe('Two EBITDA figures shown; used FY2025.');
  });
});

describe('parseApiResponse', () => {
  test('reads the forced tool_use block', () => {
    const result = parseApiResponse(MODULE, toolUseResponse({ equipmentCost: 5000000 }));
    expect(result.inputs.equipmentCost).toBe(5000000);
  });

  test('errors when no tool_use block is present', () => {
    const result = parseApiResponse(MODULE, { content: [{ type: 'text', text: 'hi' }] });
    expect(result.error).toBeTruthy();
  });
});

describe('extractDealSheet', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, ANTHROPIC_API_KEY: 'test-key' };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('rejects unsupported modules and media types', async () => {
    const r1 = await extractDealSheet({ moduleKey: 'inventory_finance', mediaType: 'application/pdf', fileBase64: 'x' });
    expect(r1.error).toContain('not yet supported');
    const r2 = await extractDealSheet({ moduleKey: MODULE, mediaType: 'application/zip', fileBase64: 'x' });
    expect(r2.error).toContain('Unsupported file type');
  });

  test('errors cleanly when API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await extractDealSheet({ moduleKey: MODULE, mediaType: 'application/pdf', fileBase64: 'x' });
    expect(result.error).toContain('not configured');
  });

  test('happy path: calls the API and maps the response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => toolUseResponse({ companyName: 'Acme', equipmentCost: 5000000, financingType: 'efa' }),
    });
    const result = await extractDealSheet({ moduleKey: MODULE, mediaType: 'application/pdf', fileBase64: 'PDF64', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toContain('api.anthropic.com');
    expect(opts.headers['x-api-key']).toBe('test-key');
    const sent = JSON.parse(opts.body);
    expect(sent.tool_choice.name).toBe('record_extracted_deal');

    expect(result.inputs.companyName).toBe('Acme');
    expect(result.inputs.financingType).toBe('EFA'); // normalized casing
    expect(result.error).toBeUndefined();
  });

  test('surfaces API errors without leaking internals', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 529,
      json: async () => ({ error: { message: 'Overloaded' } }),
    });
    const result = await extractDealSheet({ moduleKey: MODULE, mediaType: 'application/pdf', fileBase64: 'x', fetchImpl });
    expect(result.error).toContain('Overloaded');
  });

  test('handles network failure', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await extractDealSheet({ moduleKey: MODULE, mediaType: 'application/pdf', fileBase64: 'x', fetchImpl });
    expect(result.error).toContain('Could not reach');
  });
});

describe('module registry', () => {
  test('equipment finance is the only supported module for now', () => {
    expect(SUPPORTED_MODULES).toEqual(['equipment_finance']);
  });
});
