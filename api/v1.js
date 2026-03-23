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
const { dispatchWebhooks } = require('../server-lib/webhookDispatch');
const { checkRateLimit } = require('../server-lib/rateLimit');

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
  if (!['admin', 'credit_committee'].includes(data.role)) return null;
  return data;
}

// ── Deals (X-API-Key auth) ──────────────────────────────────
async function handleDeals(req, res) {
  if (!checkRateLimit(req, res, 'api')) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const auth = await authenticateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: 'Invalid or missing API key. Pass X-API-Key header.' });
  }
  const { orgId } = auth;

  if (req.method === 'POST') {
    const { name, inputs } = req.body || {};
    if (!name || !inputs) return res.status(400).json({ error: 'name and inputs are required' });
    const score = req.body.score || null;

    const { data, error } = await supabaseAdmin
      .from('pipeline_deals')
      .insert({ org_id: orgId, user_id: null, name, stage: 'Screening', inputs, score, notes: '' })
      .select().single();
    if (error) return res.status(500).json({ error: 'Failed to create deal', details: error.message });

    dispatchWebhooks(orgId, 'deal.created', { id: data.id, name, stage: 'Screening', score });
    return res.status(201).json({ id: data.id, name: data.name, stage: data.stage, score, created_at: data.created_at });
  }

  if (req.method === 'GET') {
    const { id, stage, limit = '50', offset = '0' } = req.query || {};
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('pipeline_deals')
        .select('id, name, stage, score, inputs, notes, created_at, updated_at')
        .eq('id', id).eq('org_id', orgId).single();
      if (error || !data) return res.status(404).json({ error: 'Deal not found' });
      return res.status(200).json(data);
    }
    let query = supabaseAdmin.from('pipeline_deals')
      .select('id, name, stage, score, created_at, updated_at', { count: 'exact' })
      .eq('org_id', orgId).order('updated_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    if (stage) query = query.eq('stage', stage);
    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: 'Failed to fetch deals' });
    return res.status(200).json({ deals: data || [], total: count || 0, limit: parseInt(limit), offset: parseInt(offset) });
  }

  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    const { stage, notes } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id query parameter is required' });
    if (!stage && notes === undefined) return res.status(400).json({ error: 'stage or notes is required' });

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('pipeline_deals').select('id, stage, name').eq('id', id).eq('org_id', orgId).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Deal not found' });

    const updates = { updated_at: new Date().toISOString() };
    if (stage) updates.stage = stage;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('pipeline_deals').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: 'Failed to update deal' });

    if (stage && stage !== existing.stage) {
      dispatchWebhooks(orgId, 'pipeline.stage_changed', { id: data.id, name: existing.name, previous_stage: existing.stage, new_stage: stage });
    }
    return res.status(200).json({ id: data.id, name: data.name, stage: data.stage, score: data.score, updated_at: data.updated_at });
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
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

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
    if (url) { try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); } updates.url = url; }
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

// ── Router ──────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  const { resource } = req.query || {};

  switch (resource) {
    case 'deals': return handleDeals(req, res);
    case 'keys': return handleKeys(req, res);
    case 'webhooks': return handleWebhooks(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid resource parameter',
        usage: '/api/v1?resource=deals|keys|webhooks',
      });
  }
};
