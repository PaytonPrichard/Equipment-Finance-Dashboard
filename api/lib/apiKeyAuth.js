// ============================================================
// API Key Authentication — validates X-API-Key header
// ============================================================

const crypto = require('crypto');
const { supabaseAdmin } = require('./supabaseAdmin');

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Authenticate a request using X-API-Key header.
 * Returns { orgId, keyId } on success, null on failure.
 * Also updates last_used_at timestamp (fire-and-forget).
 */
async function authenticateApiKey(req) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !apiKey.startsWith('trn_')) return null;

  const hash = hashKey(apiKey);

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, org_id')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .single();

  if (error || !data) return null;

  // Update last_used_at (fire and forget)
  supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})
    .catch(() => {});

  return { orgId: data.org_id, keyId: data.id };
}

/**
 * Generate a new API key.
 * Returns { key, prefix, hash } — key is shown once, only hash is stored.
 */
function generateApiKey() {
  const random = crypto.randomBytes(24).toString('hex');
  const key = `trn_${random}`;
  const prefix = key.slice(0, 12);
  const hash = hashKey(key);
  return { key, prefix, hash };
}

module.exports = { authenticateApiKey, generateApiKey, hashKey };
