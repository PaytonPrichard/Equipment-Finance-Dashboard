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
    const { data: hooks } = await supabaseAdmin
      .from('webhooks')
      .select('id, url, secret, events')
      .eq('org_id', orgId)
      .eq('active', true);

    if (!hooks || hooks.length === 0) return;

    const matching = hooks.filter((h) => h.events && h.events.includes(event));
    if (matching.length === 0) return;

    const body = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    await Promise.allSettled(
      matching.map(async (hook) => {
        const signature = signPayload(body, hook.secret);
        let statusCode = 0;

        try {
          const res = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tranche-Signature': signature,
              'X-Tranche-Event': event,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000), // 10s timeout
          });
          statusCode = res.status;
        } catch (err) {
          statusCode = 0; // network error
        }

        // Log delivery (fire and forget)
        supabaseAdmin
          .from('webhook_logs')
          .insert({ webhook_id: hook.id, event, status_code: statusCode })
          .then(() => {})
          .catch(() => {});
      })
    );
  } catch (err) {
    console.error('[webhooks] Dispatch error:', err.message);
  }
}

module.exports = { dispatchWebhooks, signPayload };
