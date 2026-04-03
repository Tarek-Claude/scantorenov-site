const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { upsertClientPipeline } = require('./_client-pipeline');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const SITE_URL = process.env.URL || 'http://localhost:8888';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Stripe webhook signature invalide:', err.message);
    return { statusCode: 400, body: `Webhook error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    // Idempotence : vérifier si ce session.id a déjà été traité
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('stripe_session_id', session.id)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingPayment) {
      console.log(`webhook-stripe: session ${session.id} déjà traitée, ignorée (idempotence)`);
      return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
    }

    await handleCheckoutCompleted(session);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

async function handleCheckoutCompleted(session) {
  const metadata = session.metadata || {};
  const clientId = metadata.client_id;
  const appointmentId = metadata.appointment_id;

  if (!clientId || !appointmentId) {
    console.error('webhook-stripe: metadata manquante (client_id, appointment_id)');
    return;
  }

  console.log(`Paiement confirmé - client: ${clientId}, RDV: ${appointmentId}`);

  await supabase
    .from('payments')
    .update({
      status: 'completed',
      stripe_payment_intent: session.payment_intent,
      paid_at: new Date().toISOString()
    })
    .eq('stripe_session_id', session.id);

  await supabase
    .from('appointments')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', appointmentId);

  const { data: client } = await supabase
    .from('clients')
    .select('email')
    .eq('id', clientId)
    .maybeSingle();

  if (client && client.email) {
    try {
      await upsertClientPipeline({
        email: client.email,
        status: 'scan_payment_completed',
        strict: true,
      });
    } catch (pipelineError) {
      console.warn('webhook-stripe pipeline update failed:', pipelineError.message);
    }
  }

  try {
    const response = await fetch(`${SITE_URL}/.netlify/functions/confirm-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': process.env.ADMIN_SECRET
      },
      body: JSON.stringify({ clientId, appointmentId })
    });

    if (!response.ok) {
      console.error('confirm-scan call failed:', await response.text());
    }
  } catch (err) {
    console.error('Erreur déclenchement confirm-scan:', err.message);
  }
}
