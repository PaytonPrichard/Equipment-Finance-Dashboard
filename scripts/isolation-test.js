// ============================================================
// Live data-isolation test. Run against production on purpose.
//
//   node scripts/isolation-test.js
//
// Data isolation between firms is the property Tranche cannot get wrong.
// This proves it empirically instead of by reading policies:
//
//   1. Creates two throwaway firms, A and B, through the service role.
//      A has an admin and an analyst; B has an admin and a seeded deal,
//      memo, facility, covenant, attachment and stored document.
//   2. Signs in as A's users with the public anon key, exactly as a
//      browser would, and tries to read every table (production holds
//      other firms' real data, so any row A can see that is not A's is a
//      leak), read B's seeded rows by id, write into B, change or delete
//      B's rows, escalate its own role or org, call every database
//      function against B, and read B's stored document.
//   3. Verifies through the service role that nothing of B's changed.
//   4. Deletes everything it created, even when a check fails.
//
// Every write it attempts targets test firm B, so a failing check damages
// only test data. It prints counts and ids, never another firm's content.
// Exit code 1 if any leak is found.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function loadDotenv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch { /* missing file is fine */ }
}
loadDotenv(path.resolve(__dirname, '..', '.env.local'));

const URL_ = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error('Need REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const svc = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anonClient = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const RUN = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const PASSWORD = `Iso-${crypto.randomBytes(12).toString('base64url')}!9a`;
const BUCKET = 'deal-documents';

const results = [];
function record(area, check, ok, detail = '') {
  results.push({ area, check, ok, detail });
  const tag = ok ? 'PASS' : 'LEAK';
  console.log(`${tag}  ${area.padEnd(14)} ${check}${detail ? `  (${detail})` : ''}`);
}
function note(area, check, detail) {
  results.push({ area, check, ok: null, detail });
  console.log(`INFO  ${area.padEnd(14)} ${check}${detail ? `  (${detail})` : ''}`);
}

const created = { users: [], orgs: [], objects: [] };

async function makeOrg(label) {
  const { data, error } = await svc.from('organizations')
    .insert({ name: `ISOLATION TEST ${label} ${RUN}`, slug: `isolation-test-${label.toLowerCase()}-${RUN}`, plan: 'free_trial', max_users: 5 })
    .select('id').single();
  if (error) throw new Error(`create org ${label}: ${error.message}`);
  created.orgs.push(data.id);
  return data.id;
}

async function makeUser(label, orgId, role) {
  const email = `isolation-${label.toLowerCase()}-${RUN}@example.com`;
  const { data, error } = await svc.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Isolation ${label}` },
  });
  if (error) throw new Error(`create user ${label}: ${error.message}`);
  const id = data.user.id;
  created.users.push(id);
  // The signup trigger creates the profile; place it in the org.
  for (let i = 0; i < 10; i++) {
    const { data: p } = await svc.from('profiles').select('id').eq('id', id).maybeSingle();
    if (p) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const { error: pe } = await svc.from('profiles').upsert({ id, email, full_name: `Isolation ${label}`, org_id: orgId, role });
  if (pe) throw new Error(`profile ${label}: ${pe.message}`);
  const client = anonClient();
  const { error: se } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(`sign in ${label}: ${se.message}`);
  return { id, email, client };
}

// Insert a seed row for firm B; a table that rejects the shape is noted, not fatal.
async function seed(table, row) {
  const { data, error } = await svc.from(table).insert(row).select('*').single();
  if (error) { note('seed', `${table} not seeded`, error.message.slice(0, 80)); return null; }
  return data;
}

async function countB(table) {
  const col = table === 'user_preferences' ? null : 'org_id';
  const q = svc.from(table).select('*', { count: 'exact', head: true });
  const { count } = col ? await q.eq(col, ORG_B.id) : await q.eq('user_id', ORG_B.admin);
  return count || 0;
}
const ORG_B = { id: null, admin: null };

// Which org or user a row belongs to, per table.
function ownerOf(table, row) {
  if (table === 'organizations') return { org: row.id };
  if (table === 'profiles') return { org: row.org_id, user: row.id };
  if ('org_id' in row) return { org: row.org_id };
  if ('user_id' in row) return { user: row.user_id };
  return null;
}

async function main() {
  console.log(`Isolation test run ${RUN}\n`);

  // ---- 1. Two firms ----
  const orgA = await makeOrg('A');
  const orgB = await makeOrg('B');
  const adminA = await makeUser('A-admin', orgA, 'admin');
  const analystA = await makeUser('A-analyst', orgA, 'analyst');
  const adminB = await makeUser('B-admin', orgB, 'admin');
  ORG_B.id = orgB;
  ORG_B.admin = adminB.id;
  const usersA = new Set([adminA.id, analystA.id]);

  // ---- Seed firm B ----
  const inputs = { companyName: `Isolation Borrower ${RUN}`, annualRevenue: 1000000, ebitda: 200000 };
  const dealB = await seed('pipeline_deals', { org_id: orgB, user_id: adminB.id, name: `B deal ${RUN}`, inputs, score: 50 });
  const savedB = await seed('saved_deals', { org_id: orgB, user_id: adminB.id, name: `B saved ${RUN}`, inputs });
  await seed('audit_log', { org_id: orgB, user_id: adminB.id, action: 'create', entity_type: 'pipeline_deal', entity_id: String(dealB?.id || 0) });
  const memoB = dealB && await seed('deal_memos', { org_id: orgB, deal_id: dealB.id, created_by: adminB.id, asset_class: 'equipment_finance', model: {}, html: '<p>isolation</p>' });
  const facB = await seed('facilities', { org_id: orgB, user_id: adminB.id, borrower_name: `B facility ${RUN}`, asset_class: 'equipment_finance', underwritten_snapshot: {} });
  const covB = facB && await seed('covenants', { org_id: orgB, facility_id: facB.id, name: 'Min DSCR', kind: 'financial', direction: 'min', flag_value: 1.25 });
  if (covB) await seed('covenant_tests', { org_id: orgB, facility_id: facB.id, covenant_id: covB.id, test_date: '2026-09-30', status: 'pass', created_by: adminB.id });
  const hookB = await seed('webhooks', { org_id: orgB, url: 'https://example.com/isolation', secret: 'isolation', events: ['deal.created'] });
  const keyB = await seed('api_keys', { org_id: orgB, name: 'isolation', key_prefix: 'iso', key_hash: crypto.randomBytes(16).toString('hex'), created_by: adminB.id });
  await seed('invites', { org_id: orgB, email: 'isolation-invitee@example.com', role: 'analyst', invite_code: `ISO${RUN}`.toUpperCase(), created_by: adminB.id });
  await svc.from('user_preferences').upsert({ user_id: adminB.id, draft_inputs: { inputs } });

  const objectPath = `${orgB}/${dealB?.id || 'none'}/${Date.now()}_isolation.txt`;
  const up = await svc.storage.from(BUCKET).upload(objectPath, Buffer.from(`isolation ${RUN}`), { contentType: 'text/plain' });
  if (up.error) note('seed', 'storage object not seeded', up.error.message);
  else created.objects.push(objectPath);
  const attB = dealB && await seed('deal_attachments', { deal_id: dealB.id, org_id: orgB, uploaded_by: adminB.id, file_name: 'isolation.txt', file_size: 20, file_type: 'text/plain', storage_path: objectPath });

  // ---- 2. Reads: every table, as both A users ----
  const spec = await (await fetch(`${URL_}/rest/v1/`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).json();
  const tables = Object.keys(spec.definitions || {}).sort();
  for (const who of [adminA, analystA]) {
    const label = who === adminA ? 'A admin' : 'A analyst';
    for (const table of tables) {
      const { data, error } = await who.client.from(table).select('*').limit(1000);
      if (error) { record('read', `${label} reads ${table}`, true, 'denied'); continue; }
      const foreign = (data || []).filter((row) => {
        const o = ownerOf(table, row);
        if (!o) return true; // no owner column: anything visible is suspect
        if (o.org && o.org !== orgA) return true;
        if (!o.org && o.user && !usersA.has(o.user)) return true;
        return false;
      });
      // These hold no firm data; visible rows are a config question, not a cross-firm leak.
      const global = ['discount_codes'];
      if (global.includes(table) && foreign.length) {
        note('read', `${label} sees ${foreign.length} ${table} rows`, 'not firm data, review');
        continue;
      }
      record('read', `${label} reads ${table}`, foreign.length === 0, `${(data || []).length} visible, ${foreign.length} not theirs`);
    }
  }

  // ---- B's rows by id ----
  const byId = [['pipeline_deals', dealB], ['saved_deals', savedB], ['deal_memos', memoB], ['facilities', facB], ['covenants', covB], ['deal_attachments', attB]];
  for (const [table, row] of byId) {
    if (!row) continue;
    const { data } = await adminA.client.from(table).select('id').eq('id', row.id);
    record('read', `A fetches B's ${table} by id`, !data || data.length === 0);
  }
  {
    const { data } = await adminA.client.from('user_preferences').select('user_id').eq('user_id', adminB.id);
    record('read', "A fetches B's draft (user_preferences)", !data || data.length === 0);
  }

  // ---- 3. Writes into B ----
  const inserts = [
    ['pipeline_deals', { org_id: orgB, user_id: adminA.id, name: 'injected', inputs }],
    ['saved_deals', { org_id: orgB, user_id: adminA.id, name: 'injected', inputs }],
    ['audit_log', { org_id: orgB, user_id: adminA.id, action: 'create', entity_type: 'pipeline_deal' }],
    ['facilities', { org_id: orgB, user_id: adminA.id, borrower_name: 'injected', asset_class: 'equipment_finance', underwritten_snapshot: {} }],
    ['webhooks', { org_id: orgB, url: 'https://example.com/steal', secret: 'x', events: ['deal.created'] }],
    ['api_keys', { org_id: orgB, name: 'injected', key_prefix: 'inj', key_hash: 'x', created_by: adminA.id }],
    ['invites', { org_id: orgB, email: 'attacker@example.com', role: 'admin', invite_code: `INJ${RUN}`.toUpperCase(), created_by: adminA.id }],
    ['org_modules', { org_id: orgB, module_key: 'equipment_finance', enabled: false }],
    ['org_permissions', { org_id: orgB, role: 'analyst', permission_key: 'isolation', allowed: true }],
    ['deal_attachments', { deal_id: dealB?.id || 0, org_id: orgB, uploaded_by: adminA.id, file_name: 'x', file_size: 1, file_type: 'text/plain', storage_path: 'x' }],
    ['user_preferences', { user_id: adminB.id, draft_inputs: { injected: true } }],
  ];
  if (dealB) inserts.push(['deal_memos', { org_id: orgB, deal_id: dealB.id, created_by: adminA.id, asset_class: 'equipment_finance', model: {}, html: 'x' }]);
  if (facB && covB) inserts.push(['covenant_tests', { org_id: orgB, facility_id: facB.id, covenant_id: covB.id, test_date: '2026-09-30', status: 'fail', created_by: adminA.id }]);
  // No .select() on these inserts. Asking for the row back adds a SELECT
  // check that fails for B's rows and rolls the insert back, which would
  // pass this test even when the INSERT policy lets the row through. The
  // service role checks what actually landed.
  for (const [table, row] of inserts) {
    const before = await countB(table);
    const { error } = await adminA.client.from(table).insert(row);
    const after = await countB(table);
    const landed = after > before;
    record('write', `A inserts into B's ${table}`, !landed, landed ? 'ROW CREATED' : error ? 'rejected' : 'no row');
  }
  {
    // A moves its own saved deal into B.
    const { data: own } = await adminA.client.from('saved_deals').insert({ org_id: orgA, user_id: adminA.id, name: `A own ${RUN}`, inputs }).select('id').single();
    if (own) {
      await adminA.client.from('saved_deals').update({ org_id: orgB }).eq('id', own.id);
      const { data: moved } = await svc.from('saved_deals').select('org_id').eq('id', own.id).single();
      record('write', 'A moves its own saved deal into B', moved.org_id === orgA);
      const { data: ownP } = await adminA.client.from('pipeline_deals').insert({ org_id: orgA, user_id: adminA.id, name: `A own ${RUN}`, inputs }).select('id').single();
      if (ownP) {
        await adminA.client.from('pipeline_deals').update({ org_id: orgB }).eq('id', ownP.id);
        const { data: movedP } = await svc.from('pipeline_deals').select('org_id').eq('id', ownP.id).single();
        record('write', 'A moves its own pipeline deal into B', movedP.org_id === orgA);
      }
    } else note('write', 'A could not create its own saved deal', '');
  }

  // Updates and deletes of B's rows, verified through the service role.
  const mutations = [['pipeline_deals', dealB, { name: 'tampered' }, 'name'], ['saved_deals', savedB, { name: 'tampered' }, 'name'], ['facilities', facB, { borrower_name: 'tampered' }, 'borrower_name']];
  for (const [table, row, patch, col] of mutations) {
    if (!row) continue;
    await adminA.client.from(table).update(patch).eq('id', row.id);
    const { data: after } = await svc.from(table).select(col).eq('id', row.id).single();
    record('write', `A updates B's ${table}`, after && after[col] === row[col]);
    await adminA.client.from(table).delete().eq('id', row.id);
    const { data: still } = await svc.from(table).select('id').eq('id', row.id);
    record('write', `A deletes B's ${table}`, still && still.length === 1);
  }
  {
    await adminA.client.from('organizations').update({ name: 'tampered' }).eq('id', orgB);
    const { data } = await svc.from('organizations').select('name').eq('id', orgB).single();
    record('write', "A renames B's organization", data.name === `ISOLATION TEST B ${RUN}`);
    await adminA.client.from('profiles').update({ full_name: 'tampered' }).eq('id', adminB.id);
    const { data: pb } = await svc.from('profiles').select('full_name').eq('id', adminB.id).single();
    record('write', "A edits B admin's profile", pb.full_name === 'Isolation B-admin');
  }

  // ---- Escalation ----
  {
    await analystA.client.from('profiles').update({ role: 'admin' }).eq('id', analystA.id);
    const { data: r } = await svc.from('profiles').select('role').eq('id', analystA.id).single();
    record('escalate', 'A analyst promotes self to admin', r.role === 'analyst', r.role);
    await analystA.client.from('profiles').update({ org_id: orgB }).eq('id', analystA.id);
    const { data: o } = await svc.from('profiles').select('org_id').eq('id', analystA.id).single();
    record('escalate', 'A analyst moves self into B', o.org_id === orgA);
    await adminA.client.from('profiles').update({ org_id: orgB }).eq('id', adminA.id);
    const { data: o2 } = await svc.from('profiles').select('org_id').eq('id', adminA.id).single();
    record('escalate', 'A admin moves self into B', o2.org_id === orgA);
    // Undo any move that got through, so later checks start from A.
    await svc.from('profiles').update({ org_id: orgA }).in('id', [adminA.id, analystA.id]);
    await svc.from('profiles').update({ role: 'analyst' }).eq('id', analystA.id);
  }

  // ---- Integrations are admin business ----
  {
    const before = await svc.from('api_keys').select('*', { count: 'exact', head: true }).eq('org_id', orgA);
    await analystA.client.from('api_keys').insert({ org_id: orgA, name: 'analyst key', key_prefix: 'ana', key_hash: crypto.randomBytes(16).toString('hex'), created_by: analystA.id });
    const after = await svc.from('api_keys').select('*', { count: 'exact', head: true }).eq('org_id', orgA);
    record('escalate', 'A analyst mints an API key', (after.count || 0) === (before.count || 0));
    const wb = await svc.from('webhooks').select('*', { count: 'exact', head: true }).eq('org_id', orgA);
    await analystA.client.from('webhooks').insert({ org_id: orgA, url: 'https://example.com/analyst', secret: 's', events: ['deal.created'] });
    const wa = await svc.from('webhooks').select('*', { count: 'exact', head: true }).eq('org_id', orgA);
    record('escalate', 'A analyst registers a webhook', (wa.count || 0) === (wb.count || 0));
  }

  // ---- Member removal still works, and only inside the admin's own org ----
  {
    const removable = await makeUser('A-removable', orgA, 'analyst');
    const { error: re } = await adminA.client.rpc('remove_member', { p_user_id: removable.id });
    if (re && /function .* does not exist|Could not find the function/i.test(re.message)) {
      await adminA.client.from('profiles').update({ org_id: null, role: 'analyst' }).eq('id', removable.id);
    }
    const { data: rm } = await svc.from('profiles').select('org_id').eq('id', removable.id).single();
    record('team', 'A admin removes an A member', rm.org_id === null, rm.org_id === null ? 'removed' : 'member KEPT access');
    // Orgless users must not be listable by anyone.
    await svc.from('profiles').update({ org_id: null }).eq('id', removable.id);
    const { data: anonProfiles } = await anonClient().from('profiles').select('id').eq('id', removable.id);
    record('anon', 'anonymous lists a user with no org', !anonProfiles || anonProfiles.length === 0);
    await adminA.client.rpc('remove_member', { p_user_id: adminB.id });
    const { data: bAfter } = await svc.from('profiles').select('org_id').eq('id', adminB.id).single();
    record('team', "A admin removes B's admin", bAfter.org_id === orgB);
  }

  // ---- Email: /api/notify must not reach another firm ----
  // Only meaningful against the deployed API; set ISOLATION_API=off to skip.
  if (process.env.ISOLATION_API !== 'off') {
    const base = process.env.ISOLATION_API || 'https://www.gettranche.app';
    const { data: { session } } = await adminA.client.auth.getSession();
    const call = (body) => fetch(`${base}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    if (dealB) {
      const r = await call({ type: 'stage_change', orgId: orgB, dealId: dealB.id, dealName: dealB.name, oldStage: 'Screening', newStage: 'Approved' });
      record('email', "A emails B's team about B's deal", !(r.body && r.body.sent > 0) && !(r.body && r.body.total > 0), `HTTP ${r.status}`);
    }
    const r2 = await call({ type: 'invite', orgId: orgB, inviteCode: `ISO${RUN}`.toUpperCase(), email: 'isolation-outsider@example.com', role: 'admin' });
    record('email', "A sends B's invite to an outsider", r2.status !== 200, `HTTP ${r2.status}`);
  }

  // ---- Database functions ----
  {
    const { data: myOrg } = await adminA.client.rpc('get_user_org_id');
    record('rpc', 'get_user_org_id returns own org', myOrg === orgA || myOrg == null, String(myOrg === orgA));
    await adminA.client.rpc('transfer_admin', { p_new_admin_id: adminB.id });
    const { data: b } = await svc.from('profiles').select('org_id, role').eq('id', adminB.id).single();
    const { data: a } = await svc.from('profiles').select('org_id, role').eq('id', adminA.id).single();
    record('rpc', "transfer_admin to B's admin changes nothing", b.org_id === orgB && b.role === 'admin' && a.role === 'admin');
    const { error: qe } = await adminA.client.rpc('claim_extraction_quota', { p_user_id: adminB.id, p_documents: 1, p_limit: 1000 });
    record('rpc', 'claim_extraction_quota not callable by users', !!qe, qe ? 'denied' : 'CALLABLE');
    // A real, unredeemed code, used against B's admin. Only the server may
    // call this function; from a browser it must be refused outright.
    const code = `ISO${crypto.randomBytes(5).toString('hex')}`.toUpperCase();
    await svc.from('signup_invites').insert({ code, email: null, org_name: `ISOLATION TEST C ${RUN}`, plan: 'free_trial', expires_at: new Date(Date.now() + 3600e3).toISOString(), notes: `isolation ${RUN}` });
    const { data: rs, error: rse } = await adminA.client.rpc('redeem_signup_invite', { p_code: code, p_org_name: `ISOLATION TEST C ${RUN}`, p_user_email: adminB.email, p_user_id: adminB.id });
    const { data: b2 } = await svc.from('profiles').select('org_id').eq('id', adminB.id).single();
    record('rpc', "redeem_signup_invite cannot move B's admin", b2.org_id === orgB, rse ? 'denied' : JSON.stringify(rs || null).slice(0, 60));
    if (b2.org_id !== orgB && b2.org_id) created.orgs.push(b2.org_id);
    await svc.from('signup_invites').delete().eq('code', code);
    const { data: rd } = await adminA.client.rpc('redeem_discount_code', { p_code: 'NOPE', p_org_id: orgB });
    note('rpc', 'redeem_discount_code against B', JSON.stringify(rd || null).slice(0, 80));
  }

  // ---- Stored documents ----
  if (created.objects.length) {
    const dl = await adminA.client.storage.from(BUCKET).download(objectPath);
    record('storage', "A downloads B's document by path", !!dl.error, dl.error ? 'denied' : 'DOWNLOADED');
    const su = await adminA.client.storage.from(BUCKET).createSignedUrl(objectPath, 60);
    record('storage', "A signs a URL for B's document", !!su.error, su.error ? 'denied' : 'SIGNED');
    const ls = await adminA.client.storage.from(BUCKET).list(orgB);
    record('storage', "A lists B's folder", !ls.data || ls.data.length === 0, `${(ls.data || []).length} entries`);
    const root = await adminA.client.storage.from(BUCKET).list('', { limit: 1000 });
    const foreignFolders = (root.data || []).filter((e) => e.name !== orgA).length;
    record('storage', 'A lists bucket root', foreignFolders === 0, `${foreignFolders} other firms' folders visible`);
    const ow = await adminA.client.storage.from(BUCKET).upload(`${orgB}/injected.txt`, Buffer.from('x'), { contentType: 'text/plain' });
    if (!ow.error) created.objects.push(`${orgB}/injected.txt`);
    record('storage', "A writes into B's folder", !!ow.error, ow.error ? 'denied' : 'WRITTEN');
    const anonDl = await anonClient().storage.from(BUCKET).download(objectPath);
    record('storage', 'anonymous download of a document', !!anonDl.error);
  }

  // ---- Other doors into the same data ----
  const API = process.env.ISOLATION_API === 'off' ? null : (process.env.ISOLATION_API || 'https://www.gettranche.app');
  const { data: { session: sessA } } = await adminA.client.auth.getSession();
  const tokenA = sessA.access_token;

  // GraphQL serves the same tables. It must never return more than REST.
  {
    const gql = (query) => fetch(`${URL_}/graphql/v1`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => r.json()).catch(() => null);
    const schema = await gql('{ __schema { queryType { fields { name } } } }');
    const collections = (schema?.data?.__schema?.queryType?.fields || []).map((f) => f.name).filter((n) => n.endsWith('Collection'));
    if (!collections.length) {
      note('graphql', 'GraphQL exposes no collections', JSON.stringify(schema?.errors?.[0]?.message || 'none').slice(0, 60));
    }
    for (const col of collections) {
      const table = col.replace(/Collection$/, '');
      const g = await gql(`{ ${col}(first: 1000) { edges { node { nodeId } } } }`);
      const viaGraphql = g?.data?.[col]?.edges?.length ?? 0;
      const { data: viaRest } = await adminA.client.from(table).select('*').limit(1000);
      record('graphql', `A reads ${table} via GraphQL`, viaGraphql <= (viaRest || []).length, `${viaGraphql} via GraphQL, ${(viaRest || []).length} via REST`);
    }
  }

  // Embedded joins from A's own rows must not reach B's.
  {
    const { data: em, error } = await adminA.client.from('organizations').select('id, profiles(id, org_id), pipeline_deals(id, org_id)');
    if (error) note('embed', 'organization joins', error.message.slice(0, 60));
    const nested = (em || []).flatMap((o) => [...(o.profiles || []), ...(o.pipeline_deals || [])]);
    record('embed', 'A joins organizations to profiles and deals', nested.every((r) => r.org_id === orgA), `${nested.length} nested rows`);
    const { data: em2 } = await adminA.client.from('facilities').select('id, covenants(id, org_id), covenant_tests(id, org_id)');
    const nested2 = (em2 || []).flatMap((f) => [...(f.covenants || []), ...(f.covenant_tests || [])]);
    record('embed', 'A joins facilities to covenants and tests', nested2.every((r) => r.org_id === orgA), `${nested2.length} nested rows`);
  }

  // Live updates: A subscribes, B's rows change, A must hear nothing.
  {
    const events = [];
    const status = await new Promise((resolve) => {
      const t = setTimeout(() => resolve('TIMED_OUT'), 8000);
      adminA.client.channel(`iso-${RUN}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_deals' }, (p) => events.push(p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' }, (p) => events.push(p))
        .subscribe((st) => { if (st === 'SUBSCRIBED' || st === 'CHANNEL_ERROR') { clearTimeout(t); resolve(st); } });
    });
    await svc.from('pipeline_deals').insert({ org_id: orgB, user_id: adminB.id, name: `B realtime ${RUN}`, inputs });
    await svc.from('audit_log').insert({ org_id: orgB, user_id: adminB.id, action: 'create', entity_type: 'pipeline_deal' });
    await new Promise((r) => setTimeout(r, 4000));
    const foreign = events.filter((e) => (e.new && e.new.org_id && e.new.org_id !== orgA) || (e.old && e.old.org_id && e.old.org_id !== orgA));
    record('realtime', "A's subscription receives B's changes", foreign.length === 0, `subscription ${status}, ${events.length} events`);
    await adminA.client.removeAllChannels();
  }

  // Error messages must not confirm that another firm's row exists.
  if (dealB) {
    const fac = (dealId) => adminA.client.from('facilities').insert({ org_id: orgA, user_id: adminA.id, borrower_name: 'probe', asset_class: 'equipment_finance', underwritten_snapshot: {}, pipeline_deal_id: dealId });
    const realB = await fac(dealB.id);
    const missing = await fac(2147483000);
    await svc.from('facilities').delete().eq('org_id', orgA).eq('borrower_name', 'probe');
    record('oracle', "facility error reveals whether B's deal exists", (realB.error?.message || 'ok') === (missing.error?.message || 'ok'), realB.error ? 'B id refused' : 'B id ACCEPTED');
  }

  if (API && dealB) {
    // /api/score-deal: A's token, B's deal.
    const scoreDeal = (q, method, body) => fetch(`${API}/api/score-deal${q}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(body),
    });
    const sd = await scoreDeal(`?id=${dealB.id}`, 'PATCH', { inputs: { ...inputs, annualRevenue: 1 } });
    const { data: dAfter } = await svc.from('pipeline_deals').select('inputs').eq('id', dealB.id).single();
    record('api', "A rescores B's deal via /api/score-deal", dAfter.inputs.annualRevenue === inputs.annualRevenue, `HTTP ${sd.status}`);
    const sdMissing = await scoreDeal('?id=2147483000', 'PATCH', { inputs });
    record('oracle', "/api/score-deal answers the same for B's deal and a missing one", sd.status === sdMissing.status, `${sd.status} vs ${sdMissing.status}`);
    // A complete, valid deal, so the request reaches the org check
    // instead of stopping at input validation.
    const validInputs = {
      companyName: `A posts into B ${RUN}`, yearsInBusiness: 10, annualRevenue: 20000000, priorYearRevenue: 0,
      ebitda: 3000000, priorYearEbitda: 0, totalExistingDebt: 5000000, actualAnnualDebtService: 0,
      maintenanceCapex: 0, cashOnHand: 1000000, availableLiquidity: 0, industrySector: 'Manufacturing',
      creditRating: 'Adequate', equipmentType: 'Heavy Machinery', equipmentCondition: 'New',
      equipmentCost: 2000000, downPayment: 200000, financingType: 'EFA', usefulLife: 10, loanTerm: 60, essentialUse: true,
    };
    const sp = await scoreDeal('', 'POST', { name: `A posts into B ${RUN}`, inputs: validInputs, org_id: orgB, asset_class: 'equipment_finance' });
    const { data: landed } = await svc.from('pipeline_deals').select('org_id').eq('name', `A posts into B ${RUN}`);
    record('api', 'A creates a deal in B via /api/score-deal', (landed || []).every((d) => d.org_id === orgA), `HTTP ${sp.status}, ${(landed || []).length} created`);

    // /api/v1 with a real API key for A.
    const keyA = `trn_${crypto.randomBytes(24).toString('hex')}`;
    await svc.from('api_keys').insert({ org_id: orgA, name: 'isolation', key_prefix: keyA.slice(0, 12), key_hash: crypto.createHash('sha256').update(keyA).digest('hex'), created_by: adminA.id });
    const v1 = (q, init = {}) => fetch(`${API}/api/v1?${q}`, { ...init, headers: { 'Content-Type': 'application/json', 'X-API-Key': keyA, ...(init.headers || {}) } });
    const g1 = await v1(`resource=deals&id=${dealB.id}`);
    const g1Missing = await v1('resource=deals&id=2147483000');
    record('api', "A's API key reads B's deal by id", g1.status !== 200, `HTTP ${g1.status}`);
    record('oracle', "/api/v1 answers the same for B's deal and a missing one", g1.status === g1Missing.status, `${g1.status} vs ${g1Missing.status}`);
    const list = await (await v1('resource=deals&limit=200')).json().catch(() => ({}));
    record('api', "A's API key lists deals", !(list.deals || []).some((d) => d.id === dealB.id || /^B /.test(d.name || '')), `${(list.deals || []).length} listed`);
    await v1(`resource=deals&id=${dealB.id}`, { method: 'PATCH', body: JSON.stringify({ stage: 'Declined', notes: 'tampered' }) });
    const { data: stB } = await svc.from('pipeline_deals').select('stage, notes').eq('id', dealB.id).single();
    record('api', "A's API key changes B's deal", stB.notes !== 'tampered' && stB.stage === dealB.stage);

    // /api/v1 keys and webhooks with A's admin session.
    const jw = (q, init = {}) => fetch(`${API}/api/v1?${q}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}`, ...(init.headers || {}) } });
    const keys = await (await jw('resource=keys')).json().catch(() => ({}));
    const keyList = Array.isArray(keys) ? keys : (keys.keys || []);
    record('api', "A's admin lists API keys", !keyList.some((k) => keyB && k.id === keyB.id), `${keyList.length} listed`);
    if (keyB) {
      await jw(`resource=keys&id=${keyB.id}`, { method: 'DELETE' });
      const { data: kb } = await svc.from('api_keys').select('revoked_at').eq('id', keyB.id).single();
      record('api', "A's admin revokes B's API key", kb && kb.revoked_at === null);
    }
    const hooks = await (await jw('resource=webhooks')).json().catch(() => ({}));
    const hookList = Array.isArray(hooks) ? hooks : (hooks.webhooks || []);
    record('api', "A's admin lists webhooks", !hookList.some((h) => hookB && h.id === hookB.id), `${hookList.length} listed`);
    if (hookB) {
      await jw(`resource=webhooks&id=${hookB.id}`, { method: 'PATCH', body: JSON.stringify({ url: 'https://example.com/stolen' }) });
      await jw(`resource=webhooks&id=${hookB.id}`, { method: 'DELETE' });
      const { data: hb } = await svc.from('webhooks').select('url').eq('id', hookB.id).maybeSingle();
      record('api', "A's admin edits or deletes B's webhook", !!hb && hb.url === hookB.url);
    }
  }

  // ---- Anonymous ----
  for (const table of tables) {
    const { data } = await anonClient().from(table).select('*').limit(5);
    record('anon', `anonymous reads ${table}`, !data || data.length === 0);
  }
}

async function cleanup() {
  for (const p of created.objects) await svc.storage.from(BUCKET).remove([p]).catch(() => {});
  // Firm rows first: some reference users without cascading, which would
  // block deleting the users.
  for (const id of created.orgs) {
    for (const t of ['covenant_tests', 'covenants', 'facilities', 'deal_memos', 'deal_attachments', 'audit_log', 'webhooks', 'api_keys', 'invites', 'pipeline_deals', 'saved_deals', 'org_modules', 'org_permissions']) {
      await svc.from(t).delete().eq('org_id', id);
    }
  }
  for (const id of created.users) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`cleanup: user ${id} not deleted: ${error.message}`);
  }
  for (const id of created.orgs) {
    const { error } = await svc.from('organizations').delete().eq('id', id);
    if (error) console.log(`cleanup: org ${id} not deleted: ${error.message}`);
  }
  const { data: left } = await svc.from('organizations').select('id').like('slug', `isolation-test-%-${RUN}`);
  console.log(`\nCleanup: ${created.users.length} users and ${created.orgs.length} orgs removed${left && left.length ? `, ${left.length} org rows LEFT` : ''}.`);
}

main()
  .catch((err) => { console.error(`\nRun aborted: ${err.message}`); results.push({ ok: false, area: 'run', check: 'aborted', detail: err.message }); })
  .finally(async () => {
    await cleanup();
    const leaks = results.filter((r) => r.ok === false);
    const passes = results.filter((r) => r.ok === true).length;
    console.log(`\n${passes} passed, ${leaks.length} leaks.`);
    for (const l of leaks) console.log(`  LEAK ${l.area}: ${l.check} ${l.detail}`);
    process.exit(leaks.length ? 1 : 0);
  });
