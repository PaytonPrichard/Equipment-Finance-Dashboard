const { handlePreflight, setCorsHeaders } = require('../server-lib/cors');
const { checkRateLimit } = require('../server-lib/rateLimit');

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (!checkRateLimit(req, res, 'default')) {
    return res.status(429).json({ rate: null, error: 'Too many requests' });
  }

  const key = process.env.FRED_API_KEY;

  if (!key) {
    res.status(500).json({ rate: null, error: 'Server configuration error' });
    return;
  }

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=SOFR&api_key=${key}&file_type=json&sort_order=desc&limit=5`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      res.status(500).json({ rate: null, error: 'Upstream API request failed' });
      return;
    }

    const data = await response.json();
    const obs = data.observations?.find((o) => o.value !== '.');

    if (!obs) {
      res.status(500).json({ rate: null, error: 'No valid SOFR observation found' });
      return;
    }

    const rate = parseFloat(obs.value) / 100;

    if (isNaN(rate) || rate <= 0 || rate >= 0.20) {
      res.status(500).json({ rate: null, error: 'SOFR rate outside valid range' });
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=14400');
    res.status(200).json({ rate, date: obs.date, source: 'FRED' });
  } catch {
    res.status(500).json({ rate: null, error: 'Failed to fetch SOFR rate' });
  }
};
