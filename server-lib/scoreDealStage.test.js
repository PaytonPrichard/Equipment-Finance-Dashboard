/**
 * @jest-environment node
 *
 * Run with: npx jest server-lib --testEnvironment node
 *
 * PATCH /api/score-deal?action=stage: stage moves from the app. They used to
 * be written straight from the browser, so the stage webhook never fired for
 * them and the stage permissions were checked in the browser only.
 */

const { makeDb } = require('./fakeSupabase.testutil');

let mockCurrent;
const mockDb = {
  from: (...a) => mockCurrent.from(...a),
  auth: { getUser: (...a) => mockCurrent.auth.getUser(...a) },
};
const mockDispatch = jest.fn(async () => ({ dispatched: 0 }));

jest.mock('./supabaseAdmin', () => ({ supabaseAdmin: mockDb }));
jest.mock('./planCheck', () => ({ checkPlanStatus: async () => ({ expired: false }), checkOrgPlanStatus: async () => ({ expired: false }) }));
jest.mock('./rateLimit', () => ({ checkRateLimit: () => true }));
jest.mock('./cors', () => ({ handlePreflight: () => false }));
jest.mock('./webhookDispatch', () => ({ dispatchWebhooks: (...a) => mockDispatch(...a), checkWebhookUrl: () => null }));

const handler = require('../api/score-deal');

function seed() {
  return {
    profiles: [
      { id: 'analyst-1', org_id: 'org-1', role: 'analyst', full_name: 'Ana' },
      { id: 'cc-1', org_id: 'org-1', role: 'credit_committee', full_name: 'Cee' },
      { id: 'other-1', org_id: 'org-2', role: 'admin', full_name: 'Other' },
    ],
    pipeline_deals: [{ id: 7, org_id: 'org-1', name: 'Dealer Co', stage: 'Under Review', score: 70 }],
    org_permissions: [],
    audit_log: [],
  };
}

async function move(userId, stage, id = 7) {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader() {}, end() { return this; },
  };
  await handler({ method: 'PATCH', query: { id, action: 'stage' }, body: { stage }, headers: { authorization: `Bearer ${userId}` } }, res);
  return res;
}

beforeEach(() => {
  mockCurrent = makeDb(seed());
  mockDispatch.mockClear();
});

test('a permitted move updates the stage, resets days in stage, audits and fires the webhook', async () => {
  const r = await move('cc-1', 'Approved');
  expect(r.statusCode).toBe(200);
  expect(r.body.deal).toMatchObject({ id: 7, stage: 'Approved' });
  const row = mockCurrent.tables.pipeline_deals[0];
  expect(row.stage_entered_at).toBeTruthy();
  expect(mockCurrent.tables.audit_log).toEqual([
    expect.objectContaining({ user_id: 'cc-1', org_id: 'org-1', action: 'update_stage', old_values: { stage: 'Under Review' }, new_values: { stage: 'Approved' } }),
  ]);
  expect(mockDispatch).toHaveBeenCalledWith('org-1', 'pipeline.stage_changed', { id: 7, name: 'Dealer Co', previous_stage: 'Under Review', new_stage: 'Approved' });
});

test('an analyst cannot approve: the server enforces the stage permission', async () => {
  const r = await move('analyst-1', 'Approved');
  expect(r.statusCode).toBe(403);
  expect(mockCurrent.tables.pipeline_deals[0].stage).toBe('Under Review');
  expect(mockDispatch).not.toHaveBeenCalled();
});

test('a firm override that lets analysts approve is honoured', async () => {
  mockCurrent.tables.org_permissions.push({ org_id: 'org-1', role: 'analyst', permission_key: 'pipeline.move_approved', allowed: true });
  const r = await move('analyst-1', 'Approved');
  expect(r.statusCode).toBe(200);
});

test('a stage that does not exist is refused', async () => {
  const r = await move('cc-1', 'Won');
  expect(r.statusCode).toBe(400);
});

test('another firm\'s deal is not found and not moved', async () => {
  const r = await move('other-1', 'Declined');
  expect(r.statusCode).toBe(404);
  expect(mockCurrent.tables.pipeline_deals[0].stage).toBe('Under Review');
});

test('moving to the same stage changes nothing and fires nothing', async () => {
  const r = await move('cc-1', 'Under Review');
  expect(r.statusCode).toBe(200);
  expect(mockCurrent.tables.audit_log).toEqual([]);
  expect(mockDispatch).not.toHaveBeenCalled();
});
