// Simple in-memory rate limiter for Vercel serverless functions
// Note: Each cold start resets the store. For production at scale,
// use Vercel KV or Upstash Redis instead.

const store = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 60; // 60 requests per minute per IP

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.start > WINDOW_MS) {
      store.delete(key);
    }
  }
}

/**
 * Returns true if the request should be allowed, false if rate limited.
 * Sets appropriate headers on the response.
 */
function checkRateLimit(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';

  const now = Date.now();

  // Periodic cleanup
  if (store.size > 10000) cleanup();

  let entry = store.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { start: now, count: 0 };
    store.set(ip, entry);
  }

  entry.count++;

  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  const resetAt = Math.ceil((entry.start + WINDOW_MS) / 1000);

  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetAt));

  if (entry.count > MAX_REQUESTS) {
    res.setHeader('Retry-After', String(Math.ceil((entry.start + WINDOW_MS - now) / 1000)));
    return false;
  }

  return true;
}

module.exports = { checkRateLimit };
