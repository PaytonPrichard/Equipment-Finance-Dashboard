// Rate limiter with in-memory store + per-endpoint limits
// In-memory store resets on cold start, but provides burst protection.
// For critical auth endpoints, limits are stricter.
// For production scale, replace with Upstash Redis.

const store = new Map();

const LIMITS = {
  default: { windowMs: 60 * 1000, max: 60 },       // 60 req/min
  auth: { windowMs: 60 * 1000, max: 10 },           // 10 req/min for auth
  checkout: { windowMs: 60 * 1000, max: 5 },        // 5 req/min for checkout
  webhook: { windowMs: 60 * 1000, max: 100 },       // 100 req/min for webhooks
};

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.start > 120000) {
      store.delete(key);
    }
  }
}

/**
 * Returns true if the request should be allowed, false if rate limited.
 * @param {string} tier - 'default' | 'auth' | 'checkout' | 'webhook'
 */
function checkRateLimit(req, res, tier = 'default') {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';

  const { windowMs, max } = LIMITS[tier] || LIMITS.default;
  const key = `${tier}:${ip}`;
  const now = Date.now();

  if (store.size > 10000) cleanup();

  let entry = store.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    store.set(key, entry);
  }

  entry.count++;

  const remaining = Math.max(0, max - entry.count);
  const resetAt = Math.ceil((entry.start + windowMs) / 1000);

  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetAt));

  if (entry.count > max) {
    res.setHeader('Retry-After', String(Math.ceil((entry.start + windowMs - now) / 1000)));
    return false;
  }

  return true;
}

module.exports = { checkRateLimit };
