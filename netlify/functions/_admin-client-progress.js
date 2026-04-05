const { getStatusRank, normalizeClientStatus } = require('./_cockpit-config');

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

function deriveStatusFromAppointments(appointments, currentStatus) {
  let derivedStatus = currentStatus || null;

  if (!Array.isArray(appointments) || appointments.length === 0) {
    return derivedStatus;
  }

  const hasPhoneAppointment = appointments.some(
    (appointment) => isActiveAppointment(appointment) && appointment.type === 'phone_call'
  );
  const hasScanAppointment = appointments.some(
    (appointment) => isActiveAppointment(appointment) && appointment.type === 'scan_3d'
  );

  if (hasPhoneAppointment) {
    derivedStatus = chooseFarthestStatus(derivedStatus, 'call_requested');
  }

  if (hasScanAppointment) {
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

module.exports = {
  enrichClientProgress,
};
