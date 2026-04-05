const { createClient } = require('@supabase/supabase-js');
const {
  APPOINTMENT_RULES,
  findConflict,
  isSlotBookable,
} = require('./_appointment-utils');
const { upsertClientPipeline } = require('./_client-pipeline');
const { runScanConfirmation } = require('./confirm-scan');
const {
  getStripeClient,
  getStripeWebhookSecret,
  isConfigError,
} = require('./_stripe-config');

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function normalizeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function parseScheduledAt(value) {
  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  return scheduledAt;
}

function parseDurationMinutes(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  return APPOINTMENT_RULES.scan_3d.durationMinutes;
}

async function syncPaymentRecord(supabase, session, clientId, productType) {
  const timestamp = new Date().toISOString();
  const amountCents = Number.isInteger(session.amount_total) ? session.amount_total : 0;
  const currency = typeof session.currency === 'string' && session.currency
    ? session.currency.toLowerCase()
    : 'eur';

  const { data: existingRows, error: existingError } = await supabase
    .from('payments')
    .select('id, status')
    .eq('stripe_session_id', session.id)
    .limit(1);

  if (existingError) {
    throw new Error(`Supabase lecture payment: ${existingError.message}`);
  }

  const existingPayment = Array.isArray(existingRows) && existingRows.length > 0
    ? existingRows[0]
    : null;

  const payload = {
    client_id: clientId,
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent,
    type: productType || 'scan_3d',
    amount_cents: amountCents,
    currency,
    status: 'completed',
    description: `Stripe Checkout ${session.id}`,
    paid_at: timestamp
  };

  if (existingPayment) {
    const { error: updateError } = await supabase
      .from('payments')
      .update(payload)
      .eq('id', existingPayment.id);

    if (updateError) {
      throw new Error(`Supabase update payment: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from('payments')
      .insert([payload]);

    if (insertError) {
      throw new Error(`Supabase insert payment: ${insertError.message}`);
    }
  }

  return {
    existed: !!existingPayment,
    alreadyCompleted: !!(existingPayment && existingPayment.status === 'completed')
  };
}

async function findExistingScanAppointment(supabase, clientId, scheduledAtIso) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, client_id, type, status, scheduled_at, duration_minutes, location')
    .eq('client_id', clientId)
    .eq('type', 'scan_3d')
    .eq('scheduled_at', scheduledAtIso)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Supabase lecture appointment: ${error.message}`);
  }

  return (data || []).find((appointment) => appointment && appointment.status !== 'cancelled') || null;
}

async function ensureConfirmedScanAppointment(supabase, session, clientId) {
  const metadata = session.metadata || {};
  const scheduledAt = normalizeString(metadata.scheduled_at);
  const requestedStart = parseScheduledAt(scheduledAt);
  const durationMinutes = parseDurationMinutes(metadata.duration_minutes);
  const location = normalizeString(metadata.location);
  const eventTitle = normalizeString(metadata.event_title, 'Scan 3D Matterport');

  if (!requestedStart || !isSlotBookable('scan_3d', requestedStart)) {
    throw new Error('webhook-stripe: creneau scan invalide dans les metadata Stripe');
  }

  const scheduledAtIso = requestedStart.toISOString();
  const existingAppointment = await findExistingScanAppointment(supabase, clientId, scheduledAtIso);

  if (existingAppointment) {
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'confirmed',
        duration_minutes: durationMinutes,
        location: location || existingAppointment.location || '',
        notes: `Paiement Stripe confirme via session ${session.id}. ${eventTitle}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingAppointment.id);

    if (updateError) {
      throw new Error(`Supabase confirmation appointment: ${updateError.message}`);
    }

    return existingAppointment.id;
  }

  const conflict = await findConflict(supabase, requestedStart, durationMinutes);
  if (conflict) {
    throw new Error(`Creneau scan deja reserve (${conflict.id})`);
  }

  const { data: insertedAppointment, error: insertError } = await supabase
    .from('appointments')
    .insert([{
      client_id: clientId,
      type: 'scan_3d',
      status: 'confirmed',
      scheduled_at: scheduledAtIso,
      duration_minutes: durationMinutes,
      location,
      notes: `Paiement Stripe confirme via session ${session.id}. ${eventTitle}`,
    }])
    .select('id')
    .single();

  if (insertError || !insertedAppointment) {
    throw new Error(`Supabase insert appointment: ${insertError ? insertError.message : 'insert failed'}`);
  }

  return insertedAppointment.id;
}

async function updatePipelineStatus(supabase, clientId) {
  const { data: client, error } = await supabase
    .from('clients')
    .select('email')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase lecture client: ${error.message}`);
  }

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
}

async function handleCheckoutCompleted(session) {
  const metadata = session.metadata || {};
  const clientId = metadata.client_id;
  const productType = metadata.product_type || 'scan_3d';

  if (!clientId) {
    console.error('webhook-stripe: metadata manquante (client_id)');
    return;
  }

  const supabase = getSupabaseAdmin();
  const paymentSync = await syncPaymentRecord(supabase, session, clientId, productType);
  if (productType === 'virtual_tour') {
    if (paymentSync.alreadyCompleted) {
      console.log(`webhook-stripe: acces visite ${session.id} deja complete, reprise idempotente`);
    } else {
      console.log(`Paiement visite confirme - client: ${clientId}`);
    }
    return;
  }

  const appointmentId = await ensureConfirmedScanAppointment(supabase, session, clientId);

  if (paymentSync.alreadyCompleted) {
    console.log(`webhook-stripe: session ${session.id} deja completee, reprise des effets secondaires`);
  } else {
    console.log(`Paiement confirme - client: ${clientId}, RDV: ${appointmentId}`);
  }

  await updatePipelineStatus(supabase, clientId);

  const confirmationResult = await runScanConfirmation({
    clientId,
    appointmentId,
    logger: console
  });

  if (!confirmationResult.success) {
    console.warn('webhook-stripe confirmation incomplete:', confirmationResult);
    const error = new Error('Confirmation scan incomplete apres paiement Stripe');
    error.statusCode = confirmationResult.statusCode || 500;
    throw error;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!signature) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing stripe-signature header' }) };
  }

  let stripeEvent;

  try {
    const stripe = getStripeClient();
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      getStripeWebhookSecret()
    );
  } catch (err) {
    if (isConfigError(err)) {
      console.error('Stripe webhook config invalide:', err.message);
      return { statusCode: err.statusCode || 500, body: JSON.stringify({ error: err.message }) };
    }

    console.error('Stripe webhook signature invalide:', err.message);
    return { statusCode: 400, body: `Webhook error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(stripeEvent.data.object);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
