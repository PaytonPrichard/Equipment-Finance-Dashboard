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
const { recomputeScore, VALID_ASSET_CLASSES } = require('./_scoring.cjs');
const { validateDealInputs, validateARInputs, validateInventoryInputs } = require('../server-lib/validate');

function validateInputs(assetClass, inputs) {
  if (assetClass === 'accounts_receivable') return validateARInputs(inputs);
  if (assetClass === 'inventory_finance') return validateInventoryInputs(inputs);
  return validateDealInputs(inputs);
}

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
    // Client-supplied `score` is intentionally ignored: the server is the
    // authoritative scorer. `asset_class` defaults to equipment_finance to
    // match the DB column default.
    const { name, inputs, notes = '', asset_class = 'equipment_finance' } = req.body || {};

    if (!name || typeof name !== 'string' || name.length > 200) {
      return res.status(400).json({ error: 'name is required (string, max 200 chars)' });
    }
    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ error: 'inputs is required (object)' });
    }
    if (typeof notes !== 'string' || notes.length > 5000) {
      return res.status(400).json({ error: 'notes must be a string under 5000 chars' });
    }
    if (!VALID_ASSET_CLASSES.includes(asset_class)) {
      return res.status(400).json({
        error: `Invalid asset_class. Valid: ${VALID_ASSET_CLASSES.join(', ')}`,
      });
    }

    const validation = validateInputs(asset_class, inputs);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid inputs', errors: validation.errors });
    }

    const { score, error: scoreError } = await recomputeScore(asset_class, inputs);
    if (scoreError) {
      return res.status(400).json({ error: scoreError });
    }

    const { data, error } = await supabaseAdmin
      .from('pipeline_deals')
      .insert({
        org_id: orgId,
        user_id: user.id,
        name,
        stage: 'Screening',
        inputs,
        asset_class,
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
      newValues: { name, stage: 'Screening', inputs, score, asset_class },
    });

    // Every created deal now has a server-computed score, so deal.scored
    // always fires alongside deal.created. Payload shape unchanged.
    await Promise.all([
      dispatchWebhooks(orgId, 'deal.created', {
        id: data.id, name: data.name, stage: data.stage, score: data.score,
      }),
      dispatchWebhooks(orgId, 'deal.scored', {
        id: data.id, name: data.name, stage: data.stage, score: data.score,
      }),
    ]);

    return res.status(201).json({ deal: data });
  }

  // ===================== PATCH — Re-score an existing deal =====================
  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id query parameter is required' });

    // Client-supplied `score` is ignored. To re-score, send inputs;
    // the server recomputes against the deal's stored asset_class.
    const { inputs } = req.body || {};
    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ error: 'inputs is required (score is server-computed)' });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('pipeline_deals')
      .select('id, org_id, name, stage, inputs, score, asset_class')
      .eq('id', id)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Deal not found' });
    if (existing.org_id !== orgId) return res.status(403).json({ error: 'Deal does not belong to your organization' });

    const assetClass = existing.asset_class || 'equipment_finance';
    const validation = validateInputs(assetClass, inputs);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid inputs', errors: validation.errors });
    }
    const { score: computedScore, error: scoreError } = await recomputeScore(assetClass, inputs);
    if (scoreError) {
      return res.status(400).json({ error: scoreError });
    }

    const updates = {
      updated_at: new Date().toISOString(),
      inputs,
      score: computedScore,
    };

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

    if (data.score !== existing.score) {
      await dispatchWebhooks(orgId, 'deal.scored', {
        id: data.id, name: data.name, stage: data.stage, score: data.score,
      });
    }

    return res.status(200).json({ deal: data });
  }

  res.setHeader('Allow', 'POST, PATCH, OPTIONS');
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
