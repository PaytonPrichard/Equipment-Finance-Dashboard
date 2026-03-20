// CORS helper — restricts origins in production, allows all in dev

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
];

// Add your production domain(s) here or via env var
if (process.env.ALLOWED_ORIGIN) {
  ALLOWED_ORIGINS.push(process.env.ALLOWED_ORIGIN);
}
if (process.env.VERCEL_URL) {
  ALLOWED_ORIGINS.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  ALLOWED_ORIGINS.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';

  // In development or if origin matches whitelist, reflect it
  if (!origin || ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    // For unrecognized origins, don't set the header (browser will block)
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

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
