const { createClient } = require('@supabase/supabase-js');
const {
  APPOINTMENT_RULES,
  findConflict,
  isSlotBookable,
} = require('./_appointment-utils');
const {
  createConfigError,
  getSiteUrl,
  getStripeClient,
  getStripePriceScanId,
  getStripePriceVisitId,
} = require('./_stripe-config');
const { isPromoPendingValidationAppointment } = require('./_promo-config');
const { resolveIdentityClient } = require('./_identity-client');
const { buildPaymentAccessSummary, fetchClientPayments } = require('./_payment-access');
const { getStatusRank, normalizeClientStatus } = require('./_cockpit-config');

const EXPECTED_SCAN_AMOUNT_CENTS = 18000;
const EXPECTED_VISIT_AMOUNT_CENTS = 12000;
const EXPECTED_SCAN_CURRENCY = 'eur';
const EXPECTED_VISIT_CURRENCY = 'eur';

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function formatAmount(amountCents, currency) {
  if (!Number.isFinite(amountCents)) {
    return 'montant inconnu';
  }

  return `${(amountCents / 100).toFixed(2)} ${(currency || '').toUpperCase()}`;
}

function normalizeString(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function sanitizeMetadataValue(value, fallback = '') {
  return normalizeString(value, fallback).slice(0, 500);
}

function parseRequestedStart(value) {
  const requestedStart = new Date(value);
  if (Number.isNaN(requestedStart.getTime())) {
    return null;
  }

  return requestedStart;
}

async function listExistingScanAppointments(supabase, clientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, status, scheduled_at, notes')
    .eq('client_id', clientId)
    .eq('type', 'scan_3d')
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Lecture rendez-vous scan: ${error.message}`);
  }

  return data || [];
}

function findExistingPaidScanAppointment(appointments) {
  return (appointments || []).find((appointment) =>
    appointment && ['confirmed', 'completed'].includes(appointment.status)
  ) || null;
}

function findExistingPromoPendingScanAppointment(appointments) {
  return (appointments || []).find(isPromoPendingValidationAppointment) || null;
}

async function loadConfiguredPrice(stripe, options) {
  const {
    priceId,
    productLabel,
    expectedAmountCents,
    expectedCurrency,
  } = options;
  const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });

  if (!price || !price.active) {
    throw createConfigError(`${productLabel} pointe vers un tarif Stripe inactif`);
  }

  if (price.type !== 'one_time') {
    throw createConfigError(`${productLabel} doit pointer vers un tarif ponctuel`);
  }

  if (price.currency !== expectedCurrency) {
    throw createConfigError(
      `${productLabel} utilise ${String(price.currency || '').toUpperCase()} au lieu de ${String(expectedCurrency || '').toUpperCase()}`
    );
  }

  if (price.unit_amount !== expectedAmountCents) {
    throw createConfigError(
      `${productLabel} pointe vers ${formatAmount(price.unit_amount, price.currency)} alors que le montant attendu est ${formatAmount(expectedAmountCents, expectedCurrency)}`
    );
  }

  return price;
}

async function loadConfiguredScanPrice(stripe) {
  return loadConfiguredPrice(stripe, {
    priceId: getStripePriceScanId(),
    productLabel: 'STRIPE_PRICE_SCAN_ID',
    expectedAmountCents: EXPECTED_SCAN_AMOUNT_CENTS,
    expectedCurrency: EXPECTED_SCAN_CURRENCY,
  });
}

async function loadConfiguredVisitPrice(stripe) {
  return loadConfiguredPrice(stripe, {
    priceId: getStripePriceVisitId(),
    productLabel: 'STRIPE_PRICE_VISIT_ID',
    expectedAmountCents: EXPECTED_VISIT_AMOUNT_CENTS,
    expectedCurrency: EXPECTED_VISIT_CURRENCY,
  });
}

function canPurchaseVirtualTour(status) {
  const normalizedStatus = normalizeClientStatus(status);
  return getStatusRank(normalizedStatus) >= getStatusRank('scan_payment_completed');
}

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
    const productType = body.productType || 'scan_3d';
    if (!['scan_3d', 'virtual_tour'].includes(productType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Produit invalide' })
      };
    }

    const stripe = getStripeClient();
    const siteUrl = getSiteUrl();
    const supabase = getSupabaseAdmin();

    const resolution = await resolveIdentityClient({
      context,
      requestedClientId,
      createIfMissing: false
    });
    const client = resolution.client;
    const clientId = client.id;
    const payments = Array.isArray(resolution.payments) ? resolution.payments : await fetchClientPayments(supabase, clientId);
    const paymentAccess = buildPaymentAccessSummary(payments, client);

    if (productType === 'scan_3d') {
      const requestedStart = parseRequestedStart(body.scheduledAt);
      const durationMinutes = APPOINTMENT_RULES.scan_3d.durationMinutes;

      if (!requestedStart) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'scheduledAt requis et valide' })
        };
      }

      if (!isSlotBookable('scan_3d', requestedStart)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Creneau hors des regles de reservation' })
        };
      }

      if (!['call_done', 'scan_scheduled'].includes(client.status)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: `Statut invalide : ${client.status} (attendu: call_done)`
          })
        };
      }

      const existingScanAppointments = await listExistingScanAppointments(supabase, clientId);
      const existingPaidScan = findExistingPaidScanAppointment(existingScanAppointments);
      if (existingPaidScan) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            error: 'Un rendez-vous scan est deja confirme pour ce dossier'
          })
        };
      }

      const existingPromoPendingScan = findExistingPromoPendingScanAppointment(existingScanAppointments);
      if (existingPromoPendingScan) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            error: 'Un creneau scan par code promo attend deja une validation interne'
          })
        };
      }

      if (!client.email) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email client introuvable' })
        };
      }

      const conflict = await findConflict(supabase, requestedStart, durationMinutes);
      if (conflict) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: 'Ce creneau est deja indisponible' })
        };
      }

      const configuredPrice = await loadConfiguredScanPrice(stripe);
      const location = sanitizeMetadataValue(body.location || client.adresse || '', '');
      const eventTitle = sanitizeMetadataValue(body.eventTitle || 'Scan 3D Matterport', 'Scan 3D Matterport');

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: configuredPrice.id, quantity: 1 }],
        mode: 'payment',
        customer_email: client.email,
        success_url: `${siteUrl}/espace-client.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/espace-client.html?payment=cancelled`,
        metadata: {
          client_id: clientId,
          product_type: 'scan_3d',
          scheduled_at: requestedStart.toISOString(),
          duration_minutes: String(durationMinutes),
          location,
          event_title: eventTitle
        }
      });

      if (!session.url) {
        throw new Error('Stripe checkout session creee sans URL de redirection');
      }

      await supabase
        .from('payments')
        .insert([{
          client_id: clientId,
          stripe_session_id: session.id,
          type: 'scan_3d',
          amount_cents: configuredPrice.unit_amount,
          currency: configuredPrice.currency,
          status: 'pending',
          description: `Scan 3D Matterport - ${requestedStart.toISOString()}`
        }]);

      console.log(`Session Stripe creee: ${session.id} pour client ${clientId}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ checkoutUrl: session.url, sessionId: session.id })
      };
    }

    if (!canPurchaseVirtualTour(client.status)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: `Statut invalide : ${client.status} (attendu: scan_payment_completed ou plus)`
        })
      };
    }

    if (paymentAccess.virtualTourUnlocked) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'L acces visite virtuelle est deja active pour ce dossier' })
      };
    }

    if (!client.email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email client introuvable' })
      };
    }

    const configuredVisitPrice = await loadConfiguredVisitPrice(stripe);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: configuredVisitPrice.id, quantity: 1 }],
      mode: 'payment',
      customer_email: client.email,
      success_url: `${siteUrl}/espace-client.html?payment=success&product=virtual_tour&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/espace-client.html?payment=cancelled&product=virtual_tour`,
      metadata: {
        client_id: clientId,
        product_type: 'virtual_tour',
        event_title: 'Accessibilite visite virtuelle Matterport et services associes'
      }
    });

    if (!session.url) {
      throw new Error('Stripe checkout session creee sans URL de redirection');
    }

    await supabase
      .from('payments')
      .insert([{
        client_id: clientId,
        stripe_session_id: session.id,
        type: 'virtual_tour',
        amount_cents: configuredVisitPrice.unit_amount,
        currency: configuredVisitPrice.currency,
        status: 'pending',
        description: 'Accessibilite visite virtuelle Matterport et services associes'
      }]);

    console.log(`Session Stripe visite creee: ${session.id} pour client ${clientId}`);

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
