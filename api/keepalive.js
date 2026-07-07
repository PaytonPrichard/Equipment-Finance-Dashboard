// ============================================================
// /api/keepalive — daily Vercel cron ping so the free-tier
// Supabase project never auto-pauses from inactivity.
// A paused project takes login, signup, and request-access
// down with it. One trivial read per day prevents that.
// ============================================================

const { supabaseAdmin } = require('../server-lib/supabaseAdmin');

module.exports = async function handler(req, res) {
  try {
    const { error } = await supabaseAdmin
      .from('access_requests')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      console.error('[keepalive] Supabase ping failed:', error.message);
      return res.status(500).json({ ok: false });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[keepalive] Exception:', err.message);
    return res.status(500).json({ ok: false });
  }
};
