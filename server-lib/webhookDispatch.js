// ============================================================
// Webhook Dispatch — fires webhooks for an org's configured endpoints
// ============================================================

const crypto = require('crypto');
const { supabaseAdmin } = require('./supabaseAdmin');

/**
 * Sign a payload with HMAC-SHA256.
 */
function signPayload(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
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

    const results = await Promise.allSettled(
      matching.map(async (hook) => {
        const signature = signPayload(body, hook.secret);
        let statusCode = 0;
        let errMsg = null;

        try {
          const res = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tranche-Signature': signature,
              'X-Tranche-Event': event,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
          });
          statusCode = res.status;
        } catch (err) {
          statusCode = 0;
          errMsg = err.message;
        }
        console.log(`[webhooks] -> ${hook.url} event=${event} status=${statusCode}${errMsg ? ' err=' + errMsg : ''}`);

        supabaseAdmin
          .from('webhook_logs')
          .insert({ webhook_id: hook.id, event, status_code: statusCode })
          .then(() => {})
          .catch(() => {});
        return { id: hook.id, statusCode };
      })
    );
    return { dispatched: matching.length, results: results.map((r) => r.value || { error: r.reason?.message }) };
  } catch (err) {
    console.error('[webhooks] Dispatch error:', err.message);
    return { dispatched: 0, reason: 'exception', error: err.message };
  }
}

module.exports = { dispatchWebhooks, signPayload };
