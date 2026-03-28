const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { resolveIdentityClient } = require('./_identity-client');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const SITE_URL = process.env.URL || 'http://localhost:8888';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const identityUser = context && context.clientContext ? context.clientContext.user : null;
  if (!identityUser) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  try {
    const requestedClientId = body.clientId;
    const appointmentId = body.appointmentId;
    const productType = body.productType || 'scan_3d';

    if (!appointmentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'appointmentId requis' })
      };
    }

    if (productType !== 'scan_3d') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Produit invalide' })
      };
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY non configuré');
    }

    if (!process.env.STRIPE_PRICE_SCAN_ID) {
      throw new Error('STRIPE_PRICE_SCAN_ID non configuré');
    }

    const resolution = await resolveIdentityClient({
      context,
      requestedClientId,
      createIfMissing: false
    });
    const client = resolution.client;
    const clientId = client.id;

    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .select('id, client_id, type, scheduled_at, status')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appt) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'RDV introuvable' }) };
    }

    if (appt.client_id !== clientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'RDV non associé au client connecté' })
      };
    }

    if (appt.type !== 'scan_3d') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Type de RDV invalide' }) };
    }

    if (!['requested', 'scheduled'].includes(appt.status)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Statut de RDV invalide : ${appt.status}` })
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_SCAN_ID, quantity: 1 }],
      mode: 'payment',
      customer_email: client.email,
      success_url: `${SITE_URL}/espace-client.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/espace-client.html?payment=cancelled`,
      metadata: {
        client_id: clientId,
        appointment_id: appointmentId,
        product_type: 'scan_3d'
      }
    });

    await supabase
      .from('payments')
      .insert([{
        client_id: clientId,
        stripe_session_id: session.id,
        type: 'scan_3d',
        amount_cents: 18000,
        currency: 'eur',
        status: 'pending',
        description: `Scan 3D Matterport - RDV ${appt.scheduled_at}`
      }]);

    console.log(`Session Stripe créée: ${session.id} pour client ${clientId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ checkoutUrl: session.url, sessionId: session.id })
    };
  } catch (err) {
    const statusCode = err && err.statusCode ? err.statusCode : 500;
    console.error('create-checkout error:', err);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: err && err.message ? err.message : 'Internal server error' })
    };
  }
};
