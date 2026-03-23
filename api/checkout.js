// ============================================================
// /api/checkout — Stripe Checkout session creation
// Vercel serverless function (Node.js / CommonJS)
//
// Prerequisites:
//   1. npm install stripe
//   2. Set STRIPE_SECRET_KEY in Vercel env vars
//   3. Set STRIPE_PRICE_PRO_MONTHLY and/or STRIPE_PRICE_PRO_ANNUAL
//      to your Stripe Price IDs
//   4. Set NEXT_PUBLIC_APP_URL to your production URL
// ============================================================

const { handlePreflight } = require('./lib/cors');
const { checkRateLimit } = require('./lib/rateLimit');
const { supabaseAdmin } = require('./lib/supabaseAdmin');

async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkRateLimit(req, res)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Authenticate
  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check Stripe config
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(503).json({
      error: 'Payments not configured yet',
      message: 'Stripe integration is coming soon. Contact us for pilot access.',
    });
  }

  try {
    const stripe = require('stripe')(stripeKey);
    const { plan = 'pro_monthly' } = req.body || {};

    // Validate plan parameter
    const VALID_PLANS = ['pro_monthly', 'pro_annual', 'analyst_monthly', 'analyst_annual', 'enterprise_monthly', 'enterprise_annual'];
    if (!VALID_PLANS.includes(plan)) {
      return res.status(400).json({ error: `Invalid plan: ${plan}` });
    }

    // Map plan to Stripe Price ID
    const priceMap = {
      pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
    };

    const priceId = priceMap[plan];
    if (!priceId) {
      return res.status(400).json({ error: `Unknown plan: ${plan}` });
    }

    // Get user's org_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!profile?.org_id) {
      return res.status(400).json({ error: 'You must belong to an organization' });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}?checkout=cancelled`,
      metadata: {
        org_id: profile.org_id,
        user_id: user.id,
      },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
};
