// ============================================================
// Server-side plan expiry check
// Returns null if plan is valid, or an error response if expired
// ============================================================

const { supabaseAdmin } = require('./supabaseAdmin');

/**
 * Check if the user's organization has an active plan.
 * Returns { expired: true, message } if expired, or { expired: false, orgId } if valid.
 */
async function checkPlanStatus(userId) {
  // Get user's org
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.org_id) {
    return { expired: false, orgId: null }; // No org = no plan to check
  }

  return checkOrgPlanStatus(profile.org_id);
}

/**
 * Same check by organization, for callers that hold an org rather than a
 * user (the public API authenticates a key, not a person).
 */
async function checkOrgPlanStatus(orgId) {
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('plan, plan_expires_at')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    return { expired: false, orgId: orgId };
  }

  // Check expiry
  if (org.plan_expires_at && new Date(org.plan_expires_at) < new Date()) {
    return {
      expired: true,
      orgId: orgId,
      message: `Your ${org.plan} plan has expired. Upgrade to continue saving and managing deals.`,
    };
  }

  return { expired: false, orgId };
}


module.exports = { checkPlanStatus, checkOrgPlanStatus };
