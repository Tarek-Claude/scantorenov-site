const { createClient } = require('@supabase/supabase-js');
const {
  APPOINTMENT_RULES,
  findConflict,
  isSlotBookable,
} = require('./_appointment-utils');
const {
  buildPromoPendingValidationNote,
  isPromoPendingValidationAppointment,
  maskPromoCode,
  requireValidPromoCode,
} = require('./_promo-config');
const { resolveIdentityClient } = require('./_identity-client');
const { buildPaymentAccessSummary, fetchClientPayments } = require('./_payment-access');
const { getStatusRank, normalizeClientStatus } = require('./_cockpit-config');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function normalizeString(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function parseRequestedStart(value) {
  const requestedStart = new Date(value);
  if (Number.isNaN(requestedStart.getTime())) {
    return null;
  }

  return requestedStart;
}

async function listScanAppointments(supabase, clientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, status, scheduled_at, duration_minutes, location, notes')
    .eq('client_id', clientId)
    .eq('type', 'scan_3d')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Lecture rendez-vous scan: ${error.message}`);
  }

  return data || [];
}

function findConfirmedScanAppointment(appointments) {
  return (appointments || []).find((appointment) =>
    appointment && ['confirmed', 'completed'].includes(appointment.status)
  ) || null;
}

function findPromoPendingScanAppointment(appointments) {
  return (appointments || []).find(isPromoPendingValidationAppointment) || null;
}

function canUnlockVirtualTour(status) {
  const normalizedStatus = normalizeClientStatus(status);
  return getStatusRank(normalizedStatus) >= getStatusRank('scan_payment_completed');
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const identityUser = context && context.clientContext ? context.clientContext.user : null;
  if (!identityUser) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  try {
    const requestedClientId = body.clientId;
    const productType = body.productType || 'scan_3d';
    if (!['scan_3d', 'virtual_tour'].includes(productType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Produit promo non pris en charge' })
      };
    }

    requireValidPromoCode(productType, body.promoCode);

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

    if (productType === 'virtual_tour') {
      if (!canUnlockVirtualTour(client.status)) {
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

      const maskedCode = maskPromoCode(body.promoCode);
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          client_id: clientId,
          type: 'virtual_tour',
          amount_cents: 0,
          currency: 'eur',
          status: 'completed',
          paid_at: new Date().toISOString(),
          description: `Code promo ${maskedCode} - Acces visite virtuelle Matterport et services associes`
        }]);

      if (paymentError) {
        throw new Error(`Enregistrement paiement promo visite: ${paymentError.message}`);
      }

      console.log(`Promo visite appliquee pour client ${clientId}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          unlocked: true,
          productType: 'virtual_tour',
          message: 'Code promo applique. L acces visite virtuelle est active.'
        })
      };
    }

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

    const existingAppointments = await listScanAppointments(supabase, clientId);
    const existingConfirmedScan = findConfirmedScanAppointment(existingAppointments);
    if (existingConfirmedScan) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Un rendez-vous scan est deja confirme pour ce dossier' })
      };
    }

    const existingPromoPendingScan = findPromoPendingScanAppointment(existingAppointments);
    if (existingPromoPendingScan) {
      if (existingPromoPendingScan.scheduled_at === requestedStart.toISOString()) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            appointmentId: existingPromoPendingScan.id,
            requiresDashboardValidation: true,
            message: 'Ce creneau promo est deja en attente de validation dashboard.'
          })
        };
      }

      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'Un creneau scan est deja en attente de validation. Contactez ScantoRenov pour le modifier.'
        })
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

    const maskedCode = maskPromoCode(body.promoCode);
    const scheduledAtIso = requestedStart.toISOString();
    const location = normalizeString(body.location || client.adresse || '', '');
    const eventTitle = normalizeString(body.eventTitle || 'Scan 3D Matterport', 'Scan 3D Matterport');
    const appointmentNote = buildPromoPendingValidationNote(maskedCode, eventTitle);

    const { data: insertedAppointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert([{
        client_id: clientId,
        type: 'scan_3d',
        status: 'requested',
        scheduled_at: scheduledAtIso,
        duration_minutes: durationMinutes,
        location,
        notes: appointmentNote,
      }])
      .select('id, status, scheduled_at')
      .single();

    if (appointmentError || !insertedAppointment) {
      throw new Error(`Creation rendez-vous promo: ${appointmentError ? appointmentError.message : 'insert failed'}`);
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .insert([{
        client_id: clientId,
        type: 'scan_3d',
        amount_cents: 0,
        currency: 'eur',
        status: 'completed',
        description: `Code promo ${maskedCode} - ${eventTitle} - validation dashboard requise`,
        paid_at: new Date().toISOString()
      }]);

    if (paymentError) {
      throw new Error(`Enregistrement paiement promo: ${paymentError.message}`);
    }

    console.log(`Promo scan appliquee pour client ${clientId} sur ${scheduledAtIso}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        appointmentId: insertedAppointment.id,
        requiresDashboardValidation: true,
        appointment: insertedAppointment,
        message: 'Code promo applique. Le rendez-vous attend la validation du dashboard.'
      })
    };
  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    console.error('apply-promo-bypass error:', error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: error && error.message ? error.message : 'Internal server error'
      })
    };
  }
};
