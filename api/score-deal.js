// ============================================================
// /api/score-deal — JWT-auth endpoint for in-app deal creation
// and re-scoring. Owns the write + audit + webhook dispatch path
// for pipeline_deals so deal.created and deal.scored fire reliably
// regardless of which UI surface triggered the score.
// Vercel serverless function (Node.js / CommonJS)
// ============================================================

const { supabaseAdmin } = require('../server-lib/supabaseAdmin');
const { handlePreflight } = require('../server-lib/cors');
const { checkRateLimit } = require('../server-lib/rateLimit');
const { checkPlanStatus } = require('../server-lib/planCheck');
const { dispatchWebhooks } = require('../server-lib/webhookDispatch');

async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function getProfile(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .single();
  return data || null;
}

async function writeAuditLog({ userId, orgId, action, dealId, oldValues, newValues }) {
  const { error } = await supabaseAdmin
    .from('audit_log')
    .insert({
      user_id: userId,
      org_id: orgId,
      action,
      entity_type: 'pipeline_deal',
      entity_id: dealId,
      old_values: oldValues || null,
      new_values: newValues || null,
    });
  if (error) console.error('[score-deal] audit_log write error:', error.message);
}

function isFiniteNumberOrNull(value) {
  if (value === null || value === undefined) return true;
  return typeof value === 'number' && Number.isFinite(value);
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (!checkRateLimit(req, res, 'default')) {
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const profile = await getProfile(user.id);
  if (!profile?.org_id) return res.status(403).json({ error: 'No organization found for user' });
  const orgId = profile.org_id;

  if (['POST', 'PATCH'].includes(req.method)) {
    const planStatus = await checkPlanStatus(user.id);
    if (planStatus.expired) {
      return res.status(403).json({ error: planStatus.message });
    }
  }

  // ===================== POST — Create a scored deal =====================
  if (req.method === 'POST') {
    const { name, inputs, score = null, notes = '' } = req.body || {};

    if (!name || typeof name !== 'string' || name.length > 200) {
      return res.status(400).json({ error: 'name is required (string, max 200 chars)' });
    }
    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ error: 'inputs is required (object)' });
    }
    if (!isFiniteNumberOrNull(score)) {
      return res.status(400).json({ error: 'score must be a number or null' });
    }
    if (typeof notes !== 'string' || notes.length > 5000) {
      return res.status(400).json({ error: 'notes must be a string under 5000 chars' });
    }

    const { data, error } = await supabaseAdmin
      .from('pipeline_deals')
      .insert({
        org_id: orgId,
        user_id: user.id,
        name,
        stage: 'Screening',
        inputs,
        score,
        notes,
      })
      .select()
      .single();

    if (error) {
      console.error('[score-deal] POST insert error:', error);
      return res.status(500).json({ error: 'Failed to create deal', details: error.message });
    }

    await writeAuditLog({
      userId: user.id,
      orgId,
      action: 'create',
      dealId: data.id,
      newValues: { name, stage: 'Screening', inputs, score },
    });

    const dispatches = [
      dispatchWebhooks(orgId, 'deal.created', {
        id: data.id, name: data.name, stage: data.stage, score: data.score,
      }),
    ];
    if (score !== null && score !== undefined) {
      dispatches.push(dispatchWebhooks(orgId, 'deal.scored', {
        id: data.id, name: data.name, stage: data.stage, score: data.score,
      }));
    }
    await Promise.all(dispatches);

    return res.status(201).json({ deal: data });
  }

  // ===================== PATCH — Re-score an existing deal =====================
  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id query parameter is required' });

    const { inputs, score } = req.body || {};
    if (inputs !== undefined && (typeof inputs !== 'object' || inputs === null)) {
      return res.status(400).json({ error: 'inputs must be an object when present' });
    }
    if (score !== undefined && !isFiniteNumberOrNull(score)) {
      return res.status(400).json({ error: 'score must be a number or null when present' });
    }
    if (inputs === undefined && score === undefined) {
      return res.status(400).json({ error: 'inputs or score is required' });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('pipeline_deals')
      .select('id, org_id, name, stage, inputs, score')
      .eq('id', id)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Deal not found' });
    if (existing.org_id !== orgId) return res.status(403).json({ error: 'Deal does not belong to your organization' });

    const updates = { updated_at: new Date().toISOString() };
    if (inputs !== undefined) updates.inputs = inputs;
    if (score !== undefined) updates.score = score;

    const { data, error } = await supabaseAdmin
      .from('pipeline_deals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[score-deal] PATCH update error:', error);
      return res.status(500).json({ error: 'Failed to update deal', details: error.message });
    }

    await writeAuditLog({
      userId: user.id,
      orgId,
      action: 'update_inputs',
      dealId: data.id,
      oldValues: { inputs: existing.inputs, score: existing.score },
      newValues: { inputs: data.inputs, score: data.score },
    });

    const scoreChanged = score !== undefined && score !== existing.score;
    if (scoreChanged) {
      await dispatchWebhooks(orgId, 'deal.scored', {
        id: data.id, name: data.name, stage: data.stage, score: data.score,
      });
    }

    return res.status(200).json({ deal: data });
  }

  res.setHeader('Allow', 'POST, PATCH, OPTIONS');
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
