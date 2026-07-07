// ============================================================
// Public access-request endpoint
// - Rate limited to 5/hr per IP
// - Writes a row to access_requests via service role
// - Notifies admin via Resend (best-effort, never blocks DB write)
// ============================================================

const { handlePreflight } = require('../server-lib/cors');
const { checkRateLimit } = require('../server-lib/rateLimit');
const { supabaseAdmin } = require('../server-lib/supabaseAdmin');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || 'Tranche <notifications@gettranche.app>';
const TO_EMAIL = process.env.REQUEST_ACCESS_TO_EMAIL;
const APP_URL = process.env.APP_URL || 'https://gettranche.app';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clip(s, max) {
  if (typeof s !== 'string') return '';
  const trimmed = s.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendNotificationEmail({ name, email, firm, role, notes, requestId }) {
  if (!RESEND_API_KEY || !TO_EMAIL) {
    console.log('[request-access] Email not sent: RESEND_API_KEY or REQUEST_ACCESS_TO_EMAIL not set.');
    return { sent: false, reason: 'config_missing' };
  }

  const subject = `[Tranche] Access request from ${name} (${firm})`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px;">
        <strong style="font-size: 16px; color: #111827;">Tranche</strong>
        <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">New access request</span>
      </div>
      <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px;">
        ${escapeHtml(name)} from ${escapeHtml(firm)} is requesting access.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #6b7280; width: 110px;">Name</td><td style="padding: 6px 0; color: #111827;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0; color: #111827;"><a href="mailto:${escapeHtml(email)}" style="color: #111827;">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Firm</td><td style="padding: 6px 0; color: #111827;">${escapeHtml(firm)}</td></tr>
        ${role ? `<tr><td style="padding: 6px 0; color: #6b7280;">Role</td><td style="padding: 6px 0; color: #111827;">${escapeHtml(role)}</td></tr>` : ''}
      </table>
      ${notes ? `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
          <span style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Notes</span>
          <p style="font-size: 14px; color: #111827; margin: 4px 0 0; white-space: pre-wrap;">${escapeHtml(notes)}</p>
        </div>
      ` : ''}
      <p style="color: #9ca3af; font-size: 11px; margin: 20px 0 0;">
        Request ID: ${escapeHtml(requestId)}<br/>
        View at ${escapeHtml(APP_URL)}
      </p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: TO_EMAIL, subject, html, reply_to: email }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[request-access] Resend error:', text);
      return { sent: false, reason: 'resend_error' };
    }
    return { sent: true };
  } catch (err) {
    console.error('[request-access] Resend exception:', err);
    return { sent: false, reason: 'resend_exception' };
  }
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkRateLimit(req, res, 'requestAccess')) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const body = req.body || {};
  const name = clip(body.name, 200);
  const email = clip(body.email, 320).toLowerCase();
  const firm = clip(body.firm, 200);
  const role = clip(body.role, 100) || null;
  const notes = clip(body.notes, 2000) || null;

  if (!name || !email || !firm) {
    return res.status(400).json({ error: 'Name, email, and firm are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || null;
  const userAgent = clip(req.headers['user-agent'], 500) || null;
  const referrer = clip(req.headers['referer'] || req.headers['referrer'], 500) || null;

  try {
    const { data: inserted, error: dbError } = await supabaseAdmin
      .from('access_requests')
      .insert({
        name, email, firm, role, notes,
        ip, user_agent: userAgent, referrer,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[request-access] DB insert error:', dbError);
      return res.status(500).json({ error: 'Could not submit request. Please try again.' });
    }

    // Email is best-effort (failure never fails the request), but it MUST
    // be awaited: Vercel freezes the function as soon as the response is
    // sent, which kills fire-and-forget work mid-flight (seen as ECONNRESET
    // during the TLS handshake to api.resend.com).
    await sendNotificationEmail({ name, email, firm, role, notes, requestId: inserted.id })
      .catch((err) => console.error('[request-access] Email send failed:', err));

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[request-access] Handler exception:', err);
    return res.status(500).json({ error: 'Could not submit request. Please try again.' });
  }
};
