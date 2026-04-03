const CANONICAL_PIPELINE_STATUSES = Object.freeze([
  'contact_submitted',
  'identity_created',
  'onboarding_completed',
  'call_requested',
  'call_done',
  'scan_scheduled',
  'scan_payment_completed',
  'scan_completed',
  'analysis_ready',
  'avant_projet_ready',
  'avant_projet_transmitted',
  'accompaniment_subscribed',
]);

const SPECIAL_CLIENT_STATUSES = Object.freeze([
  'abandoned',
  'paused',
]);

const CLIENT_STATUS_ALIASES = Object.freeze({
  new_lead: 'contact_submitted',
  account_created: 'identity_created',
  avant_project_transmitted: 'avant_projet_transmitted',
});

const REVERSE_CLIENT_STATUS_ALIASES = Object.freeze(
  Object.entries(CLIENT_STATUS_ALIASES).reduce((acc, entry) => {
    const [legacy, canonical] = entry;
    if (!acc[canonical]) acc[canonical] = [];
    acc[canonical].push(legacy);
    return acc;
  }, {})
);

const CLIENT_STATUS_LABELS = Object.freeze({
  contact_submitted: 'Contact soumis',
  identity_created: 'Compte cree',
  onboarding_completed: 'Onboarding termine',
  call_requested: 'RDV telephone demande',
  call_done: 'Appel realise',
  scan_scheduled: 'Scan programme',
  scan_payment_completed: 'Paiement scan recu',
  scan_completed: 'Scan realise',
  analysis_ready: 'Analyse prete',
  avant_projet_ready: 'Avant-projet pret',
  avant_projet_transmitted: 'Avant-projet transmis',
  accompaniment_subscribed: 'Accompagnement souscrit',
  abandoned: 'Abandonne',
  paused: 'En pause',
});

const TASK_STATES = Object.freeze([
  'open',
  'awaiting_validation',
  'waiting_client',
  'blocked',
  'done',
  'cancelled',
]);

const ACTIVE_TASK_STATES = Object.freeze([
  'open',
  'awaiting_validation',
  'waiting_client',
  'blocked',
]);

const TASK_TYPE_DEFINITIONS = Object.freeze({
  lead_review: {
    label: 'Qualifier la demande',
    screenTarget: 'client_overview',
    defaultPriority: 90,
  },
  onboarding_nudge: {
    label: 'Relancer l onboarding',
    screenTarget: 'client_overview',
    defaultPriority: 60,
  },
  phone_call_prepare: {
    label: 'Preparer l appel',
    screenTarget: 'call_screen',
    defaultPriority: 95,
  },
  phone_call_complete: {
    label: 'Conduire l appel',
    screenTarget: 'call_screen',
    defaultPriority: 95,
  },
  phone_summary_validate: {
    label: 'Valider la synthese d appel',
    screenTarget: 'call_screen',
    defaultPriority: 92,
  },
  scan_invitation_send: {
    label: 'Envoyer l invitation scan',
    screenTarget: 'call_screen',
    defaultPriority: 88,
  },
  scan_booking_followup: {
    label: 'Suivre la reservation du scan',
    screenTarget: 'scan_screen',
    defaultPriority: 72,
  },
  scan_payment_followup: {
    label: 'Obtenir le paiement du scan',
    screenTarget: 'scan_screen',
    defaultPriority: 90,
  },
  scan_visit_prepare: {
    label: 'Preparer la visite de scan',
    screenTarget: 'scan_screen',
    defaultPriority: 86,
  },
  scan_assets_sync: {
    label: 'Synchroniser les assets du scan',
    screenTarget: 'scan_screen',
    defaultPriority: 94,
  },
  visit_summary_validate: {
    label: 'Valider les observations de visite',
    screenTarget: 'scan_screen',
    defaultPriority: 92,
  },
  analysis_build: {
    label: 'Produire l analyse',
    screenTarget: 'analysis_screen',
    defaultPriority: 91,
  },
  analysis_validate: {
    label: 'Valider l analyse',
    screenTarget: 'analysis_screen',
    defaultPriority: 90,
  },
  avant_project_finalize: {
    label: 'Finaliser l avant-projet',
    screenTarget: 'avant_projet_screen',
    defaultPriority: 91,
  },
  avant_project_transmit: {
    label: 'Transmettre l avant-projet',
    screenTarget: 'avant_projet_screen',
    defaultPriority: 92,
  },
  marcel_review: {
    label: 'Valider la production Marcel',
    screenTarget: 'marcel_screen',
    defaultPriority: 84,
  },
  client_followup: {
    label: 'Relancer le client',
    screenTarget: 'client_overview',
    defaultPriority: 65,
  },
  blocker_resolve: {
    label: 'Resoudre le blocage',
    screenTarget: 'client_overview',
    defaultPriority: 98,
  },
  accompaniment_onboard: {
    label: 'Lancer l accompagnement',
    screenTarget: 'accompaniment_screen',
    defaultPriority: 85,
  },
  accompaniment_coordinate: {
    label: 'Coordonner l accompagnement',
    screenTarget: 'accompaniment_screen',
    defaultPriority: 80,
  },
});

function normalizeClientStatus(status) {
  if (typeof status !== 'string') return null;
  const trimmed = status.trim();
  if (!trimmed) return null;
  return CLIENT_STATUS_ALIASES[trimmed] || trimmed;
}

function isPipelineStatus(status) {
  const normalized = normalizeClientStatus(status);
  return CANONICAL_PIPELINE_STATUSES.includes(normalized);
}

function isSpecialClientStatus(status) {
  const normalized = normalizeClientStatus(status);
  return SPECIAL_CLIENT_STATUSES.includes(normalized);
}

function getStatusRank(status) {
  const normalized = normalizeClientStatus(status);
  return CANONICAL_PIPELINE_STATUSES.indexOf(normalized);
}

function getStatusLabel(status) {
  const normalized = normalizeClientStatus(status);
  return CLIENT_STATUS_LABELS[normalized] || normalized || 'Statut inconnu';
}

function expandStatusVariants(statuses) {
  const values = Array.isArray(statuses) ? statuses : [statuses];
  const expanded = new Set();

  for (let i = 0; i < values.length; i += 1) {
    const raw = values[i];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const normalized = normalizeClientStatus(raw);
    expanded.add(normalized);
    const legacyValues = REVERSE_CLIENT_STATUS_ALIASES[normalized] || [];
    for (let j = 0; j < legacyValues.length; j += 1) {
      expanded.add(legacyValues[j]);
    }
  }

  return Array.from(expanded);
}

function getTaskTypeDefinition(taskType) {
  return TASK_TYPE_DEFINITIONS[taskType] || null;
}

module.exports = {
  ACTIVE_TASK_STATES,
  CANONICAL_PIPELINE_STATUSES,
  CLIENT_STATUS_ALIASES,
  CLIENT_STATUS_LABELS,
  SPECIAL_CLIENT_STATUSES,
  TASK_STATES,
  TASK_TYPE_DEFINITIONS,
  expandStatusVariants,
  getStatusLabel,
  getStatusRank,
  getTaskTypeDefinition,
  isPipelineStatus,
  isSpecialClientStatus,
  normalizeClientStatus,
};
