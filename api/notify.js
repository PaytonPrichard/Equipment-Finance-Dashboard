// ============================================================
// Email Notification API — sends stage change emails via Resend
// ============================================================

const { handlePreflight } = require('../server-lib/cors');
const { supabaseAdmin } = require('../server-lib/supabaseAdmin');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || 'Tranche <notifications@usetranche.com>';

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log('[notify] RESEND_API_KEY not set, skipping email to', to);
    return { success: false, reason: 'no_api_key' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[notify] Resend error:', err);
    return { success: false, reason: err };
  }

  return { success: true };
}

function stageChangeEmail({ dealName, oldStage, newStage, movedBy, orgName }) {
  const subject = `${dealName} moved to ${newStage}`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 16px;">
        <strong style="font-size: 16px; color: #111827;">Tranche</strong>
        ${orgName ? `<span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">${orgName}</span>` : ''}
      </div>
      <p style="color: #374151; font-size: 14px; margin: 0 0 12px;">
        <strong>${dealName}</strong> was moved from <strong>${oldStage}</strong> to <strong>${newStage}</strong>.
      </p>
      ${movedBy ? `<p style="color: #6b7280; font-size: 13px; margin: 0 0 16px;">By ${movedBy}</p>` : ''}
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
        <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">New Stage</span>
        <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 4px 0 0;">${newStage}</p>
      </div>
      <p style="color: #9ca3af; font-size: 11px; margin: 16px 0 0;">
        You received this because you are a member of ${orgName || 'this organization'} on Tranche.
      </p>
    </div>
  `;
  return { subject, html };
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { type, dealName, oldStage, newStage, orgId } = req.body;

  if (type !== 'stage_change' || !dealName || !newStage || !orgId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get the mover's name
    const { data: moverProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    const movedBy = moverProfile?.full_name || moverProfile?.email || '';

    // Get org name
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    const orgName = org?.name || '';

    // Get all team members in the org (exclude the person who moved it)
    const { data: members } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('org_id', orgId)
      .neq('id', user.id);

    if (!members || members.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No other team members to notify' });
    }

    const { subject, html } = stageChangeEmail({ dealName, oldStage, newStage, movedBy, orgName });

    // Send to all team members
    const results = await Promise.allSettled(
      members.map((m) => sendEmail(m.email, subject, html))
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length;

    return res.status(200).json({ sent, total: members.length });
  } catch (err) {
    console.error('[notify] Error:', err);
    return res.status(500).json({ error: 'Notification failed' });
  }
};
