// ============================================================
// Public API Router: /api/v1
// Routes by ?resource= query parameter:
//   ?resource=deals   — Deal CRUD (X-API-Key auth)
//   ?resource=keys    — API key management (JWT auth, admin)
//   ?resource=webhooks — Webhook management (JWT auth, admin)
// ============================================================

const crypto = require('crypto');
const { handlePreflight } = require('../server-lib/cors');
const { supabaseAdmin } = require('../server-lib/supabaseAdmin');
const { authenticateApiKey, generateApiKey } = require('../server-lib/apiKeyAuth');
const { dispatchWebhooks, checkWebhookUrl } = require('../server-lib/webhookDispatch');
const { checkOrgPlanStatus } = require('../server-lib/planCheck');
const { checkRateLimit } = require('../server-lib/rateLimit');
const { recomputeScore, VALID_ASSET_CLASSES } = require('./_scoring.cjs');
const { validateDealInputs, validateARInputs, validateInventoryInputs } = require('../server-lib/validate');

function validateInputs(assetClass, inputs) {
  if (assetClass === 'accounts_receivable') return validateARInputs(inputs);
  if (assetClass === 'inventory_finance') return validateInventoryInputs(inputs);
  return validateDealInputs(inputs);
}

const VALID_EVENTS = ['deal.created', 'deal.scored', 'pipeline.stage_changed'];

// ── Helpers ─────────────────────────────────────────────────
async function getUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function getAdminProfile(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('org_id, role')
    .eq('id', userId)
    .single();
  if (!data?.org_id) return null;
  // Admins only (Joel, 2026-10-12). The database already limits reading keys
  // and webhooks to admins, and Settings shows Integrations to admins only.
  if (data.role !== 'admin') return null;
  return data;
}

// ── Deals (X-API-Key auth) ──────────────────────────────────

const STAGES = ['Screening', 'Under Review', 'Approved', 'Funded', 'Declined'];
const MAX_PAGE = 100;

const STATEMENTS_REFUSED = 'Financial statements are not accepted through the API yet. Send the typed fields (annualRevenue, ebitda and so on), or add statements in Tranche.';

const absent = (v) => v === undefined || v === null || v === '';

// A draft deal is created from what a CRM knows (often a name and a size)
// and finished by an analyst in Tranche. It is validated like any deal, but
// a missing field is not an error. It is not scored until it is complete.
function validateDraft(assetClass, inputs) {
  const v = validateInputs(assetClass, inputs);
  const errors = v.errors.filter((e) => !(e.field && e.field !== '_root' && absent(inputs?.[e.field])));
  return { valid: errors.length === 0, errors };
}

// Every API write gets an audit row, like a write from the app. The API
// authenticates a key, not a person, so the row is filed under the admin
// who created the key and names the key in metadata.
async function auditApiWrite(auth, action, dealId, oldValues, newValues) {
  if (!auth.createdBy) {
    console.error(`[v1] audit skipped: API key ${auth.keyId} has no creator on record`);
    return;
  }
  const { error } = await supabaseAdmin.from('audit_log').insert({
    user_id: auth.createdBy,
    org_id: auth.orgId,
    action,
    entity_type: 'pipeline_deal',
    entity_id: dealId,
    old_values: oldValues || null,
    new_values: newValues || null,
    metadata: { via: 'api', apiKeyId: auth.keyId, apiKeyName: auth.keyName, apiKeyPrefix: auth.keyPrefix },
  });
  if (error) console.error('[v1] audit_log write error:', error.message);
}

function pageParam(raw, fallback, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return max ? Math.min(n, max) : n;
}

async function handleDeals(req, res) {
  if (!checkRateLimit(req, res, 'api')) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const auth = await authenticateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: 'Invalid or missing API key. Pass X-API-Key header.' });
  }
  const { orgId } = auth;

  if (['POST', 'PATCH'].includes(req.method)) {
    const plan = await checkOrgPlanStatus(orgId);
    if (plan.expired) return res.status(403).json({ error: plan.message });
  }

  if (req.method === 'POST') {
    // Client-supplied `score` is ignored: server is the authoritative scorer.
    const { name, inputs, asset_class = 'equipment_finance', draft = false } = req.body || {};
    if (!name || !inputs) return res.status(400).json({ error: 'name and inputs are required' });
    if (typeof inputs !== 'object') return res.status(400).json({ error: 'inputs must be an object' });
    if (!VALID_ASSET_CLASSES.includes(asset_class)) {
      return res.status(400).json({
        error: `Invalid asset_class. Valid: ${VALID_ASSET_CLASSES.join(', ')}`,
      });
    }
    if (inputs.financials) return res.status(400).json({ error: STATEMENTS_REFUSED });

    const validation = draft === true ? validateDraft(asset_class, inputs) : validateInputs(asset_class, inputs);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid inputs', errors: validation.errors });
    }
    // A draft that happens to be complete is scored like any deal.
    const complete = draft !== true || validateInputs(asset_class, inputs).valid;
    let score = null;
    if (complete) {
      const r = await recomputeScore(asset_class, inputs);
      if (r.error) return res.status(r.kind === 'request' ? 400 : 500).json({ error: r.error });
      score = r.score;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('pipeline_deals')
      .insert({ org_id: orgId, user_id: null, name, stage: 'Screening', stage_entered_at: now, inputs, asset_class, score, notes: '' })
      .select().single();
    if (error) return res.status(500).json({ error: 'Failed to create deal', details: process.env.NODE_ENV === 'development' ? error.message : undefined });

    await auditApiWrite(auth, 'create', data.id, null, { name, stage: 'Screening', asset_class, inputs, score, draft: !complete });

    const payload = { id: data.id, name, stage: 'Screening', score, draft: !complete };
    const createdResult = await dispatchWebhooks(orgId, 'deal.created', payload);
    // deal.scored fires only when there is a score. A draft fires it later,
    // when an analyst completes and saves it in Tranche.
    const scoredResult = complete ? await dispatchWebhooks(orgId, 'deal.scored', payload) : null;
    const debug = req.query?.debug === '1' ? { _webhook_dispatch: { created: createdResult, scored: scoredResult } } : {};
    return res.status(201).json({ id: data.id, name: data.name, stage: data.stage, score, draft: !complete, created_at: data.created_at, ...debug });
  }

  if (req.method === 'GET') {
    const { id, stage } = req.query || {};
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('pipeline_deals')
        .select('id, name, stage, score, inputs, notes, created_at, updated_at')
        .eq('id', id).eq('org_id', orgId).single();
      if (error || !data) return res.status(404).json({ error: 'Deal not found' });
      return res.status(200).json({ ...data, draft: data.score === null });
    }
    const limit = pageParam(req.query?.limit, 50, MAX_PAGE) || 50;
    const offset = pageParam(req.query?.offset, 0);
    let query = supabaseAdmin.from('pipeline_deals')
      .select('id, name, stage, score, created_at, updated_at', { count: 'exact' })
      .eq('org_id', orgId).order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (stage) query = query.eq('stage', stage);
    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: 'Failed to fetch deals' });
    const deals = (data || []).map((d) => ({ ...d, draft: d.score === null }));
    return res.status(200).json({ deals, total: count || 0, limit, offset });
  }

  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    // Client-supplied `score` is ignored: server recomputes when inputs change.
    const { stage, notes, inputs, draft = false } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id query parameter is required' });
    if (!stage && notes === undefined && inputs === undefined) {
      return res.status(400).json({ error: 'stage, notes, or inputs is required' });
    }
    if (stage !== undefined && !STAGES.includes(stage)) {
      return res.status(400).json({ error: `Invalid stage. Valid: ${STAGES.join(', ')}` });
    }
    if (inputs !== undefined && (typeof inputs !== 'object' || inputs === null)) {
      return res.status(400).json({ error: 'inputs must be an object' });
    }
    if (inputs?.financials) return res.status(400).json({ error: STATEMENTS_REFUSED });

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('pipeline_deals').select('id, stage, name, score, notes, inputs, asset_class').eq('id', id).eq('org_id', orgId).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Deal not found' });
    // A deal built from statements in Tranche is not overwritten with typed
    // fields from outside: that would drop the build and its judgments.
    if (inputs !== undefined && existing.inputs?.financials) {
      return res.status(409).json({ error: 'This deal is built from financial statements in Tranche. Update its inputs there.' });
    }

    const now = new Date().toISOString();
    const updates = { updated_at: now };
    if (stage && stage !== existing.stage) { updates.stage = stage; updates.stage_entered_at = now; }
    if (notes !== undefined) updates.notes = notes;
    if (inputs !== undefined) {
      const assetClass = existing.asset_class || 'equipment_finance';
      // A draft stays a draft until it is complete. A scored deal cannot go
      // back to being a draft.
      const allowDraft = draft === true && existing.score === null;
      const validation = allowDraft ? validateDraft(assetClass, inputs) : validateInputs(assetClass, inputs);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid inputs', errors: validation.errors });
      }
      updates.inputs = inputs;
      if (!allowDraft || validateInputs(assetClass, inputs).valid) {
        const r = await recomputeScore(assetClass, inputs);
        if (r.error) return res.status(r.kind === 'request' ? 400 : 500).json({ error: r.error });
        updates.score = r.score;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('pipeline_deals').update(updates).eq('id', id).eq('org_id', orgId).select().single();
    if (error) return res.status(500).json({ error: 'Failed to update deal', details: process.env.NODE_ENV === 'development' ? error.message : undefined });

    if (updates.stage) {
      await auditApiWrite(auth, 'update_stage', data.id, { stage: existing.stage }, { stage: updates.stage });
    }
    if (notes !== undefined && notes !== existing.notes) {
      await auditApiWrite(auth, 'update', data.id, { notes: existing.notes }, { notes });
    }
    if (inputs !== undefined) {
      await auditApiWrite(auth, 'update', data.id, { inputs: existing.inputs, score: existing.score }, { inputs, score: data.score });
    }

    let stageResult = null;
    let scoredResult = null;
    if (updates.stage) {
      stageResult = await dispatchWebhooks(orgId, 'pipeline.stage_changed', { id: data.id, name: existing.name, previous_stage: existing.stage, new_stage: updates.stage });
    }
    if (updates.score !== undefined && updates.score !== existing.score) {
      scoredResult = await dispatchWebhooks(orgId, 'deal.scored', { id: data.id, name: data.name, stage: data.stage, score: data.score });
    }
    const debug = req.query?.debug === '1' ? { _webhook_dispatch: { stage_changed: stageResult, scored: scoredResult } } : {};
    return res.status(200).json({ id: data.id, name: data.name, stage: data.stage, score: data.score, draft: data.score === null, updated_at: data.updated_at, ...debug });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Keys (JWT auth, admin) ──────────────────────────────────
async function handleKeys(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const profile = await getAdminProfile(user.id);
  if (!profile) return res.status(403).json({ error: 'Admin access required' });
  const orgId = profile.org_id;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('api_keys')
      .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
      .eq('org_id', orgId).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to fetch keys' });
    return res.status(200).json({ keys: data || [] });
  }

  if (req.method === 'POST') {
    const { name = 'Default' } = req.body || {};
    const { count } = await supabaseAdmin.from('api_keys')
      .select('id', { count: 'exact' }).eq('org_id', orgId).is('revoked_at', null);
    if (count >= 5) return res.status(400).json({ error: 'Maximum 5 active API keys per organization' });

    const { key, prefix, hash } = generateApiKey();
    const { data, error } = await supabaseAdmin.from('api_keys')
      .insert({ org_id: orgId, name, key_prefix: prefix, key_hash: hash, created_by: user.id })
      .select('id, name, key_prefix, created_at').single();
    if (error) return res.status(500).json({ error: 'Failed to create key' });
    return res.status(201).json({ ...data, key, message: 'Save this key now. It cannot be retrieved again.' });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id query parameter is required' });
    const { error } = await supabaseAdmin.from('api_keys')
      .update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('org_id', orgId);
    if (error) return res.status(500).json({ error: 'Failed to revoke key' });
    return res.status(200).json({ revoked: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Webhooks (JWT auth, admin) ──────────────────────────────
async function handleWebhooks(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const profile = await getAdminProfile(user.id);
  if (!profile) return res.status(403).json({ error: 'Admin access required' });
  const orgId = profile.org_id;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('webhooks')
      .select('id, url, events, active, created_at, updated_at')
      .eq('org_id', orgId).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to fetch webhooks' });
    return res.status(200).json({ webhooks: data || [] });
  }

  if (req.method === 'POST') {
    const { url, events } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });
    const urlError = checkWebhookUrl(url);
    if (urlError) return res.status(400).json({ error: urlError });

    const selectedEvents = events || VALID_EVENTS;
    const invalid = selectedEvents.filter((e) => !VALID_EVENTS.includes(e));
    if (invalid.length > 0) return res.status(400).json({ error: `Invalid events: ${invalid.join(', ')}` });

    const { count } = await supabaseAdmin.from('webhooks').select('id', { count: 'exact' }).eq('org_id', orgId);
    if (count >= 5) return res.status(400).json({ error: 'Maximum 5 webhooks per organization' });

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const { data, error } = await supabaseAdmin.from('webhooks')
      .insert({ org_id: orgId, url, secret, events: selectedEvents, active: true })
      .select('id, url, events, active, created_at').single();
    if (error) return res.status(500).json({ error: 'Failed to create webhook' });
    return res.status(201).json({ ...data, secret, message: 'Save this signing secret now. It cannot be retrieved again.' });
  }

  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id query parameter is required' });
    const { url, events, active } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (url) {
      const urlError = checkWebhookUrl(url);
      if (urlError) return res.status(400).json({ error: urlError });
      updates.url = url;
    }
    if (events) {
      const inv = events.filter((e) => !VALID_EVENTS.includes(e));
      if (inv.length > 0) return res.status(400).json({ error: `Invalid events: ${inv.join(', ')}` });
      updates.events = events;
    }
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabaseAdmin.from('webhooks')
      .update(updates).eq('id', id).eq('org_id', orgId).select('id, url, events, active, updated_at').single();
    if (error) return res.status(500).json({ error: 'Failed to update webhook' });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id query parameter is required' });
    const { error } = await supabaseAdmin.from('webhooks').delete().eq('id', id).eq('org_id', orgId);
    if (error) return res.status(500).json({ error: 'Failed to delete webhook' });
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Health / keepalive ──────────────────────────────────────
// Hit daily by the Vercel cron (see vercel.json) so the free-tier
// Supabase project never auto-pauses. Unauthenticated by design;
// returns nothing but ok/err and touches the DB with a head count.
async function handleHealth(req, res) {
  if (!checkRateLimit(req, res, 'default')) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const { error } = await supabaseAdmin
      .from('access_requests')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    if (error) {
      console.error('[health] Supabase ping failed:', error.message);
      return res.status(500).json({ ok: false });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[health] Exception:', err.message);
    return res.status(500).json({ ok: false });
  }
}

// ── Router ──────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  const { resource } = req.query || {};

  switch (resource) {
    case 'deals': return handleDeals(req, res);
    case 'keys': return handleKeys(req, res);
    case 'webhooks': return handleWebhooks(req, res);
    case 'health': return handleHealth(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid resource parameter',
        usage: '/api/v1?resource=deals|keys|webhooks',
      });
  }
};
