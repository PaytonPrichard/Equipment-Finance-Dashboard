// ============================================================
// Per-user extraction quota.
//
// Every document sent to /api/parse-deal is one model call. The in-memory
// limiter stops a burst on one instance; this caps a user across instances
// and cold starts, in Postgres. See supabase/migrations/supabase_extraction_quota.sql.
//
// If the quota check itself fails (most likely: the migration has not been
// applied yet), the request is allowed and the failure logged. Failing
// closed would turn a missing migration into an extraction outage for every
// customer. The burst limiter still applies either way.
// ============================================================

const { supabaseAdmin } = require('./supabaseAdmin');

// Forty documents is ten full deal sets of four. Overridable per
// environment without a deploy of code.
const DAILY_DOCUMENT_LIMIT = Number(process.env.EXTRACTION_DAILY_DOCUMENTS) || 40;

/**
 * Claim `documents` against the user's rolling 24-hour allowance.
 * Resolves { allowed, used, limit } and, when the check could not run,
 * { allowed: true, degraded: true }.
 */
async function claimExtractionQuota(userId, documents, client = supabaseAdmin) {
  try {
    const { data, error } = await client.rpc('claim_extraction_quota', {
      p_user_id: userId,
      p_documents: documents,
      p_limit: DAILY_DOCUMENT_LIMIT,
    });
    if (error || !data || typeof data.allowed !== 'boolean') {
      console.error('[extractionQuota] check failed, allowing request:', error?.message || data);
      return { allowed: true, degraded: true };
    }
    return { allowed: data.allowed, used: data.used, limit: data.limit };
  } catch (err) {
    console.error('[extractionQuota] check threw, allowing request:', err?.message || err);
    return { allowed: true, degraded: true };
  }
}

function quotaExceededMessage(limit) {
  return `You have reached the extraction limit of ${limit} documents in 24 hours. ` +
    'You can still enter figures by hand. The allowance frees up as the day rolls over.';
}

module.exports = { claimExtractionQuota, quotaExceededMessage, DAILY_DOCUMENT_LIMIT };
