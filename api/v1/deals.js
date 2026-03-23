// ============================================================
// Public API: /api/v1/deals
// Authenticated via X-API-Key header
//
// POST   — Create and score a deal
// GET    — List pipeline deals (optional ?id= for single deal)
// PATCH  — Update deal stage or notes (?id= required)
// ============================================================

const { handlePreflight } = require('../lib/cors');
const { authenticateApiKey } = require('../lib/apiKeyAuth');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { dispatchWebhooks } = require('../lib/webhookDispatch');
const { checkRateLimit } = require('../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  // Rate limit
  if (!checkRateLimit(req, res, 'api')) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Authenticate
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return res.status(401).json({ error: 'Invalid or missing API key. Pass X-API-Key header.' });
  }

  const { orgId } = auth;

  // ── POST: Create and score a deal ──────────────────────────
  if (req.method === 'POST') {
    const { name, inputs } = req.body || {};

    if (!name || !inputs) {
      return res.status(400).json({ error: 'name and inputs are required' });
    }

    const score = req.body.score || null;

    // Save to pipeline
    const { data, error } = await supabaseAdmin
      .from('pipeline_deals')
      .insert({
        org_id: orgId,
        user_id: null, // API-created deals have no user
        name,
        stage: 'Screening',
        inputs,
        score,
        notes: '',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create deal', details: error.message });
    }

    // Dispatch webhook
    dispatchWebhooks(orgId, 'deal.created', {
      id: data.id,
      name,
      stage: 'Screening',
      score,
    });

    return res.status(201).json({
      id: data.id,
      name: data.name,
      stage: data.stage,
      score,
      created_at: data.created_at,
    });
  }

  // ── GET: List deals or get by ID ──────────────────────────
  if (req.method === 'GET') {
    const { id, stage, limit = '50', offset = '0' } = req.query || {};

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('pipeline_deals')
        .select('id, name, stage, score, inputs, notes, created_at, updated_at')
        .eq('id', id)
        .eq('org_id', orgId)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Deal not found' });
      }
      return res.status(200).json(data);
    }

    let query = supabaseAdmin
      .from('pipeline_deals')
      .select('id, name, stage, score, created_at, updated_at', { count: 'exact' })
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (stage) {
      query = query.eq('stage', stage);
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch deals', details: error.message });
    }

    return res.status(200).json({
      deals: data || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  }

  // ── PATCH: Update deal stage or notes ─────────────────────
  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    const { stage, notes } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'id query parameter is required' });
    }

    if (!stage && notes === undefined) {
      return res.status(400).json({ error: 'stage or notes is required' });
    }

    // Verify deal belongs to this org
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('pipeline_deals')
      .select('id, stage, name')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (stage) updates.stage = stage;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('pipeline_deals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update deal', details: error.message });
    }

    // Dispatch webhook if stage changed
    if (stage && stage !== existing.stage) {
      dispatchWebhooks(orgId, 'pipeline.stage_changed', {
        id: data.id,
        name: existing.name,
        previous_stage: existing.stage,
        new_stage: stage,
      });
    }

    return res.status(200).json({
      id: data.id,
      name: data.name,
      stage: data.stage,
      score: data.score,
      updated_at: data.updated_at,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
