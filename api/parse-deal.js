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
const { extractDealSheetSet, SUPPORTED_MODULES } = require('../server-lib/extract');

// A deal arrives as a set: an application, financials, a quote, a cover
// email. Four is enough for that and keeps the fan-out bounded.
const MAX_FILES = 4;

// Vercel function bodies now accept up to 100MB, so the old 4.5MB ceiling
// no longer binds. These caps are set by what is sane to send an extraction
// model, not by the platform: base64 inflates ~33%, so 4MB encoded is a
// ~3MB document.
const MAX_FILE_BASE64_CHARS = 4 * 1024 * 1024;
const MAX_TOTAL_BASE64_CHARS = 16 * 1024 * 1024;

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

  const { asset_class = 'equipment_finance', files } = req.body || {};

  if (!SUPPORTED_MODULES.includes(asset_class)) {
    return res.status(400).json({
      error: `Deal sheet parsing is not yet supported for this asset class. Supported: ${SUPPORTED_MODULES.join(', ')}`,
    });
  }

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      error: 'files is required: [{ name, media_type, data (base64) }]',
    });
  }
  if (files.length > MAX_FILES) {
    return res.status(400).json({ error: `Too many files. Maximum is ${MAX_FILES} per deal.` });
  }

  let totalChars = 0;
  for (const file of files) {
    if (!file || typeof file !== 'object' || typeof file.data !== 'string' || typeof file.media_type !== 'string') {
      return res.status(400).json({ error: 'Each file needs { name, media_type, data (base64) }' });
    }
    if (file.data.length > MAX_FILE_BASE64_CHARS) {
      const label = typeof file.name === 'string' && file.name ? `"${file.name}"` : 'A file';
      return res.status(413).json({ error: `${label} is too large. Maximum is about 3MB per document.` });
    }
    totalChars += file.data.length;
  }
  if (totalChars > MAX_TOTAL_BASE64_CHARS) {
    return res.status(413).json({ error: 'Those documents are too large together. Maximum is about 12MB per upload.' });
  }

  const result = await extractDealSheetSet({ moduleKey: asset_class, files });

  if (result.error) {
    return res.status(422).json({ error: result.error });
  }

  // Every document failing is an outage, not a per-document problem, so it
  // reads as an error rather than as four empty results.
  if (result.documents.every((d) => d.error)) {
    return res.status(422).json({
      error: result.documents[0].error,
      documents: result.documents,
    });
  }

  return res.status(200).json({ documents: result.documents });
};
