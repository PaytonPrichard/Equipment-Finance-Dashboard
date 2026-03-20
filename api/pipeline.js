// ============================================================
// /api/pipeline — Pipeline CRUD with role-based stage enforcement
// Vercel serverless function (Node.js / CommonJS)
// ============================================================

const { supabaseAdmin } = require('./lib/supabaseAdmin');
const { validateDealInputs } = require('./lib/validate');
const { handlePreflight } = require('./lib/cors');
const { checkRateLimit } = require('./lib/rateLimit');
const { checkPlanStatus } = require('./lib/planCheck');

// Roles permitted to move deals into certain pipeline stages
const STAGE_ROLE_REQUIREMENTS = {
  Approved: ['senior_analyst', 'credit_committee', 'admin'],
  Funded: ['credit_committee', 'admin'],
  Declined: ['senior_analyst', 'credit_committee', 'admin'],
};

// Roles allowed to delete deals they do not own
const DELETE_PRIVILEGED_ROLES = ['credit_committee', 'admin'];

/**
 * Extract and verify the Supabase JWT from the Authorization header.
 * Returns the authenticated user or null.
 */
async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}

/**
 * Fetch the user's role from the profiles table.
 */
async function getUserRole(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data.role;
}

/**
 * Write an entry to the audit_log table.
 */
async function writeAuditLog({ userId, action, resourceType, resourceId, details }) {
  const { error } = await supabaseAdmin
    .from('audit_log')
    .insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details || null,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('audit_log write error:', error);
  }
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (!checkRateLimit(req, res)) {
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  // ---- Authenticate ----
  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRole = await getUserRole(user.id);

  // ---- Plan expiry check (blocks writes on expired plans) ----
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    const planStatus = await checkPlanStatus(user.id);
    if (planStatus.expired) {
      return res.status(403).json({ error: planStatus.message });
    }
  }

  // ===================== POST — Create a pipeline deal =====================
  if (req.method === 'POST') {
    const { inputs, deal_name, stage, notes } = req.body || {};

    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ error: 'Request body must include an "inputs" object' });
    }

    // Sanitize text fields
    if (deal_name && (typeof deal_name !== 'string' || deal_name.length > 200)) {
      return res.status(400).json({ error: 'Deal name must be a string under 200 characters' });
    }
    if (notes && (typeof notes !== 'string' || notes.length > 5000)) {
      return res.status(400).json({ error: 'Notes must be a string under 5000 characters' });
    }

    // Server-side validation of deal inputs
    const validation = validateDealInputs(inputs);
    if (!validation.valid) {
      return res.status(422).json({
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    const initialStage = stage || 'Prospect';

    // If the initial stage requires elevated permissions, check role
    if (STAGE_ROLE_REQUIREMENTS[initialStage]) {
      const allowedRoles = STAGE_ROLE_REQUIREMENTS[initialStage];
      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: `Role '${userRole || 'none'}' is not permitted to create a deal in stage '${initialStage}'`,
          required_roles: allowedRoles,
        });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('pipeline_deals')
      .insert({
        user_id: user.id,
        deal_name: deal_name || inputs.companyName || 'Untitled Deal',
        stage: initialStage,
        inputs,
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('pipeline POST insert error:', error);
      return res.status(500).json({ error: 'Failed to create pipeline deal', details: error.message });
    }

    await writeAuditLog({
      userId: user.id,
      action: 'pipeline.create',
      resourceType: 'pipeline_deal',
      resourceId: data.id,
      details: { stage: initialStage, deal_name: data.deal_name },
    });

    return res.status(201).json({ deal: data });
  }

  // ===================== PATCH — Update pipeline stage =====================
  if (req.method === 'PATCH') {
    const { id, stage, notes } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'Pipeline deal id is required' });
    }

    if (!stage) {
      return res.status(400).json({ error: 'Target stage is required' });
    }

    // Verify the deal exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('pipeline_deals')
      .select('id, user_id, stage')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Pipeline deal not found' });
    }

    // Check role-based permission for protected stages
    if (STAGE_ROLE_REQUIREMENTS[stage]) {
      const allowedRoles = STAGE_ROLE_REQUIREMENTS[stage];
      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: `Role '${userRole || 'none'}' is not permitted to move a deal to stage '${stage}'`,
          required_roles: allowedRoles,
        });
      }
    }

    const previousStage = existing.stage;

    const updateFields = {
      stage,
      updated_at: new Date().toISOString(),
    };
    if (notes !== undefined) {
      updateFields.notes = notes;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('pipeline_deals')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('pipeline PATCH error:', updateError);
      return res.status(500).json({ error: 'Failed to update pipeline deal', details: updateError.message });
    }

    await writeAuditLog({
      userId: user.id,
      action: 'pipeline.stage_change',
      resourceType: 'pipeline_deal',
      resourceId: id,
      details: { previous_stage: previousStage, new_stage: stage },
    });

    return res.status(200).json({ deal: updated });
  }

  // ===================== DELETE — Remove a pipeline deal =====================
  if (req.method === 'DELETE') {
    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'Pipeline deal id is required' });
    }

    // Verify the deal exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('pipeline_deals')
      .select('id, user_id, stage, deal_name')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Pipeline deal not found' });
    }

    // Must be the owner OR have a privileged role
    const isOwner = existing.user_id === user.id;
    const hasPrivilege = userRole && DELETE_PRIVILEGED_ROLES.includes(userRole);

    if (!isOwner && !hasPrivilege) {
      return res.status(403).json({ error: 'You do not have permission to delete this pipeline deal' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('pipeline_deals')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('pipeline DELETE error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete pipeline deal', details: deleteError.message });
    }

    await writeAuditLog({
      userId: user.id,
      action: 'pipeline.delete',
      resourceType: 'pipeline_deal',
      resourceId: id,
      details: { deal_name: existing.deal_name, stage: existing.stage },
    });

    return res.status(200).json({ success: true, deleted: id });
  }

  // ---- Method not allowed ----
  res.setHeader('Allow', 'POST, PATCH, DELETE, OPTIONS');
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
