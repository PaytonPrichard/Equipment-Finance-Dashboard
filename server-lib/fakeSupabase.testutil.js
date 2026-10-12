// In-memory stand-in for the Supabase client, for server handler tests.
// Supports the query shapes the handlers use: select/insert/update with
// eq, is, order, range, single. Selects return copies, like a real query.
// Not a test file itself (no .test.js), and no handler requires it.

function makeDb(seed) {
  const tables = JSON.parse(JSON.stringify(seed));
  let nextId = 1000;
  const db = {
    tables,
    auth: { getUser: async (token) => ({ data: token ? { user: { id: token } } : null, error: token ? null : { message: 'no' } }) },
    from(table) {
      const q = { op: 'select', filters: [], payload: null, single: false, range: null, count: false };
      const rows = () => (tables[table] || []).filter((r) => q.filters.every(([c, v]) => (v === null ? r[c] == null : r[c] === v)));
      const run = () => {
        if (q.op === 'insert') {
          const row = { id: nextId++, created_at: '2026-10-12T00:00:00Z', ...q.payload };
          (tables[table] = tables[table] || []).push(row);
          return { data: q.single ? row : [row], error: null };
        }
        if (q.op === 'update') {
          const hit = rows();
          hit.forEach((r) => Object.assign(r, q.payload));
          if (q.single) return hit.length ? { data: hit[0], error: null } : { data: null, error: { message: 'no rows' } };
          return { data: hit, error: null };
        }
        // Copies, like a real query: a later update must not change a row
        // the handler already read.
        let out = rows().map((r) => JSON.parse(JSON.stringify(r)));
        const count = out.length;
        if (q.range) out = out.slice(q.range[0], q.range[1] + 1);
        if (q.single) return out.length ? { data: out[0], error: null } : { data: null, error: { message: 'no rows' } };
        return { data: out, error: null, count: q.count ? count : undefined };
      };
      const chain = {
        select(_cols, opts) { if (opts?.count) q.count = true; return chain; },
        insert(p) { q.op = 'insert'; q.payload = p; return chain; },
        update(p) { q.op = 'update'; q.payload = p; return chain; },
        delete() { q.op = 'delete'; return chain; },
        eq(c, v) { q.filters.push([c, v]); return chain; },
        is(c, v) { q.filters.push([c, v]); return chain; },
        order() { return chain; },
        range(a, b) { q.range = [a, b]; return chain; },
        single() { q.single = true; return Promise.resolve(run()); },
        maybeSingle() { q.single = true; return Promise.resolve(run()); },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return chain;
    },
  };
  return db;
}

module.exports = { makeDb };
