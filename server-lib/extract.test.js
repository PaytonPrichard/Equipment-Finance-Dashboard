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
  extractDealSheetSet,
  DOCUMENT_TYPES,
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
    const r1 = await extractDealSheet({ moduleKey: 'commercial_real_estate', mediaType: 'application/pdf', fileBase64: 'x' });
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

describe('credit rating is never inferred from silence', () => {
  // "Not Rated" is a scored credit opinion (+100bps in CREDIT_SPREAD_BPS)
  // while the form default "Adequate" is 0bps. The spec used to say
  // 'Use "Not Rated" if not addressed', so a document that never discussed
  // credit quality priced 100bps wider on upload than on manual entry.
  // Verified against the Granite Ridge corpus, where no document mentions
  // credit quality and extraction returned "Not Rated" from all three.
  const field = EXTRACTION_SPECS.equipment_finance.fields.find(
    (f) => f.key === 'creditRating',
  );

  test('the field exists and is still an enum over the valid ratings', () => {
    expect(field).toBeDefined();
    expect(field.type).toBe('enum');
    expect(field.options).toContain('Not Rated');
  });

  test('the description tells the model to omit rather than default', () => {
    expect(field.description).toMatch(/omit this field/i);
    expect(field.description).toMatch(/do not infer/i);
    // The old instruction is the regression being guarded against.
    expect(field.description).not.toMatch(/use "Not Rated" if not addressed/i);
  });
});

describe('module registry', () => {
  test('all three asset classes support extraction', () => {
    expect(SUPPORTED_MODULES.slice().sort()).toEqual([
      'accounts_receivable',
      'equipment_finance',
      'inventory_finance',
    ]);
  });

  test('every module shares the same borrower block', () => {
    // The borrower fields come from one constant. If a module grows its own
    // copy they drift, and the same field ends up described differently
    // depending on asset class.
    const SHARED = [
      'companyName', 'annualRevenue', 'priorYearRevenue', 'ebitda', 'priorYearEbitda',
      'yearsInBusiness', 'totalExistingDebt', 'actualAnnualDebtService', 'maintenanceCapex',
      'cashOnHand', 'availableLiquidity', 'industrySector', 'creditRating',
    ];
    const borrowerFields = (key) =>
      EXTRACTION_SPECS[key].fields.filter((f) => SHARED.includes(f.key));

    const equipment = borrowerFields('equipment_finance');
    expect(equipment).toHaveLength(13);

    for (const other of ['accounts_receivable', 'inventory_finance']) {
      const fields = borrowerFields(other);
      expect(fields.map((f) => f.key)).toEqual(equipment.map((f) => f.key));
      // Same wording too, not just the same names.
      expect(fields.map((f) => f.description)).toEqual(equipment.map((f) => f.description));
    }
  });

  test('collateral fields do not leak across modules', () => {
    const keys = (k) => EXTRACTION_SPECS[k].fields.map((f) => f.key);
    expect(keys('accounts_receivable')).toContain('arOver90');
    expect(keys('accounts_receivable')).not.toContain('equipmentCost');
    expect(keys('inventory_finance')).toContain('nolvPct');
    expect(keys('inventory_finance')).not.toContain('arOver90');
    expect(keys('equipment_finance')).not.toContain('totalInventory');
  });
});

describe('document classification', () => {
  test('the tool schema asks the model to classify the document', () => {
    const schema = buildToolSchema(MODULE);
    expect(schema.input_schema.properties._documentType).toBeDefined();
    expect(schema.input_schema.properties._documentType.enum).toEqual(DOCUMENT_TYPES);
  });

  test('a valid classification is carried through', () => {
    const r = mapExtractedFields(MODULE, { ebitda: 100, _documentType: 'financial_statement' });
    expect(r.documentType).toBe('financial_statement');
  });

  test('an absent or unrecognised classification falls back to other', () => {
    // 'other' sorts last in every precedence group, so a document the model
    // could not classify never wins a field by accident.
    expect(mapExtractedFields(MODULE, { ebitda: 100 }).documentType).toBe('other');
    expect(mapExtractedFields(MODULE, { ebitda: 100, _documentType: 'invoice' }).documentType).toBe('other');
  });
});

describe('percentage groups that should sum to 100', () => {
  // Source documents state dollars; these fields are percentages. The
  // percent-vs-dollar class already reached production once in AR and
  // inventory scoring. Closes AUDIT P1-9.

  test('aging buckets that sum to ~100 pass silently', () => {
    const r = mapExtractedFields('accounts_receivable', {
      arUnder30: 65, arOver30: 27, arOver60: 7, arOver90: 1,
    });
    expect(r.warnings).toHaveLength(0);
  });

  test('dollar amounts in percent fields are called out as such', () => {
    const r = mapExtractedFields('accounts_receivable', {
      arUnder30: 7800000, arOver30: 3240000, arOver60: 840000, arOver90: 120000,
    });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/dollar amounts rather than percentages/);
    // Kept, not dropped: the analyst can see all four and correct them.
    expect(r.inputs.arOver30).toBe(3240000);
  });

  test('a merely incomplete schedule gets a plainer warning', () => {
    const r = mapExtractedFields('accounts_receivable', {
      arUnder30: 65, arOver30: 20, arOver60: 7, arOver90: 1,
    });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('sum to 93.0');
    expect(r.warnings[0]).not.toMatch(/dollar amounts/);
  });

  test('a partial group is not checked', () => {
    // Three of four buckets says nothing about whether they sum right.
    const r = mapExtractedFields('accounts_receivable', {
      arUnder30: 65, arOver30: 27, arOver60: 7,
    });
    expect(r.warnings).toHaveLength(0);
  });

  test('inventory composition is checked, with obsolete excluded from the sum', () => {
    // Obsolete overlaps the three stage categories rather than sitting
    // beside them, so 30 + 15 + 55 alongside 8 obsolete must still pass.
    const r = mapExtractedFields('inventory_finance', {
      rawMaterials: 30, workInProgress: 15, finishedGoods: 55, obsoleteInventory: 8,
    });
    expect(r.warnings).toHaveLength(0);
  });

  test('equipment finance has no percentage groups to check', () => {
    const r = mapExtractedFields(MODULE, { equipmentCost: 5000000, downPayment: 500000 });
    expect(r.warnings).toHaveLength(0);
  });
});

describe('extractDealSheetSet', () => {
  // Set the key here too. Without it these tests pass only when the shell
  // running them happens to export ANTHROPIC_API_KEY.
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, ANTHROPIC_API_KEY: 'test-key' };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  function sequencedFetch(inputsPerCall) {
    let i = 0;
    return async () => ({
      ok: true,
      json: async () => toolUseResponse(inputsPerCall[i++]),
    });
  }

  test('extracts every document and keeps their results separate', async () => {
    const result = await extractDealSheetSet({
      moduleKey: MODULE,
      files: [
        { name: 'financials.pdf', media_type: 'application/pdf', data: 'x' },
        { name: 'quote.pdf', media_type: 'application/pdf', data: 'y' },
      ],
      fetchImpl: sequencedFetch([
        { ebitda: 7400000, _documentType: 'financial_statement' },
        { equipmentCost: 6275000, _documentType: 'equipment_quote' },
      ]),
    });

    expect(result.documents).toHaveLength(2);
    expect(result.documents[0].fileName).toBe('financials.pdf');
    expect(result.documents[0].documentType).toBe('financial_statement');
    expect(result.documents[0].inputs.ebitda).toBe(7400000);
    expect(result.documents[1].documentType).toBe('equipment_quote');
    expect(result.documents[1].inputs.equipmentCost).toBe(6275000);
  });

  test('results stay aligned with the files that produced them', async () => {
    // Fan-out is Promise.all, so results must come back in argument order
    // regardless of which request settles first. If this ever regresses,
    // every field would be attributed to the wrong document.
    const byData = {
      a: { ebitda: 1, _documentType: 'financial_statement' },
      b: { ebitda: 2, _documentType: 'tax_return' },
      c: { ebitda: 3, _documentType: 'credit_application' },
    };
    const fetchImpl = async (_url, options) => {
      const body = JSON.parse(options.body);
      const block = body.messages[0].content[0];
      const data = block.source ? block.source.data : 'a';
      // Make the first request settle last.
      const delay = data === 'a' ? 20 : 0;
      await new Promise((r) => setTimeout(r, delay));
      return { ok: true, json: async () => toolUseResponse(byData[data]) };
    };

    const result = await extractDealSheetSet({
      moduleKey: MODULE,
      files: [
        { name: 'a.pdf', media_type: 'application/pdf', data: 'a' },
        { name: 'b.pdf', media_type: 'application/pdf', data: 'b' },
        { name: 'c.pdf', media_type: 'application/pdf', data: 'c' },
      ],
      fetchImpl,
    });

    expect(result.documents.map((d) => d.fileName)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(result.documents.map((d) => d.inputs.ebitda)).toEqual([1, 2, 3]);
  });

  test('one unreadable document does not fail the batch', async () => {
    // Three good documents and one bad scan should still prefill the form.
    let call = 0;
    const fetchImpl = async () => {
      call += 1;
      if (call === 2) {
        return { ok: false, status: 400, json: async () => ({ error: { message: 'could not read' } }) };
      }
      return { ok: true, json: async () => toolUseResponse({ ebitda: 100, _documentType: 'financial_statement' }) };
    };

    const result = await extractDealSheetSet({
      moduleKey: MODULE,
      files: [
        { name: 'good.pdf', media_type: 'application/pdf', data: 'x' },
        { name: 'bad.pdf', media_type: 'application/pdf', data: 'y' },
      ],
      fetchImpl,
    });

    const bad = result.documents.find((d) => d.fileName === 'bad.pdf');
    const good = result.documents.find((d) => d.fileName === 'good.pdf');
    expect(bad.error).toBeTruthy();
    expect(bad.inputs).toEqual({});
    expect(good.error).toBeNull();
    expect(good.inputs.ebitda).toBe(100);
  });

  test('rejects an unsupported module and an empty set', async () => {
    const r1 = await extractDealSheetSet({
      moduleKey: 'commercial_real_estate',
      files: [{ media_type: 'application/pdf', data: 'x' }],
    });
    expect(r1.error).toContain('not yet supported');
    const r2 = await extractDealSheetSet({ moduleKey: MODULE, files: [] });
    expect(r2.error).toContain('At least one file');
  });

  test('a missing filename does not produce an unnamed document', async () => {
    const result = await extractDealSheetSet({
      moduleKey: MODULE,
      files: [{ media_type: 'application/pdf', data: 'x' }],
      fetchImpl: sequencedFetch([{ ebitda: 1, _documentType: 'other' }]),
    });
    expect(result.documents[0].fileName).toBe('document');
  });
});
