// ============================================================
// Invite-code signup endpoint
//
// Flow:
//   1. Validate input + rate limit
//   2. Read-only check the invite code is still valid
//   3. Create the auth user via admin API (email_confirm: true,
//      since the invite itself is the validation)
//   4. Call redeem_signup_invite RPC to provision org + admin role
//   5. If RPC fails, delete the auth user as compensation
//   6. Return success — client signs the user in
// ============================================================

const { handlePreflight } = require('../server-lib/cors');
const { checkRateLimit } = require('../server-lib/rateLimit');
const { supabaseAdmin } = require('../server-lib/supabaseAdmin');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_CHECKS = [
  { test: (p) => p.length >= 10, label: 'at least 10 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'one uppercase letter' },
  { test: (p) => /[a-z]/.test(p), label: 'one lowercase letter' },
  { test: (p) => /[0-9]/.test(p), label: 'one number' },
  { test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p), label: 'one special character' },
];

function clip(s, max) {
  if (typeof s !== 'string') return '';
  const trimmed = s.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkRateLimit(req, res, 'signup')) {
    return res.status(429).json({ error: 'Too many signup attempts. Please try again later.' });
  }

  const body = req.body || {};
  const email = clip(body.email, 320).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = clip(body.fullName, 200);
  const code = clip(body.code, 64);
  const orgName = clip(body.orgName, 200);

  // ----- Input validation -----
  if (!email || !password || !fullName || !code) {
    return res.status(400).json({ error: 'Email, password, full name, and code are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  for (const check of PASSWORD_CHECKS) {
    if (!check.test(password)) {
      return res.status(400).json({ error: `Password needs ${check.label}.` });
    }
  }
  if (!orgName) {
    return res.status(400).json({ error: 'Organization name is required.' });
  }

  // ----- Pre-flight: validate the code (read-only) -----
  let validation;
  try {
    const { data, error } = await supabaseAdmin.rpc('validate_signup_invite', {
      p_code: code,
      p_email: email,
    });
    if (error) throw error;
    validation = data;
  } catch (err) {
    console.error('[signup-with-code] validate_signup_invite error:', err);
    return res.status(500).json({ error: 'Could not validate code. Please try again.' });
  }

  if (!validation?.valid) {
    const reason = validation?.reason || 'invalid_code';
    const messages = {
      invalid_code: 'This invite code is not recognized.',
      already_redeemed: 'This invite code has already been used.',
      expired: 'This invite code has expired. Please request a new one.',
      email_mismatch: 'This invite code is for a different email address.',
    };
    return res.status(400).json({ error: messages[reason] || 'Invalid invite code.' });
  }

  // ----- Create the auth user -----
  // TEMP DEBUG: `debug` fields in the error responses below are a temporary
  // troubleshooting aid. Strip them before the final commit.
  const envDebug = {
    has_url: Boolean(process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL),
    has_service_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  let createdUserId = null;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // invite is the validation; skip the verification email
      user_metadata: { full_name: fullName },
    });
    if (error) {
      const msg = error.message || '';
      if (/already registered|already been registered|duplicate/i.test(msg)) {
        return res.status(409).json({ error: 'An account with this email already exists. Try signing in instead.' });
      }
      console.error('[signup-with-code] createUser error:', error);
      return res.status(500).json({
        error: 'Could not create account. Please try again.',
        debug: {
          stage: 'createUser',
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
          env: envDebug,
        },
      });
    }
    createdUserId = data?.user?.id;
    if (!createdUserId) throw new Error('createUser returned no user id');
  } catch (err) {
    console.error('[signup-with-code] createUser exception:', err);
    return res.status(500).json({
      error: 'Could not create account. Please try again.',
      debug: {
        stage: 'createUser_exception',
        message: err?.message,
        name: err?.name,
        env: envDebug,
      },
    });
  }

  // ----- Redeem the code (atomic: creates org + promotes user) -----
  try {
    const { data: redeemResult, error: redeemError } = await supabaseAdmin.rpc('redeem_signup_invite', {
      p_code: code,
      p_user_id: createdUserId,
      p_user_email: email,
      p_org_name: orgName,
    });

    if (redeemError) throw redeemError;

    if (redeemResult?.error) {
      // RPC returned a logical error (e.g. code raced and was redeemed by someone else).
      // Compensate by deleting the auth user.
      await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch((e) => {
        console.error('[signup-with-code] failed to roll back auth user:', e);
      });
      const messages = {
        invalid_code: 'This invite code is not recognized.',
        already_redeemed: 'This invite code has already been used.',
        expired: 'This invite code has expired. Please request a new one.',
        email_mismatch: 'This invite code is for a different email address.',
      };
      return res.status(400).json({ error: messages[redeemResult.error] || 'Could not redeem invite.' });
    }

    return res.status(200).json({
      ok: true,
      org_id: redeemResult?.org_id,
      plan: redeemResult?.plan,
    });
  } catch (err) {
    console.error('[signup-with-code] redeem_signup_invite exception:', err);
    // Compensate
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch((e) => {
        console.error('[signup-with-code] failed to roll back auth user:', e);
      });
    }
    return res.status(500).json({ error: 'Could not complete signup. Please try again.' });
  }
};
