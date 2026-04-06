const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');
const {
  getStatusRank,
  isPipelineStatus,
  normalizeClientStatus,
  getStatusLabel,
} = require('./_cockpit-config');
const { enrichClientProgress } = require('./_admin-client-progress');
const { safeReconcileClientTasks } = require('./_cockpit-engine');
const { fetchClientPayments } = require('./_payment-access');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-session, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const STATUS_PHASE_MAP = Object.freeze({
  contact_submitted: 3,
  identity_created: 3,
  onboarding_completed: 3,
  call_requested: 3,
  call_done: 4,
  scan_scheduled: 4,
  scan_payment_completed: 5,
  scan_completed: 5,
  analysis_ready: 5,
  avant_projet_ready: 6,
  avant_projet_transmitted: 7,
  accompaniment_subscribed: 7,
});

const PROJECT_FIELDS = Object.freeze([
  'project_type',
  'project_details',
  'type_bien',
  'demande',
  'adresse',
  'surface',
  'budget',
  'echeance',
]);

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function isMissingTableError(error) {
  return error && (error.code === '42P01' || error.code === 'PGRST205');
}

function appendAuditSuffix(text, suffix) {
  const current = typeof text === 'string' ? text.trim() : '';
  return current ? `${current}\n${suffix}` : suffix;
}

function getEffectiveStatus(client, appointments, payments) {
  const enriched = enrichClientProgress(client, appointments || [], payments || []);
  return normalizeClientStatus(enriched && enriched.status)
    || normalizeClientStatus(client && client.status)
    || 'contact_submitted';
}

function buildClientPatch(targetStatus, timestamp) {
  const targetRank = getStatusRank(targetStatus);
  const patch = {
    status: targetStatus,
    phase: STATUS_PHASE_MAP[targetStatus] || 3,
    updated_at: timestamp,
  };

  if (targetRank < getStatusRank('onboarding_completed')) {
    PROJECT_FIELDS.forEach((field) => {
      patch[field] = null;
    });
  }

  if (targetRank < getStatusRank('call_requested')) {
    patch.call_scheduled_at = null;
  }

  if (targetRank < getStatusRank('call_done')) {
    patch.call_notes = null;
  }

  if (targetRank < getStatusRank('scan_scheduled')) {
    patch.scan_confirmed_by_client = false;
    patch.scan_date_confirmed = null;
    patch.scan_date_proposed = null;
  }

  if (targetRank < getStatusRank('scan_completed')) {
    patch.matterport_model_id = null;
    patch.matterport_url = null;
    patch.matterport_iframe = null;
    patch.matterport_data = null;
  }

  if (targetRank < getStatusRank('analysis_ready')) {
    patch.marcel_enabled = false;
    patch.photos_urls = null;
    patch.plans_urls = null;
  }

  if (targetRank < getStatusRank('avant_projet_ready')) {
    patch.avant_projet_enabled = false;
    patch.proposal_url = null;
  }

  if (targetRank < getStatusRank('avant_projet_transmitted')) {
    patch.avant_projet_transmitted_at = null;
  }

  return patch;
}

function shouldCancelAppointment(appointment, targetRank) {
  if (!appointment || appointment.status === 'cancelled') {
    return false;
  }

  if (targetRank < getStatusRank('call_requested')) {
    return true;
  }

  if (appointment.type === 'scan_3d' && targetRank < getStatusRank('scan_payment_completed')) {
    return true;
  }

  if (appointment.type === 'phone_call' && targetRank < getStatusRank('call_done')) {
    return true;
  }

  return false;
}

function shouldCancelPayment(payment, targetRank) {
  if (!payment || payment.status === 'cancelled') {
    return false;
  }

  if (payment.type === 'scan_3d' && targetRank < getStatusRank('scan_payment_completed')) {
    return true;
  }

  if (payment.type === 'virtual_tour' && targetRank < getStatusRank('analysis_ready')) {
    return true;
  }

  return false;
}

async function fetchAppointments(supabase, clientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, client_id, type, status, scheduled_at, duration_minutes, location, notes, created_at')
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: true });

  if (error && !isMissingTableError(error)) {
    throw new Error(`Lecture rendez-vous: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

async function fetchPayments(supabase, clientId) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, type, status, description, paid_at, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error && !isMissingTableError(error)) {
    throw new Error(`Lecture paiements: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

async function rewindAppointments(supabase, appointments, targetStatus, timestamp) {
  const targetRank = getStatusRank(targetStatus);
  const summary = {
    cancelledPhoneAppointments: 0,
    cancelledScanAppointments: 0,
  };

  const suffix = `[ADMIN_REWIND ${timestamp}] Retour a l'etape "${getStatusLabel(targetStatus)}".`;

  for (let i = 0; i < appointments.length; i += 1) {
    const appointment = appointments[i];
    if (!shouldCancelAppointment(appointment, targetRank)) {
      continue;
    }

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        notes: appendAuditSuffix(appointment.notes, suffix),
        updated_at: timestamp,
      })
      .eq('id', appointment.id);

    if (error) {
      throw new Error(`Annulation rendez-vous ${appointment.id}: ${error.message}`);
    }

    if (appointment.type === 'scan_3d') {
      summary.cancelledScanAppointments += 1;
    } else {
      summary.cancelledPhoneAppointments += 1;
    }
  }

  return summary;
}

async function rewindPayments(supabase, payments, targetStatus) {
  const targetRank = getStatusRank(targetStatus);
  const summary = {
    cancelledScanPayments: 0,
    cancelledVisitPayments: 0,
  };

  for (let i = 0; i < payments.length; i += 1) {
    const payment = payments[i];
    if (!shouldCancelPayment(payment, targetRank)) {
      continue;
    }

    const { error } = await supabase
      .from('payments')
      .update({
        status: 'cancelled',
        paid_at: null,
      })
      .eq('id', payment.id);

    if (error) {
      throw new Error(`Annulation paiement ${payment.id}: ${error.message}`);
    }

    if (payment.type === 'scan_3d') {
      summary.cancelledScanPayments += 1;
    } else if (payment.type === 'virtual_tour') {
      summary.cancelledVisitPayments += 1;
    }
  }

  return summary;
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const auth = authorizeAdminRequest(event);
  if (!auth.authorized) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Corps invalide' }),
    };
  }

  const clientId = String(body.clientId || '').trim();
  const targetStatus = normalizeClientStatus(body.targetStatus);

  if (!clientId || !targetStatus || !isPipelineStatus(targetStatus)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'clientId et targetStatus valides requis' }),
    };
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error(clientError ? clientError.message : 'Client introuvable');
    }

    const [appointments, payments] = await Promise.all([
      fetchAppointments(supabase, clientId),
      fetchPayments(supabase, clientId),
    ]);

    const currentStatus = getEffectiveStatus(client, appointments, payments);
    const currentRank = getStatusRank(currentStatus);
    const targetRank = getStatusRank(targetStatus);

    if (targetRank > currentRank) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: `Le dossier est actuellement a l'etape "${getStatusLabel(currentStatus)}". Utilisez les actions normales pour avancer.`,
        }),
      };
    }

    const timestamp = new Date().toISOString();
    const appointmentSummary = await rewindAppointments(supabase, appointments, targetStatus, timestamp);
    const paymentSummary = await rewindPayments(supabase, payments, targetStatus);
    const clientPatch = buildClientPatch(targetStatus, timestamp);

    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update(clientPatch)
      .eq('id', clientId)
      .select('*')
      .single();

    if (updateError || !updatedClient) {
      throw new Error(updateError ? updateError.message : 'Mise a jour client impossible');
    }

    const [refreshedAppointments, refreshedPayments] = await Promise.all([
      fetchAppointments(supabase, clientId),
      fetchClientPayments(supabase, clientId),
    ]);
    const enrichedClient = enrichClientProgress(updatedClient, refreshedAppointments, refreshedPayments);

    await safeReconcileClientTasks({
      supabase,
      client: enrichedClient,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        client: enrichedClient,
        status: normalizeClientStatus(enrichedClient.status) || targetStatus,
        targetStatus,
        previousStatus: currentStatus,
        cleanup: {
          ...appointmentSummary,
          ...paymentSummary,
        },
      }),
    };
  } catch (error) {
    console.error('[admin-rewind-client-stage] error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Erreur serveur' }),
    };
  }
};
