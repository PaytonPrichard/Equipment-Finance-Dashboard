// ============================================================
// /api/deals — Deal CRUD with server-side validation
// Vercel serverless function (Node.js / CommonJS)
// ============================================================

const { supabaseAdmin } = require('./lib/supabaseAdmin');
const { validateDealInputs } = require('./lib/validate');
const { handlePreflight } = require('./lib/cors');
const { checkRateLimit } = require('./lib/rateLimit');
const { checkPlanStatus } = require('./lib/planCheck');

/**
 * Extract and verify the Supabase JWT from the Authorization header.
 * Returns the authenticated user object or null.
 */
async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
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

  // ---- Plan expiry check (blocks writes on expired plans) ----
  if (['POST', 'DELETE'].includes(req.method)) {
    const planStatus = await checkPlanStatus(user.id);
    if (planStatus.expired) {
      return res.status(403).json({ error: planStatus.message });
    }
  }

  // ===================== POST — Create / Save a deal =====================
  if (req.method === 'POST') {
    const { inputs, deal_name, notes } = req.body || {};

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

    // Server-side validation
    const validation = validateDealInputs(inputs);
    if (!validation.valid) {
      return res.status(422).json({
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    // Insert into saved_deals
    const { data, error } = await supabaseAdmin
      .from('saved_deals')
      .insert({
        user_id: user.id,
        deal_name: deal_name || inputs.companyName || 'Untitled Deal',
        inputs,
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('deals POST insert error:', error);
      return res.status(500).json({ error: 'Failed to save deal', details: error.message });
    }

    return res.status(201).json({ deal: data });
  }

  // ===================== DELETE — Remove a saved deal =====================
  if (req.method === 'DELETE') {
    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'Deal id is required' });
    }

    // Verify the deal exists and belongs to the authenticated user
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('saved_deals')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this deal' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('saved_deals')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('deals DELETE error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete deal', details: deleteError.message });
    }

    return res.status(200).json({ success: true, deleted: id });
  }

  // ---- Method not allowed ----
  res.setHeader('Allow', 'POST, DELETE, OPTIONS');
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
