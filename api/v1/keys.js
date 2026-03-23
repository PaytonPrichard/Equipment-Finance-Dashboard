// ============================================================
// API Key Management: /api/v1/keys
// Authenticated via Bearer JWT (admin only)
//
// GET    — List API keys for org
// POST   — Create new API key
// DELETE — Revoke an API key (?id= required)
// ============================================================

const { handlePreflight } = require('../lib/cors');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { generateApiKey } = require('../lib/apiKeyAuth');

async function getUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function getProfile(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('org_id, role')
    .eq('id', userId)
    .single();
  return data;
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const profile = await getProfile(user.id);
  if (!profile?.org_id) {
    return res.status(403).json({ error: 'No organization found' });
  }

  // Admin only
  if (!['admin', 'credit_committee'].includes(profile.role)) {
    return res.status(403).json({ error: 'Admin access required to manage API keys' });
  }

  const orgId = profile.org_id;

  // ── GET: List keys ────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch keys' });
    }

    return res.status(200).json({ keys: data || [] });
  }

  // ── POST: Create key ──────────────────────────────────────
  if (req.method === 'POST') {
    const { name = 'Default' } = req.body || {};

    // Limit to 5 active keys per org
    const { count } = await supabaseAdmin
      .from('api_keys')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .is('revoked_at', null);

    if (count >= 5) {
      return res.status(400).json({ error: 'Maximum 5 active API keys per organization' });
    }

    const { key, prefix, hash } = generateApiKey();

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        org_id: orgId,
        name,
        key_prefix: prefix,
        key_hash: hash,
        created_by: user.id,
      })
      .select('id, name, key_prefix, created_at')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create key', details: error.message });
    }

    // Return the full key ONCE — it cannot be retrieved again
    return res.status(201).json({
      ...data,
      key, // full key — shown only on creation
      message: 'Save this key now. It cannot be retrieved again.',
    });
  }

  // ── DELETE: Revoke key ────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: 'id query parameter is required' });
    }

    const { error } = await supabaseAdmin
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      return res.status(500).json({ error: 'Failed to revoke key' });
    }

    return res.status(200).json({ revoked: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
