// ============================================================
// One-shot user/org wipe.
//
// Hard-coded delete list from the 2026-05-13 audit. Run once and delete
// this file (or keep for reference). Requires SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY in .env.local or shell env.
//
// Usage:
//   node scripts/prune-users.js            # dry run (prints plan, no writes)
//   node scripts/prune-users.js --execute  # actually delete
// ============================================================

const fs = require('fs');
const path = require('path');
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

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL (or REACT_APP_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Set them in .env.local or your shell, then re-run.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Users to delete (11). Source: 2026-05-13 audit.
const USERS_TO_DELETE = [
  { id: '178219b9-a27c-4a40-be3a-bb66420d7d40', email: 'joelpeter617+jeepers@gmail.com' },
  { id: 'acb1c943-acef-49c4-ac5e-ca30f065e0da', email: 'joelpeter617+pilot@gmail.com' },
  { id: '1c9695da-4329-430e-9c73-a9971f258851', email: 'joelpeter617+pole@gmail.com' },
  { id: '23c271b5-5c90-4f4d-89e4-4a6a099017ea', email: 'joelpeter617+test1@gmail.com' },
  { id: '94df3c4b-fdbc-4bcf-a4ad-17e1d6c03f0b', email: 'joelpeter617+test3@gmail.com' },
  { id: 'b9fc77c1-bd1b-4bf1-9a2e-57c9f2192a5a', email: 'joelpeter617+test2@gmail.com' },
  { id: '238f3bb6-2325-4963-8718-8595848206bc', email: 'joelpeter617+pleasework@gmail.com' },
  { id: 'dcf7d0a2-1f85-4ee0-aa77-624f284c3d15', email: 'carsrulealot@gmail.com' },
  { id: '45aef307-0ea2-461f-838a-8656eb5ed061', email: 'joel@embiid.com' },
  { id: '1242cee7-edb3-4b8c-a982-8215d71b67ce', email: 'joelpeter617+invite-test5@gmail.com' },
  { id: '18c9b6e8-6936-4f79-88de-a1427598aa98', email: 'joelpeter617+invite-test6@gmail.com' },
];

// Orgs to delete (7). Joel Capital (ae110a04-...) is kept.
const ORGS_TO_DELETE = [
  { id: '432f2113-cbc4-4a6a-9a3b-269efaee3af5', name: 'Jeepers n Co' },
  { id: '1f59e02a-5307-4957-9fd8-589f017a88fc', name: 'Joel Capital Partners' },
  { id: '55ee7e1c-8f05-4c25-a384-205f746a61c0', name: 'Peep Capital' },
  { id: '3150fed5-09b4-446c-b519-57b56126a26c', name: 'Peep Capital 1' },
  { id: '8aca381e-7e97-4e46-aba7-20755c6cac10', name: 'Pump Capital' },
  { id: '9eacd34c-9788-423d-9601-567b7f5915f5', name: 'Purp Capital' },
  { id: 'ffee27ee-be71-40a5-aa11-bd2b634f8843', name: 'Purp Capital Partners' },
];

const EXECUTE = process.argv.includes('--execute');

async function deleteOrgs() {
  console.log(`\n[1/3] Deleting ${ORGS_TO_DELETE.length} orgs (cascades pipeline_deals, attachments, invites, etc.)`);
  for (const org of ORGS_TO_DELETE) {
    const { error } = await supabase.from('organizations').delete().eq('id', org.id);
    if (error) console.error(`  fail: ${org.name}: ${error.message}`);
    else console.log(`  ok:   ${org.name}`);
  }
}

async function cleanupCrossRefs() {
  console.log(`\n[2/3] Cleaning rows in kept orgs that reference to-be-deleted users`);
  const userIds = USERS_TO_DELETE.map((u) => u.id);

  // audit_log.user_id has no cascade; clean before user delete or PG will reject.
  const cleanupTargets = [
    { table: 'audit_log',        col: 'user_id' },
    { table: 'deal_attachments', col: 'uploaded_by' },
    { table: 'invites',          col: 'created_by' },
    { table: 'invites',          col: 'accepted_by' },
  ];

  for (const { table, col } of cleanupTargets) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in(col, userIds);
    if (error) console.warn(`  warn ${table}.${col}: ${error.message}`);
    else console.log(`  ok   ${table}.${col}: deleted ${count ?? 0} rows`);
  }
}

async function deleteUsers() {
  console.log(`\n[3/3] Deleting ${USERS_TO_DELETE.length} auth users (cascades profiles, sessions)`);
  for (const u of USERS_TO_DELETE) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) console.error(`  fail: ${u.email}: ${error.message}`);
    else console.log(`  ok:   ${u.email}`);
  }
}

async function main() {
  console.log('================================================');
  console.log(' Tranche user/org prune');
  console.log('================================================');
  console.log(`URL:     ${SUPABASE_URL}`);
  console.log(`Mode:    ${EXECUTE ? 'EXECUTE (will delete data)' : 'DRY RUN (no writes)'}`);
  console.log(`Orgs:    ${ORGS_TO_DELETE.length}`);
  console.log(`Users:   ${USERS_TO_DELETE.length}`);
  console.log('Kept:    joelpeter617@gmail.com / Joel Capital');

  if (!EXECUTE) {
    console.log('\nDry run only. Re-run with --execute to actually delete.');
    return;
  }

  await deleteOrgs();
  await cleanupCrossRefs();
  await deleteUsers();

  console.log('\nDone. Re-run supabase_audit_users.sql to verify only Joel Capital remains.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
