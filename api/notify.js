// ============================================================
// Email Notification API — sends stage change emails via Resend
// ============================================================

const { handlePreflight } = require('../server-lib/cors');
const { supabaseAdmin } = require('../server-lib/supabaseAdmin');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || 'Tranche <notifications@gettranche.app>';
const APP_URL = process.env.APP_URL || 'https://gettranche.app';

const ROLE_LABELS = {
  analyst: 'Analyst',
  senior_analyst: 'Senior Analyst',
  credit_committee: 'Credit Committee',
  admin: 'Administrator',
};

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

function inviteEmail({ inviteCode, role, orgName, inviterName }) {
  const subject = `You've been invited to join ${orgName} on Tranche`;
  const roleLabel = ROLE_LABELS[role] || 'Team Member';
  const signupUrl = `${APP_URL}/?invite=${encodeURIComponent(inviteCode)}`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px;">
        <strong style="font-size: 16px; color: #111827;">Tranche</strong>
      </div>
      <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 8px;">
        You've been invited to ${orgName}.
      </p>
      <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">
        ${inviterName ? `${inviterName} invited you` : 'You were invited'} to join as <strong>${roleLabel}</strong> on Tranche, the deal screening platform for asset-based lenders.
      </p>
      <div style="margin: 20px 0;">
        <a href="${signupUrl}" style="display: inline-block; background: #D4A843; color: #141210; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 8px;">
          Accept invitation
        </a>
      </div>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <span style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Invite Code</span>
        <p style="font-family: monospace; font-size: 16px; font-weight: 600; color: #111827; margin: 4px 0 0; letter-spacing: 0.05em;">${inviteCode}</p>
      </div>
      <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0;">
        If the button doesn't work, paste the code above on the join screen at <a href="${APP_URL}" style="color: #6b7280;">${APP_URL.replace(/^https?:\/\//, '')}</a>.
      </p>
    </div>
  `;
  return { subject, html };
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

  const { type, orgId } = req.body;

  if (!type || !orgId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Look up sender profile + org name (used by all notification types)
    const [{ data: senderProfile }, { data: org }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single(),
      supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single(),
    ]);

    const senderName = senderProfile?.full_name || senderProfile?.email || '';
    const orgName = org?.name || '';

    if (type === 'stage_change') {
      const { dealName, oldStage, newStage } = req.body;
      if (!dealName || !newStage) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { data: members } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('org_id', orgId)
        .neq('id', user.id);

      if (!members || members.length === 0) {
        return res.status(200).json({ sent: 0, message: 'No other team members to notify' });
      }

      const { subject, html } = stageChangeEmail({
        dealName, oldStage, newStage, movedBy: senderName, orgName,
      });

      const results = await Promise.allSettled(
        members.map((m) => sendEmail(m.email, subject, html))
      );
      const sent = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length;
      return res.status(200).json({ sent, total: members.length });
    }

    if (type === 'invite') {
      const { inviteCode, email, role } = req.body;
      if (!inviteCode || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { subject, html } = inviteEmail({
        inviteCode, role, orgName, inviterName: senderName,
      });

      const result = await sendEmail(email, subject, html);
      if (!result.success) {
        return res.status(502).json({ error: 'Email send failed', reason: result.reason });
      }
      return res.status(200).json({ sent: 1 });
    }

    return res.status(400).json({ error: 'Unknown notification type' });
  } catch (err) {
    console.error('[notify] Error:', err);
    return res.status(500).json({ error: 'Notification failed' });
  }
};
