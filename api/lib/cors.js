// CORS helper — strict origin whitelist

const IS_PROD = process.env.NODE_ENV === 'production' || process.env.VERCEL;

const ALLOWED_ORIGINS = [];

// Production origins only
if (process.env.ALLOWED_ORIGIN) {
  ALLOWED_ORIGINS.push(process.env.ALLOWED_ORIGIN);
}
if (process.env.VERCEL_URL) {
  ALLOWED_ORIGINS.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  ALLOWED_ORIGINS.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
}

// Development only
if (!IS_PROD) {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:5173');
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';

  // Strict match: origin must be in whitelist
  if (origin && ALLOWED_ORIGINS.some((allowed) => origin === allowed || origin.startsWith(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!IS_PROD && !origin) {
    // Allow same-origin requests in dev
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  // If origin doesn't match, no Access-Control-Allow-Origin header is set (browser blocks)

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.status(204).end();
    return true;
  }
  setCorsHeaders(req, res);
  return false;
}

module.exports = { handlePreflight, setCorsHeaders };
