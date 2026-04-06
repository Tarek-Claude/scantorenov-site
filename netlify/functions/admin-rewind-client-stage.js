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

function chooseHigherStatus(currentStatus, nextStatus) {
  const currentRank = getStatusRank(currentStatus);
  const nextRank = getStatusRank(nextStatus);

  if (nextRank === -1) return normalizeClientStatus(currentStatus) || null;
  if (currentRank === -1) return normalizeClientStatus(nextStatus);

  return nextRank >= currentRank
    ? normalizeClientStatus(nextStatus)
    : normalizeClientStatus(currentStatus);
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function isPastAppointment(appointment) {
  if (!appointment || !appointment.scheduled_at) return false;
  const value = new Date(appointment.scheduled_at).getTime();
  return Number.isFinite(value) && value <= Date.now();
}

function isPhoneAppointmentDone(appointment) {
  if (!appointment || appointment.type !== 'phone_call') return false;
  if (appointment.status === 'completed') return true;
  return appointment.status === 'confirmed' && isPastAppointment(appointment);
}

function getEffectiveStatus(client, appointments, payments) {
  const enriched = enrichClientProgress(client, appointments || [], payments || []);
  return normalizeClientStatus(enriched && enriched.status)
    || normalizeClientStatus(client && client.status)
    || 'contact_submitted';
}

function getHighestObservedStatus(client, appointments, payments) {
  let observedStatus = normalizeClientStatus(client && client.status) || 'contact_submitted';

  const activePhoneAppointments = (appointments || []).filter(
    (appointment) => appointment && appointment.type === 'phone_call' && appointment.status !== 'cancelled'
  );
  const activeScanAppointments = (appointments || []).filter(
    (appointment) => appointment && appointment.type === 'scan_3d' && appointment.status !== 'cancelled'
  );
  const completedScanPayment = (payments || []).some(
    (payment) => payment && payment.type === 'scan_3d' && payment.status === 'completed'
  );
  const completedVisitPayment = (payments || []).some(
    (payment) => payment && payment.type === 'virtual_tour' && payment.status === 'completed'
  );

  if (activePhoneAppointments.length > 0) {
    observedStatus = chooseHigherStatus(observedStatus, 'call_requested');
  }

  if (activePhoneAppointments.some(isPhoneAppointmentDone)) {
    observedStatus = chooseHigherStatus(observedStatus, 'call_done');
  }

  if (activeScanAppointments.length > 0) {
    observedStatus = chooseHigherStatus(observedStatus, 'scan_scheduled');
  }

  if (completedScanPayment) {
    observedStatus = chooseHigherStatus(observedStatus, 'scan_payment_completed');
  }

  if (
    hasValue(client && client.matterport_model_id)
    || hasValue(client && client.matterport_url)
    || hasValue(client && client.matterport_iframe)
    || hasValue(client && client.matterport_data)
  ) {
    observedStatus = chooseHigherStatus(observedStatus, 'scan_completed');
  }

  if (
    (client && client.marcel_enabled === true)
    || hasValue(client && client.photos_urls)
    || hasValue(client && client.plans_urls)
    || completedVisitPayment
  ) {
    observedStatus = chooseHigherStatus(observedStatus, 'analysis_ready');
  }

  if (
    (client && client.avant_projet_enabled === true)
    || hasValue(client && client.proposal_url)
  ) {
    observedStatus = chooseHigherStatus(observedStatus, 'avant_projet_ready');
  }

  if (hasValue(client && client.avant_projet_transmitted_at)) {
    observedStatus = chooseHigherStatus(observedStatus, 'avant_projet_transmitted');
  }

  return observedStatus;
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

    const effectiveStatus = getEffectiveStatus(client, appointments, payments);
    const observedStatus = getHighestObservedStatus(client, appointments, payments);
    const currentStatus = chooseHigherStatus(effectiveStatus, observedStatus) || effectiveStatus;
    const currentRank = getStatusRank(currentStatus);
    const targetRank = getStatusRank(targetStatus);

    if (targetRank > currentRank) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: `Le dossier est actuellement a l'etape "${getStatusLabel(currentStatus)}" selon les donnees reelles. Utilisez les actions normales pour avancer.`,
          currentStatus,
          effectiveStatus,
          observedStatus,
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
        effectiveStatus,
        observedStatus,
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
