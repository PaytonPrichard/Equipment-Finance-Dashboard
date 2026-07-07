// ============================================================
// /api/parse-deal — JWT-auth endpoint for deal sheet extraction.
// Accepts an uploaded document, returns extracted module inputs
// for analyst review. Does NOT create or score a deal: the client
// prefills the form and the normal score path stays authoritative.
// Vercel serverless function (Node.js / CommonJS)
// ============================================================

const { supabaseAdmin } = require('../server-lib/supabaseAdmin');
const { handlePreflight } = require('../server-lib/cors');
const { checkRateLimit } = require('../server-lib/rateLimit');
const { checkPlanStatus } = require('../server-lib/planCheck');
const { extractDealSheet, SUPPORTED_MODULES } = require('../server-lib/extract');

// Vercel's request body limit is 4.5MB; base64 inflates ~33%, so cap
// the encoded payload at 4MB (~3MB file). Deal sheets are small.
const MAX_FILE_BASE64_CHARS = 4 * 1024 * 1024;

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

  if (!checkRateLimit(req, res, 'default')) {
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const user = await authenticateRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const planStatus = await checkPlanStatus(user.id);
  if (planStatus.expired) {
    return res.status(403).json({ error: planStatus.message });
  }

  const { asset_class = 'equipment_finance', file } = req.body || {};

  if (!SUPPORTED_MODULES.includes(asset_class)) {
    return res.status(400).json({
      error: `Deal sheet parsing is not yet supported for this asset class. Supported: ${SUPPORTED_MODULES.join(', ')}`,
    });
  }
  if (!file || typeof file !== 'object' || typeof file.data !== 'string' || typeof file.media_type !== 'string') {
    return res.status(400).json({ error: 'file is required: { name, media_type, data (base64) }' });
  }
  if (file.data.length > MAX_FILE_BASE64_CHARS) {
    return res.status(413).json({ error: 'File too large. Maximum size is about 3MB.' });
  }

  const result = await extractDealSheet({
    moduleKey: asset_class,
    mediaType: file.media_type,
    fileBase64: file.data,
  });

  if (result.error) {
    return res.status(422).json({ error: result.error });
  }

  return res.status(200).json({
    inputs: result.inputs,
    found: result.found,
    missing: result.missing,
    warnings: result.warnings,
    notes: result.notes,
  });
};
