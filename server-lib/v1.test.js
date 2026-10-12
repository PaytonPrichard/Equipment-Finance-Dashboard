/**
 * @jest-environment node
 *
 * Run with: npx jest server-lib --testEnvironment node
 *
 * The public API (api/v1.js) against an in-memory stand-in for Supabase.
 * Scoring runs through the real bundle (api/_scoring.cjs); key auth, the
 * plan check, rate limiting and webhook delivery are stubbed.
 */

const crypto = require('crypto');

const { makeDb } = require('./fakeSupabase.testutil');

// v1.js reads supabaseAdmin once at load, so it gets a stable proxy and
// each test swaps the database behind it.
let mockCurrent;
const mockDb = {
  from: (...a) => mockCurrent.from(...a),
  auth: { getUser: (...a) => mockCurrent.auth.getUser(...a) },
  get tables() { return mockCurrent.tables; },
};
let mockAuth;
let mockPlan;
const mockDispatch = jest.fn(async () => ({ dispatched: 0 }));

jest.mock('./supabaseAdmin', () => ({ supabaseAdmin: mockDb }));
jest.mock('./apiKeyAuth', () => ({ authenticateApiKey: async () => mockAuth, generateApiKey: () => ({ key: 'trn_x', prefix: 'trn_x', hash: 'h' }) }));
jest.mock('./planCheck', () => ({ checkOrgPlanStatus: async () => mockPlan, checkPlanStatus: async () => mockPlan }));
jest.mock('./rateLimit', () => ({ checkRateLimit: () => true }));
jest.mock('./cors', () => ({ handlePreflight: () => false }));
jest.mock('./webhookDispatch', () => {
  const actual = jest.requireActual('./webhookDispatch');
  return { ...actual, dispatchWebhooks: (...a) => mockDispatch(...a) };
});

const handler = require('../api/v1');
const { checkWebhookUrl, signPayload } = jest.requireActual('./webhookDispatch');

const COMPLETE = {
  companyName: 'Dealer Co', annualRevenue: 40e6, ebitda: 6e6, yearsInBusiness: 12, totalExistingDebt: 10e6,
  industrySector: 'Manufacturing', creditRating: 'Adequate', equipmentType: 'Heavy Machinery', equipmentCondition: 'New',
  equipmentCost: 2e6, downPayment: 200000, financingType: 'EFA', usefulLife: 15, loanTerm: 60, essentialUse: true,
};

function seed() {
  return {
    pipeline_deals: [
      { id: 1, org_id: 'org-1', name: 'Typed', stage: 'Screening', score: 70, notes: '', inputs: COMPLETE, asset_class: 'equipment_finance' },
      { id: 2, org_id: 'org-1', name: 'Built', stage: 'Screening', score: 66, notes: '', inputs: { ...COMPLETE, financials: { lineItems: {} } }, asset_class: 'equipment_finance' },
      { id: 3, org_id: 'org-2', name: 'Other firm', stage: 'Screening', score: 50, notes: '', inputs: COMPLETE, asset_class: 'equipment_finance' },
    ],
    audit_log: [],
    profiles: [
      { id: 'admin-1', org_id: 'org-1', role: 'admin' },
      { id: 'cc-1', org_id: 'org-1', role: 'credit_committee' },
    ],
    api_keys: [],
    webhooks: [],
  };
}

async function call({ method = 'GET', query = {}, body, headers = {} }) {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader() {}, end() { return this; },
  };
  await handler({ method, query, body, headers }, res);
  return res;
}
const deals = (method, query, body) => call({ method, query: { resource: 'deals', ...query }, body });

beforeEach(() => {
  mockCurrent = makeDb(seed());
  mockAuth = { orgId: 'org-1', keyId: 'key-1', keyName: 'HubSpot', keyPrefix: 'trn_abcd1234', createdBy: 'admin-1' };
  mockPlan = { expired: false };
  mockDispatch.mockClear();
});

describe('POST deals', () => {
  test('a draft with only what the CRM knows is created unscored, audited and announced', async () => {
    const r = await deals('POST', {}, { name: 'Dealer Co', draft: true, inputs: { companyName: 'Dealer Co', annualRevenue: 40e6 } });
    expect(r.statusCode).toBe(201);
    expect(r.body).toMatchObject({ name: 'Dealer Co', stage: 'Screening', score: null, draft: true });

    const row = mockDb.tables.pipeline_deals.find((d) => d.id === r.body.id);
    expect(row.score).toBeNull();
    expect(row.stage_entered_at).toBeTruthy();

    expect(mockDb.tables.audit_log).toHaveLength(1);
    expect(mockDb.tables.audit_log[0]).toMatchObject({
      user_id: 'admin-1', org_id: 'org-1', action: 'create', entity_id: r.body.id,
      metadata: { via: 'api', apiKeyName: 'HubSpot', apiKeyPrefix: 'trn_abcd1234' },
    });
    expect(mockDispatch.mock.calls.map((c) => c[1])).toEqual(['deal.created']);
    expect(mockDispatch.mock.calls[0][2]).toMatchObject({ draft: true, score: null });
  });

  test('a draft still rejects a value that is present and wrong', async () => {
    const r = await deals('POST', {}, { name: 'X', draft: true, inputs: { annualRevenue: -5 } });
    expect(r.statusCode).toBe(400);
    expect(r.body.errors.map((e) => e.field)).toEqual(['annualRevenue']);
  });

  test('without draft, missing inputs are refused as before', async () => {
    const r = await deals('POST', {}, { name: 'X', inputs: { annualRevenue: 40e6 } });
    expect(r.statusCode).toBe(400);
    expect(mockDb.tables.pipeline_deals).toHaveLength(3);
  });

  test('a complete deal is scored, audited, and fires created then scored', async () => {
    const r = await deals('POST', {}, { name: 'Dealer Co', inputs: COMPLETE });
    expect(r.statusCode).toBe(201);
    expect(typeof r.body.score).toBe('number');
    expect(r.body.draft).toBe(false);
    expect(mockDb.tables.audit_log[0]).toMatchObject({ action: 'create', user_id: 'admin-1' });
    expect(mockDispatch.mock.calls.map((c) => c[1])).toEqual(['deal.created', 'deal.scored']);
  });

  test('financial statements are refused', async () => {
    const r = await deals('POST', {}, { name: 'X', inputs: { ...COMPLETE, financials: { lineItems: {} } } });
    expect(r.statusCode).toBe(400);
    expect(r.body.error).toMatch(/^Financial statements are not accepted through the API yet/);
  });

  test('an expired plan cannot write', async () => {
    mockPlan = { expired: true, message: 'Your trial plan has expired.' };
    const r = await deals('POST', {}, { name: 'X', inputs: COMPLETE });
    expect(r.statusCode).toBe(403);
    expect(mockDb.tables.pipeline_deals).toHaveLength(3);
  });
});

describe('PATCH deals', () => {
  test('a stage that does not exist is refused', async () => {
    const r = await deals('PATCH', { id: 1 }, { stage: 'Won' });
    expect(r.statusCode).toBe(400);
    expect(r.body.error).toMatch(/^Invalid stage/);
  });

  test('a stage move resets days in stage, is audited and fires the stage webhook', async () => {
    const r = await deals('PATCH', { id: 1 }, { stage: 'Approved' });
    expect(r.statusCode).toBe(200);
    const row = mockDb.tables.pipeline_deals.find((d) => d.id === 1);
    expect(row.stage).toBe('Approved');
    expect(row.stage_entered_at).toBeTruthy();
    expect(mockDb.tables.audit_log[0]).toMatchObject({ action: 'update_stage', old_values: { stage: 'Screening' }, new_values: { stage: 'Approved' } });
    expect(mockDispatch).toHaveBeenCalledWith('org-1', 'pipeline.stage_changed', expect.objectContaining({ previous_stage: 'Screening', new_stage: 'Approved' }));
  });

  test('inputs on a deal built from statements are refused', async () => {
    const r = await deals('PATCH', { id: 2 }, { inputs: COMPLETE });
    expect(r.statusCode).toBe(409);
  });

  test('another firm\'s deal is not found', async () => {
    const r = await deals('PATCH', { id: 3 }, { stage: 'Approved' });
    expect(r.statusCode).toBe(404);
    expect(mockDb.tables.pipeline_deals.find((d) => d.id === 3).stage).toBe('Screening');
  });

  test('completing a draft scores it and fires deal.scored', async () => {
    const created = await deals('POST', {}, { name: 'Dealer Co', draft: true, inputs: { annualRevenue: 40e6 } });
    mockDispatch.mockClear();
    const r = await deals('PATCH', { id: created.body.id }, { inputs: COMPLETE });
    expect(r.statusCode).toBe(200);
    expect(typeof r.body.score).toBe('number');
    expect(r.body.draft).toBe(false);
    expect(mockDispatch.mock.calls.map((c) => c[1])).toEqual(['deal.scored']);
  });
});

describe('GET deals', () => {
  test('page size is capped at 100 and drafts are marked', async () => {
    mockCurrent.tables.pipeline_deals.push({ id: 9, org_id: 'org-1', name: 'Draft', stage: 'Screening', score: null, inputs: {} });
    const r = await deals('GET', { limit: '100000' });
    expect(r.body.limit).toBe(100);
    expect(r.body.deals.find((d) => d.id === 9).draft).toBe(true);
    expect(r.body.deals.every((d) => d.id !== 3)).toBe(true);
  });
});

describe('keys and webhooks are admin only', () => {
  test('credit committee cannot create a key', async () => {
    const r = await call({ method: 'POST', query: { resource: 'keys' }, headers: { authorization: 'Bearer cc-1' }, body: { name: 'X' } });
    expect(r.statusCode).toBe(403);
  });

  test('an admin cannot register an http or private webhook address', async () => {
    for (const url of ['http://example.com/hook', 'https://localhost/hook', 'https://169.254.169.254/latest', 'https://10.0.0.5/x']) {
      const r = await call({ method: 'POST', query: { resource: 'webhooks' }, headers: { authorization: 'Bearer admin-1' }, body: { url } });
      expect(r.statusCode).toBe(400);
    }
    const ok = await call({ method: 'POST', query: { resource: 'webhooks' }, headers: { authorization: 'Bearer admin-1' }, body: { url: 'https://hooks.zapier.com/abc' } });
    expect(ok.statusCode).toBe(201);
  });
});

describe('webhook helpers', () => {
  test('address rules', () => {
    expect(checkWebhookUrl('https://api.hubapi.com/x')).toBeNull();
    expect(checkWebhookUrl('https://192.168.1.4/x')).toMatch(/public address/);
    expect(checkWebhookUrl('https://172.20.0.1/x')).toMatch(/public address/);
    expect(checkWebhookUrl('https://172.32.0.1/x')).toBeNull();
    expect(checkWebhookUrl('ftp://example.com')).toMatch(/https/);
    expect(checkWebhookUrl('not a url')).toBe('Invalid URL format');
  });

  test('the signature covers the timestamp and the raw body', () => {
    const body = '{"event":"deal.scored"}';
    const expected = crypto.createHmac('sha256', 'whsec_test').update(`1760000000.${body}`).digest('hex');
    expect(signPayload(body, 'whsec_test', 1760000000)).toBe(expected);
    expect(signPayload(body, 'whsec_test', 1760000001)).not.toBe(expected);
  });
});
