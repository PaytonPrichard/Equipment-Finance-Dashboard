// ============================================================
// /api/webhook — Stripe Webhook handler
// Vercel serverless function (Node.js / CommonJS)
//
// Prerequisites:
//   1. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel env vars
//   2. Configure Stripe webhook endpoint to POST to /api/webhook
//   3. Subscribe to: checkout.session.completed, customer.subscription.deleted
// ============================================================

const { supabaseAdmin } = require('./lib/supabaseAdmin');

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const stripe = require('stripe')(stripeKey);

  let event;
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orgId = session.metadata?.org_id;

      if (orgId) {
        // Activate the pro plan
        const { error } = await supabaseAdmin
          .from('organizations')
          .update({
            plan: 'pro',
            plan_started_at: new Date().toISOString(),
            plan_expires_at: null, // Subscription-based, no fixed expiry
            max_users: 25,
          })
          .eq('id', orgId);

        if (error) {
          console.error('Failed to activate plan:', error);
        } else {
          console.log(`Pro plan activated for org ${orgId}`);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      // Subscription cancelled — downgrade to free
      const subscription = event.data.object;
      const customerEmail = subscription.customer_email || subscription.metadata?.email;

      if (customerEmail) {
        // Find org by matching the email to a profile
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('org_id')
          .eq('email', customerEmail)
          .single();

        if (profile?.org_id) {
          const { error } = await supabaseAdmin
            .from('organizations')
            .update({
              plan: 'free',
              plan_expires_at: new Date().toISOString(),
            })
            .eq('id', profile.org_id);

          if (error) {
            console.error('Failed to downgrade plan:', error);
          } else {
            console.log(`Plan downgraded to free for org ${profile.org_id}`);
          }
        }
      } else {
        console.warn('Subscription cancelled but no customer email found:', subscription.id);
      }
      break;
    }

    default:
      // Unhandled event type
      break;
  }

  return res.status(200).json({ received: true });
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
