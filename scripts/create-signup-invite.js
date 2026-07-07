// ============================================================
// Create a signup invite code (provisions a new org + admin on redemption).
//
// Inserts one row into public.signup_invites. The recipient redeems it at
//   https://gettranche.app/?code=<CODE>
// which routes straight into the signup form (see src/App.js + LoginPage).
//
// Requires SUPABASE_URL (or REACT_APP_SUPABASE_URL) and
// SUPABASE_SERVICE_ROLE_KEY in .env.local or shell env.
//
// Usage:
//   node scripts/create-signup-invite.js --email friend@x.com --org "Their Firm"
//   node scripts/create-signup-invite.js --email friend@x.com --org "Their Firm" --plan pilot --code-days 30
//
// Plans (set the trial length + seat cap at redemption, see redeem_signup_invite):
//   pilot       90-day trial, 10 users   (default)
//   pro         30-day trial, 25 users
//   free_trial  14-day trial,  3 users
//
// --code-days controls how long the CODE stays redeemable (default 30),
// which is separate from the trial length it grants.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Minimal .env.local loader — avoids adding a dotenv dependency.
function loadDotenv(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch (e) { /* file missing is fine */ }
}
loadDotenv(path.resolve(__dirname, '..', '.env.local'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL (or REACT_APP_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Set them in .env.local or your shell, then re-run.');
  process.exit(1);
}

// ----- Parse args -----
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const email = (arg('email', '') || '').toLowerCase().trim();
const orgName = arg('org', '').trim();
const plan = arg('plan', 'pilot').trim();
const codeDays = parseInt(arg('code-days', '30'), 10);
const APP_URL = (process.env.APP_URL || 'https://gettranche.app').replace(/\/$/, '');

const VALID_PLANS = ['free_trial', 'pilot', 'pro'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!EMAIL_RE.test(email)) {
  console.error('Provide a valid --email (the invite will be bound to this address).');
  process.exit(1);
}
if (!orgName) {
  console.error('Provide --org "Default Org Name" (the recipient can edit it at signup).');
  process.exit(1);
}
if (!VALID_PLANS.includes(plan)) {
  console.error(`--plan must be one of: ${VALID_PLANS.join(', ')}`);
  process.exit(1);
}

// Readable, unambiguous code: TRANCHE-XXXXXXXX (no 0/O/1/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode() {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `TRANCHE-${s}`;
}
const code = arg('code', genCode());

const expiresAt = new Date(Date.now() + codeDays * 24 * 60 * 60 * 1000).toISOString();

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('================================================');
  console.log(' Tranche signup invite');
  console.log('================================================');
  console.log(`URL:        ${SUPABASE_URL}`);
  console.log(`Email:      ${email} (bound)`);
  console.log(`Org name:   ${orgName}`);
  console.log(`Plan:       ${plan}`);
  console.log(`Code valid: ${codeDays} days (until ${expiresAt.slice(0, 10)})`);

  const { data, error } = await supabase
    .from('signup_invites')
    .insert({
      code,
      email,
      org_name: orgName,
      plan,
      expires_at: expiresAt,
      notes: 'Created via scripts/create-signup-invite.js',
    })
    .select('code')
    .single();

  if (error) {
    console.error('\nInsert failed:', error.message);
    if (/relation .*signup_invites.* does not exist/i.test(error.message)) {
      console.error('The signup_invites table is not deployed. Run supabase_signup_invites.sql first.');
    }
    process.exit(1);
  }

  console.log('\nInvite created.');
  console.log('Share this link with the recipient:');
  console.log(`\n  ${APP_URL}/?code=${encodeURIComponent(data.code)}\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
