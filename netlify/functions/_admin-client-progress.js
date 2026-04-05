const { getStatusRank, normalizeClientStatus } = require('./_cockpit-config');
const { isPromoPendingValidationAppointment } = require('./_promo-config');

const STATUS_MIN_PORTAL_PHASE = Object.freeze({
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

const LEGACY_PHASE_LABELS = Object.freeze({
  prospect: 3,
  qualification: 3,
  scan: 4,
  analyse: 5,
  analysis: 5,
  avant_projet: 6,
  avantprojet: 6,
  accompagnement: 7,
  moe: 7,
  chantier: 8,
});

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function chooseFarthestStatus(currentStatus, nextStatus) {
  const normalizedCurrent = normalizeClientStatus(currentStatus);
  const normalizedNext = normalizeClientStatus(nextStatus);
  const currentRank = getStatusRank(normalizedCurrent);
  const nextRank = getStatusRank(normalizedNext);

  if (nextRank === -1) return normalizedCurrent || null;
  if (currentRank === -1) return normalizedNext;

  return nextRank >= currentRank ? normalizedNext : normalizedCurrent;
}

function inferClientProgressStatus(client, currentStatus) {
  if (!client || typeof client !== 'object') {
    return chooseFarthestStatus(currentStatus, 'contact_submitted');
  }

  let inferredStatus = null;

  if (client.avant_projet_transmitted_at === true || hasValue(client.avant_projet_transmitted_at)) {
    inferredStatus = 'avant_projet_transmitted';
  } else if (client.avant_projet_enabled === true || hasValue(client.proposal_url)) {
    inferredStatus = 'avant_projet_ready';
  } else if (
    client.marcel_enabled === true ||
    hasValue(client.plans_urls) ||
    hasValue(client.photos_urls)
  ) {
    inferredStatus = 'analysis_ready';
  } else if (
    hasValue(client.matterport_model_id) ||
    hasValue(client.matterport_url) ||
    hasValue(client.matterport_iframe) ||
    hasValue(client.matterport_data)
  ) {
    inferredStatus = 'scan_completed';
  } else if (
    client.scan_confirmed_by_client === true ||
    hasValue(client.scan_date_confirmed) ||
    hasValue(client.scan_date_proposed)
  ) {
    inferredStatus = 'scan_scheduled';
  } else if (hasValue(client.call_notes)) {
    inferredStatus = 'call_done';
  } else if (hasValue(client.call_scheduled_at)) {
    inferredStatus = 'call_requested';
  } else if (
    hasValue(client.project_type) ||
    hasValue(client.project_details) ||
    hasValue(client.type_bien) ||
    hasValue(client.demande) ||
    hasValue(client.adresse) ||
    hasValue(client.surface) ||
    hasValue(client.budget) ||
    hasValue(client.echeance)
  ) {
    inferredStatus = 'onboarding_completed';
  } else if (hasValue(client.email)) {
    inferredStatus = 'contact_submitted';
  }

  return chooseFarthestStatus(currentStatus, inferredStatus || currentStatus || 'contact_submitted');
}

function isActiveAppointment(appointment) {
  if (!appointment || typeof appointment !== 'object') return false;
  return appointment.status !== 'cancelled';
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

function isPaidScanAppointment(appointment) {
  if (!appointment || appointment.type !== 'scan_3d') return false;
  return ['confirmed', 'completed'].includes(appointment.status);
}

function isPendingScanValidationAppointment(appointment) {
  return isPromoPendingValidationAppointment(appointment);
}

function deriveStatusFromAppointments(appointments, currentStatus) {
  let derivedStatus = currentStatus || null;

  if (!Array.isArray(appointments) || appointments.length === 0) {
    return derivedStatus;
  }

  const hasCompletedPhoneAppointment = appointments.some(isPhoneAppointmentDone);
  const hasPhoneAppointment = appointments.some(
    (appointment) => isActiveAppointment(appointment) && appointment.type === 'phone_call'
  );
  const hasPendingScanValidation = appointments.some(
    (appointment) => isActiveAppointment(appointment) && isPendingScanValidationAppointment(appointment)
  );
  const hasPaidScanAppointment = appointments.some(
    (appointment) => isActiveAppointment(appointment) && isPaidScanAppointment(appointment)
  );

  if (hasCompletedPhoneAppointment) {
    derivedStatus = chooseFarthestStatus(derivedStatus, 'call_done');
  } else if (hasPhoneAppointment) {
    derivedStatus = chooseFarthestStatus(derivedStatus, 'call_requested');
  }

  if (hasPaidScanAppointment) {
    derivedStatus = chooseFarthestStatus(derivedStatus, 'scan_payment_completed');
  } else if (hasPendingScanValidation) {
    derivedStatus = chooseFarthestStatus(derivedStatus, 'scan_scheduled');
  }

  return derivedStatus;
}

function enrichClientProgress(client, appointments) {
  if (!client || typeof client !== 'object') return client;

  const recordedStatus = client.status || null;
  const inferredStatus = inferClientProgressStatus(client, recordedStatus);
  const effectiveStatus = deriveStatusFromAppointments(appointments, inferredStatus || recordedStatus)
    || inferredStatus
    || recordedStatus
    || 'contact_submitted';

  return {
    ...client,
    recorded_status: recordedStatus,
    status: effectiveStatus,
  };
}

function getNumericPhaseValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return asNumber;
    return LEGACY_PHASE_LABELS[trimmed.toLowerCase()] || null;
  }
  return null;
}

function derivePortalPhase(client, effectiveStatus) {
  const legacyPhase = getNumericPhaseValue(client && client.phase);
  const minimumPhase = STATUS_MIN_PORTAL_PHASE[normalizeClientStatus(effectiveStatus)] || 3;

  if (legacyPhase && Number.isFinite(legacyPhase)) {
    return Math.max(legacyPhase, minimumPhase);
  }

  return minimumPhase;
}

module.exports = {
  chooseFarthestStatus,
  deriveStatusFromAppointments,
  derivePortalPhase,
  enrichClientProgress,
};
