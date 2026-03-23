// ============================================================
// Webhook Management: /api/v1/webhooks
// Authenticated via Bearer JWT (admin only)
//
// GET    — List webhooks for org
// POST   — Create webhook
// PATCH  — Update webhook (?id= required)
// DELETE — Delete webhook (?id= required)
// ============================================================

const crypto = require('crypto');
const { handlePreflight } = require('../lib/cors');
const { supabaseAdmin } = require('../lib/supabaseAdmin');

const VALID_EVENTS = [
  'deal.created',
  'deal.scored',
  'pipeline.stage_changed',
];

async function getUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function getProfile(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('org_id, role')
    .eq('id', userId)
    .single();
  return data;
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const profile = await getProfile(user.id);
  if (!profile?.org_id) {
    return res.status(403).json({ error: 'No organization found' });
  }

  if (!['admin', 'credit_committee'].includes(profile.role)) {
    return res.status(403).json({ error: 'Admin access required to manage webhooks' });
  }

  const orgId = profile.org_id;

  // ── GET: List webhooks ────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('webhooks')
      .select('id, url, events, active, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch webhooks' });
    }

    return res.status(200).json({ webhooks: data || [] });
  }

  // ── POST: Create webhook ──────────────────────────────────
  if (req.method === 'POST') {
    const { url, events } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Validate events
    const selectedEvents = events || VALID_EVENTS;
    const invalid = selectedEvents.filter((e) => !VALID_EVENTS.includes(e));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Invalid events: ${invalid.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}` });
    }

    // Limit to 5 webhooks per org
    const { count } = await supabaseAdmin
      .from('webhooks')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId);

    if (count >= 5) {
      return res.status(400).json({ error: 'Maximum 5 webhooks per organization' });
    }

    // Generate signing secret
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const { data, error } = await supabaseAdmin
      .from('webhooks')
      .insert({
        org_id: orgId,
        url,
        secret,
        events: selectedEvents,
        active: true,
      })
      .select('id, url, events, active, created_at')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create webhook', details: error.message });
    }

    // Return secret ONCE
    return res.status(201).json({
      ...data,
      secret,
      message: 'Save this signing secret now. It cannot be retrieved again.',
    });
  }

  // ── PATCH: Update webhook ─────────────────────────────────
  if (req.method === 'PATCH') {
    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: 'id query parameter is required' });
    }

    const { url, events, active } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };

    if (url) {
      try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
      updates.url = url;
    }
    if (events) {
      const invalid = events.filter((e) => !VALID_EVENTS.includes(e));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Invalid events: ${invalid.join(', ')}` });
      }
      updates.events = events;
    }
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabaseAdmin
      .from('webhooks')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('id, url, events, active, updated_at')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update webhook' });
    }

    return res.status(200).json(data);
  }

  // ── DELETE: Delete webhook ────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: 'id query parameter is required' });
    }

    const { error } = await supabaseAdmin
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete webhook' });
    }

    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
