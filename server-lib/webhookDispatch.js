// ============================================================
// Webhook Dispatch — fires webhooks for an org's configured endpoints
// ============================================================

const crypto = require('crypto');
const { supabaseAdmin } = require('./supabaseAdmin');

/**
 * Sign a delivery with HMAC-SHA256 over "<timestamp>.<raw body>".
 *
 * The timestamp travels in X-Tranche-Timestamp. Signing it with the body
 * lets a receiver reject an old delivery replayed later (Stripe's scheme).
 * Receivers should check the signature against the raw body as received,
 * and refuse a timestamp more than five minutes old.
 */
function signPayload(rawBody, secret, timestamp) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

// Webhook addresses must be https and must not name this network or a
// private one. This blocks the obvious cases (localhost, private and
// link-local IP literals such as the cloud metadata address). A public name
// that resolves to a private address is not caught: admins set these, and
// Vercel functions do not sit on a private network with anything to reach.
function isPrivateIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Returns an error message, or null when the URL is acceptable. */
function checkWebhookUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return 'Invalid URL format'; }
  if (u.protocol !== 'https:') return 'Webhook URL must use https';
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return 'Webhook URL must be a public address';
  }
  if (isPrivateIPv4(host)) return 'Webhook URL must be a public address';
  if (host.startsWith('[')) return 'Webhook URL must use a host name, not an IPv6 address';
  return null;
}

/**
 * Dispatch webhooks for an event.
 * Looks up active webhooks for the org, filters by event, fires POST requests.
 * Fire-and-forget — never blocks the caller. Logs results.
 *
 * @param {string} orgId - Organization ID
 * @param {string} event - Event name (deal.created, deal.scored, pipeline.stage_changed)
 * @param {object} payload - Event data to send
 */
async function dispatchWebhooks(orgId, event, payload) {
  try {
    const { data: hooks, error: queryErr } = await supabaseAdmin
      .from('webhooks')
      .select('id, url, secret, events')
      .eq('org_id', orgId)
      .eq('active', true);

    if (queryErr) {
      console.error(`[webhooks] query error for org=${orgId} event=${event}:`, queryErr.message);
      return { dispatched: 0, reason: 'query_error', error: queryErr.message };
    }
    if (!hooks || hooks.length === 0) {
      console.log(`[webhooks] no active webhooks for org=${orgId} event=${event}`);
      return { dispatched: 0, reason: 'no_active_webhooks' };
    }

    const matching = hooks.filter((h) => h.events && h.events.includes(event));
    if (matching.length === 0) {
      console.log(`[webhooks] ${hooks.length} active webhook(s) for org=${orgId} but none subscribe to ${event}`);
      return { dispatched: 0, reason: 'no_matching_event', total_active: hooks.length };
    }
    console.log(`[webhooks] dispatching ${event} to ${matching.length} endpoint(s) for org=${orgId}`);

    const body = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };
    const rawBody = JSON.stringify(body);
    const unixTs = Math.floor(Date.now() / 1000);

    const results = await Promise.allSettled(
      matching.map(async (hook) => {
        const signature = signPayload(rawBody, hook.secret, unixTs);
        let statusCode = 0;
        let errMsg = null;

        try {
          const res = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tranche-Signature': signature,
              'X-Tranche-Timestamp': String(unixTs),
              'X-Tranche-Event': event,
            },
            body: rawBody,
            signal: AbortSignal.timeout(10000),
          });
          statusCode = res.status;
        } catch (err) {
          statusCode = 0;
          errMsg = err.message;
        }
        console.log(`[webhooks] -> ${hook.url} event=${event} status=${statusCode}${errMsg ? ' err=' + errMsg : ''}`);

        // Awaited: fire-and-forget dies when the serverless function
        // freezes after the response is sent. Failure is still swallowed.
        try {
          await supabaseAdmin
            .from('webhook_logs')
            .insert({ webhook_id: hook.id, event, status_code: statusCode });
        } catch { /* log insert is best-effort */ }
        return { id: hook.id, statusCode };
      })
    );
    return { dispatched: matching.length, results: results.map((r) => r.value || { error: r.reason?.message }) };
  } catch (err) {
    console.error('[webhooks] Dispatch error:', err.message);
    return { dispatched: 0, reason: 'exception', error: err.message };
  }
}

module.exports = { dispatchWebhooks, signPayload, checkWebhookUrl };
