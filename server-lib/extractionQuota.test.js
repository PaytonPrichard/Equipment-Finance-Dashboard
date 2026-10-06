/**
 * @jest-environment node
 *
 * Run with: npx jest server-lib --testEnvironment node
 */

jest.mock('./supabaseAdmin', () => ({ supabaseAdmin: {} }));

const { claimExtractionQuota, quotaExceededMessage, DAILY_DOCUMENT_LIMIT } = require('./extractionQuota');

function client(result) {
  return { rpc: jest.fn(async () => result) };
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => console.error.mockRestore());

test('claims the number of documents, not requests', async () => {
  const c = client({ data: { allowed: true, used: 4, limit: 40 }, error: null });
  await claimExtractionQuota('user-1', 4, c);
  expect(c.rpc).toHaveBeenCalledWith('claim_extraction_quota', {
    p_user_id: 'user-1',
    p_documents: 4,
    p_limit: DAILY_DOCUMENT_LIMIT,
  });
});

test('passes through a refusal', async () => {
  const c = client({ data: { allowed: false, used: 38, limit: 40 }, error: null });
  await expect(claimExtractionQuota('user-1', 4, c)).resolves.toEqual({ allowed: false, used: 38, limit: 40 });
});

test('a missing migration allows the request rather than breaking extraction', async () => {
  // What PostgREST returns before supabase_extraction_quota.sql is applied.
  const c = client({ data: null, error: { message: 'Could not find the function public.claim_extraction_quota' } });
  await expect(claimExtractionQuota('user-1', 1, c)).resolves.toEqual({ allowed: true, degraded: true });
  expect(console.error).toHaveBeenCalled();
});

test('a thrown error also allows the request, and says so in the log', async () => {
  const c = { rpc: jest.fn(async () => { throw new Error('network'); }) };
  await expect(claimExtractionQuota('user-1', 1, c)).resolves.toEqual({ allowed: true, degraded: true });
  expect(console.error).toHaveBeenCalled();
});

test('the refusal message names the limit and the manual route', () => {
  const msg = quotaExceededMessage(40);
  expect(msg).toContain('40 documents in 24 hours');
  expect(msg).toContain('enter figures by hand');
});
