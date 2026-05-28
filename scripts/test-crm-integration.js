#!/usr/bin/env node
// End-to-end test of the CRM integration surface against a deployed Tranche env.
// Exercises: POST/GET/PATCH /api/v1?resource=deals, webhook delivery,
// HMAC signature presence (and verification if WEBHOOK_SECRET provided),
// auth failure paths.
//
// Scope: this tests the public X-API-Key surface only. The in-app browser
// scoring path (JWT-authenticated, hits /api/score-deal) is not covered here.
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
  // Inputs must satisfy server-side validation (P0-2). asset_class drives
  // server-side score recomputation (P0-1) — client-supplied scores are ignored.
  const createPayload = {
    name: testName,
    asset_class: 'equipment_finance',
    inputs: {
      companyName: 'CRM Test Co',
      yearsInBusiness: 10,
      annualRevenue: 50_000_000,
      ebitda: 8_000_000,
      totalExistingDebt: 15_000_000,
      industrySector: 'Manufacturing',
      creditRating: 'Adequate',
      equipmentType: 'Heavy Machinery',
      equipmentCondition: 'New',
      equipmentCost: 5_000_000,
      downPayment: 500_000,
      financingType: 'EFA',
      usefulLife: 15,
      loanTerm: 84,
      essentialUse: true,
    },
  };

  function isSensibleScore(s) {
    return typeof s === 'number' && Number.isFinite(s) && s >= 0 && s <= 100;
  }
  const createStart = Date.now();
  const create = await api('POST', '/api/v1?resource=deals&debug=1', createPayload);
  if (create.data?._webhook_dispatch) {
    console.log(`  (dispatch: ${JSON.stringify(create.data._webhook_dispatch)})`);
  }
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
    log('Body data.stage is Screening and score is a sensible number', body?.data?.stage === 'Screening' && isSensibleScore(body?.data?.score));

    if (WEBHOOK_SECRET && sig) {
      const ok = verifySignature(createdWebhook.content, sig, WEBHOOK_SECRET);
      log('HMAC signature verifies against WEBHOOK_SECRET', ok);
    }
  }

  // ── Webhook: deal.scored on creation (score present) ─────
  section('Webhook delivery: deal.scored on create');
  const scoredOnCreate = await waitForWebhook((r) => {
    const event = headerValue(r.headers, 'x-tranche-event');
    const ts = new Date(r.created_at).getTime();
    if (event !== 'deal.scored' || ts < createStart - 5000) return false;
    let body;
    try { body = JSON.parse(r.content); } catch { return false; }
    return String(body?.data?.id) === dealId;
  }, 'deal.scored (on create)');
  log('deal.scored webhook delivered on POST (always fires after P0-1)', !!scoredOnCreate);
  if (scoredOnCreate) {
    let body;
    try { body = JSON.parse(scoredOnCreate.content); } catch { body = null; }
    log('Scored webhook (create) body has a sensible server-computed score', isSensibleScore(body?.data?.score));
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
  const patchStage = await api('PATCH', `/api/v1?resource=deals&id=${dealId}&debug=1`, { stage: 'Under Review' });
  if (patchStage.data?._webhook_dispatch) {
    console.log(`  (dispatch: ${JSON.stringify(patchStage.data._webhook_dispatch)})`);
  }
  log(
    'PATCH stage returns 200 with new stage',
    patchStage.status === 200 && patchStage.data?.stage === 'Under Review',
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
    log('Stage webhook body has previous_stage and new_stage', body?.data?.previous_stage === 'Screening' && body?.data?.new_stage === 'Under Review');

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

  // ── PATCH inputs change → server recomputes → fires deal.scored ────
  // After P0-1, score is server-computed. To trigger a score change we
  // send modified inputs and let the server recompute.
  section('Update: inputs change recomputes score');
  const scoreStart = Date.now();
  const initialScore = create.data?.score;
  const changedInputs = {
    ...createPayload.inputs,
    equipmentCost: 9_500_000,    // pushes LTV / term-coverage materially
    downPayment: 200_000,
    ebitda: 3_500_000,           // tightens DSCR
  };
  const patchScore = await api('PATCH', `/api/v1?resource=deals&id=${dealId}&debug=1`, { inputs: changedInputs });
  if (patchScore.data?._webhook_dispatch) {
    console.log(`  (dispatch: ${JSON.stringify(patchScore.data._webhook_dispatch)})`);
  }
  log(
    'PATCH inputs returns 200 with sensible server-computed score',
    patchScore.status === 200 && isSensibleScore(patchScore.data?.score),
    `status=${patchScore.status}, score=${patchScore.data?.score}`,
    patchScore.status !== 200 ? patchScore.data : null,
  );
  log(
    'Server-recomputed score differs from initial score (inputs materially changed)',
    isSensibleScore(initialScore) && patchScore.data?.score !== initialScore,
    `initial=${initialScore}, after=${patchScore.data?.score}`,
  );

  const scoreWebhook = await waitForWebhook((r) => {
    const event = headerValue(r.headers, 'x-tranche-event');
    const ts = new Date(r.created_at).getTime();
    if (event !== 'deal.scored' || ts < scoreStart - 1000) return false;
    let body;
    try { body = JSON.parse(r.content); } catch { return false; }
    return String(body?.data?.id) === dealId && isSensibleScore(body?.data?.score) && body.data.score !== initialScore;
  }, 'deal.scored (on PATCH)');
  log('deal.scored webhook delivered on PATCH after inputs change', !!scoreWebhook);

  if (scoreWebhook) {
    let body;
    try { body = JSON.parse(scoreWebhook.content); } catch { body = null; }
    log('Scored webhook (patch) body has sensible new score', isSensibleScore(body?.data?.score));

    if (WEBHOOK_SECRET) {
      const sig = headerValue(scoreWebhook.headers, 'x-tranche-signature');
      const ok = sig && verifySignature(scoreWebhook.content, sig, WEBHOOK_SECRET);
      log('Scored webhook (patch) HMAC verifies', ok);
    }
  }

  // ── PATCH same inputs again → recompute is identical → no deal.scored ──
  section('Update: same inputs (no webhook expected)');
  const beforeUnchanged = (await getWebhookDeliveries()).length;
  await api('PATCH', `/api/v1?resource=deals&id=${dealId}`, { inputs: changedInputs });
  await new Promise((r) => setTimeout(r, 4000));
  const afterUnchanged = (await getWebhookDeliveries()).length;
  log(
    'PATCH with unchanged inputs does not fire deal.scored',
    afterUnchanged === beforeUnchanged,
    `webhooks_before=${beforeUnchanged}, after=${afterUnchanged}`,
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
