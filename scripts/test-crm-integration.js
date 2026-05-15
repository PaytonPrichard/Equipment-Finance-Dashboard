#!/usr/bin/env node
// End-to-end test of the CRM integration surface against a deployed Tranche env.
// Exercises: POST/GET/PATCH /api/v1?resource=deals, webhook delivery,
// HMAC signature presence (and verification if WEBHOOK_SECRET provided),
// auth failure paths.
//
// Usage:
//   TRANCHE_API_KEY=trn_... \
//   WEBHOOK_SITE_TOKEN=<webhook.site uuid> \
//   [WEBHOOK_SECRET=whsec_...] \
//   [TRANCHE_BASE_URL=https://gettranche.app] \
//   node scripts/test-crm-integration.js

const crypto = require('crypto');

const API_KEY = process.env.TRANCHE_API_KEY;
const BASE_URL = process.env.TRANCHE_BASE_URL || 'https://gettranche.app';
const WEBHOOK_TOKEN = process.env.WEBHOOK_SITE_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || null;

if (!API_KEY || !WEBHOOK_TOKEN) {
  console.error('TRANCHE_API_KEY and WEBHOOK_SITE_TOKEN are required');
  process.exit(1);
}

let passed = 0;
let failed = 0;
const failures = [];

function log(name, ok, details = '', responseBody = null) {
  const symbol = ok ? 'PASS' : 'FAIL';
  console.log(`  [${symbol}] ${name}${details ? '  (' + details + ')' : ''}`);
  if (!ok && responseBody) {
    console.log('         response: ' + JSON.stringify(responseBody));
  }
  if (ok) passed++;
  else {
    failed++;
    failures.push({ name, details });
  }
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function getWebhookDeliveries() {
  const res = await fetch(`https://webhook.site/token/${WEBHOOK_TOKEN}/requests?sorting=newest&per_page=20`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

function headerValue(headers, name) {
  if (!headers) return null;
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) {
      const v = headers[k];
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return null;
}

async function waitForWebhook(predicate, label, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const deliveries = await getWebhookDeliveries();
    const match = deliveries.find(predicate);
    if (match) return match;
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`  (timed out waiting for ${label} after ${timeoutMs}ms)`);
  return null;
}

function verifySignature(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return signature === expected;
}

function section(title) {
  console.log(`\n${title}`);
}

(async () => {
  const runStartIso = new Date().toISOString();
  console.log('CRM Integration Test');
  console.log('─────────────────────────────────────────────');
  console.log(`Target:        ${BASE_URL}`);
  console.log(`API key:       ${String(API_KEY).slice(0, 12)}…`);
  console.log(`Webhook token: webhook.site/${WEBHOOK_TOKEN}`);
  console.log(`HMAC verify:   ${WEBHOOK_SECRET ? 'enabled (secret provided)' : 'format only (no secret)'}`);
  console.log(`Run started:   ${runStartIso}`);

  // ── Auth failure paths ──────────────────────────────────
  section('Auth');
  const badKey = await fetch(`${BASE_URL}/api/v1?resource=deals`, {
    method: 'GET',
    headers: { 'X-API-Key': 'trn_invalid_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  });
  log('Invalid X-API-Key returns 401', badKey.status === 401, `status=${badKey.status}`);

  const noKey = await fetch(`${BASE_URL}/api/v1?resource=deals`, { method: 'GET' });
  log('Missing X-API-Key returns 401', noKey.status === 401, `status=${noKey.status}`);

  // ── Create deal ─────────────────────────────────────────
  section('Create deal');
  const testName = `CRM Integration Test ${new Date().toISOString().slice(11, 19)}Z`;
  const createPayload = {
    name: testName,
    inputs: {
      industryClass: 'Industrial',
      equipmentType: 'CNC Machine',
      financingAmount: 250000,
      termMonths: 60,
      creditScore: 720,
    },
    score: 75,
  };
  const createStart = Date.now();
  const create = await api('POST', '/api/v1?resource=deals', createPayload);
  const dealId = create.data?.id != null ? String(create.data.id) : null;
  log(
    'POST /api/v1?resource=deals returns 201 with id',
    create.status === 201 && !!dealId,
    `status=${create.status}${dealId ? ', id=' + dealId.slice(0, 8) : ''}`,
  );

  if (create.status !== 201 || !dealId) {
    console.log('\n  Cannot continue without a created deal. Response body:');
    console.log('  ' + JSON.stringify(create.data));
    process.exit(1);
  }
  log('Returned deal has stage="Screening"', create.data?.stage === 'Screening', `stage="${create.data?.stage}"`);
  log('Returned deal echoes name', create.data?.name === testName);

  // ── Missing fields validation ───────────────────────────
  const missingFields = await api('POST', '/api/v1?resource=deals', { name: 'Missing inputs' });
  log('POST with missing inputs returns 400', missingFields.status === 400, `status=${missingFields.status}`);

  // ── Webhook: deal.created ───────────────────────────────
  section('Webhook delivery: deal.created');
  const createdWebhook = await waitForWebhook((r) => {
    const event = headerValue(r.headers, 'x-tranche-event');
    const ts = new Date(r.created_at).getTime();
    return event === 'deal.created' && ts >= createStart - 5000;
  }, 'deal.created');
  log('deal.created webhook delivered to webhook.site', !!createdWebhook);

  if (createdWebhook) {
    const sig = headerValue(createdWebhook.headers, 'x-tranche-signature');
    log('X-Tranche-Signature header present', !!sig, sig ? sig.slice(0, 16) + '…' : 'missing');
    log('Signature is 64-char hex (SHA-256)', !!sig && /^[a-f0-9]{64}$/.test(sig));

    let body;
    try { body = JSON.parse(createdWebhook.content); } catch { body = null; }
    log('Body parses as JSON', !!body);
    log('Body has event="deal.created"', body?.event === 'deal.created');
    log('Body data.id matches created deal id', String(body?.data?.id) === dealId);
    log('Body data has stage and score fields', body?.data?.stage === 'Screening' && body?.data?.score === 75);

    if (WEBHOOK_SECRET && sig) {
      const ok = verifySignature(createdWebhook.content, sig, WEBHOOK_SECRET);
      log('HMAC signature verifies against WEBHOOK_SECRET', ok);
    }
  }

  // ── GET deal ────────────────────────────────────────────
  section('Read');
  const getOne = await api('GET', `/api/v1?resource=deals&id=${dealId}`);
  log(
    'GET single deal by id returns 200 + matching deal',
    getOne.status === 200 && String(getOne.data?.id) === dealId,
    `status=${getOne.status}`,
  );
  log('GET single deal returns inputs payload', !!getOne.data?.inputs?.equipmentType);

  const list = await api('GET', '/api/v1?resource=deals&limit=20');
  log(
    'GET deal list returns 200 + array',
    list.status === 200 && Array.isArray(list.data?.deals),
    `count=${list.data?.deals?.length}, total=${list.data?.total}`,
  );
  log('Deal list includes the new deal', list.data?.deals?.some((d) => String(d.id) === dealId));

  // ── PATCH stage (fires webhook) ─────────────────────────
  section('Update: stage change');
  const stageStart = Date.now();
  const patchStage = await api('PATCH', `/api/v1?resource=deals&id=${dealId}`, { stage: 'Underwriting' });
  log(
    'PATCH stage returns 200 with new stage',
    patchStage.status === 200 && patchStage.data?.stage === 'Underwriting',
    `status=${patchStage.status}, stage="${patchStage.data?.stage}"`,
    patchStage.status !== 200 ? patchStage.data : null,
  );

  const stageWebhook = await waitForWebhook((r) => {
    const event = headerValue(r.headers, 'x-tranche-event');
    const ts = new Date(r.created_at).getTime();
    return event === 'pipeline.stage_changed' && ts >= stageStart - 1000;
  }, 'pipeline.stage_changed');
  log('pipeline.stage_changed webhook delivered', !!stageWebhook);

  if (stageWebhook) {
    let body;
    try { body = JSON.parse(stageWebhook.content); } catch { body = null; }
    log('Stage webhook body has previous_stage and new_stage', body?.data?.previous_stage === 'Screening' && body?.data?.new_stage === 'Underwriting');

    if (WEBHOOK_SECRET) {
      const sig = headerValue(stageWebhook.headers, 'x-tranche-signature');
      const ok = sig && verifySignature(stageWebhook.content, sig, WEBHOOK_SECRET);
      log('Stage webhook HMAC verifies', ok);
    }
  }

  // ── PATCH notes only (should NOT fire a webhook) ────────
  section('Update: notes only (no webhook expected)');
  const beforeNotes = (await getWebhookDeliveries()).length;
  await api('PATCH', `/api/v1?resource=deals&id=${dealId}`, { notes: 'Updated by test script' });
  await new Promise((r) => setTimeout(r, 4000));
  const afterNotes = (await getWebhookDeliveries()).length;
  log(
    'Notes-only PATCH does not fire a webhook',
    afterNotes === beforeNotes,
    `webhooks_before=${beforeNotes}, after=${afterNotes}`,
  );

  // ── Confirm gap: deal.scored is never fired ─────────────
  section('Documented gap: deal.scored');
  const allDeliveries = await getWebhookDeliveries();
  const scoredEvents = allDeliveries.filter((r) => headerValue(r.headers, 'x-tranche-event') === 'deal.scored');
  log(
    'deal.scored is never fired (confirms code review finding)',
    scoredEvents.length === 0,
    `deliveries_with_event_deal.scored=${scoredEvents.length}`,
  );

  // ── Summary ─────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}${f.details ? '  (' + f.details + ')' : ''}`);
  }
  console.log(`\nTest deal: ${String(dealId)}  ("${testName}")`);
  console.log('Delete it from the Tranche pipeline tab when done.\n');
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
