const { createClient } = require('@supabase/supabase-js');
const {
  CANONICAL_PIPELINE_STATUSES,
  expandStatusVariants,
  getStatusRank,
  isPipelineStatus,
  normalizeClientStatus,
} = require('./_cockpit-config');
const { safeReconcileClientTasks } = require('./_cockpit-engine');

const PIPELINE_STATUSES = CANONICAL_PIPELINE_STATUSES;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

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

function inferPipelineStatus(fields, currentStatus) {
  let inferredStatus = null;

  if (fields.avant_projet_transmitted_at === true || hasValue(fields.avant_projet_transmitted_at)) {
    inferredStatus = 'avant_projet_transmitted';
  } else if (fields.avant_projet_enabled === true || hasValue(fields.proposal_url)) {
    inferredStatus = 'avant_projet_ready';
  } else if (
    fields.marcel_enabled === true ||
    hasValue(fields.plans_urls) ||
    hasValue(fields.photos_urls)
  ) {
    inferredStatus = 'analysis_ready';
  } else if (
    hasValue(fields.matterport_model_id) ||
    hasValue(fields.matterport_url) ||
    hasValue(fields.matterport_iframe) ||
    hasValue(fields.matterport_data)
  ) {
    inferredStatus = 'scan_completed';
  } else if (
    fields.scan_confirmed_by_client === true ||
    hasValue(fields.scan_date_confirmed) ||
    hasValue(fields.scan_date_proposed)
  ) {
    inferredStatus = 'scan_scheduled';
  } else if (hasValue(fields.call_notes)) {
    inferredStatus = 'call_done';
  } else if (hasValue(fields.call_scheduled_at)) {
    inferredStatus = 'call_requested';
  } else if (
    hasValue(fields.project_type) ||
    hasValue(fields.project_details) ||
    hasValue(fields.type_bien) ||
    hasValue(fields.demande) ||
    hasValue(fields.adresse) ||
    hasValue(fields.surface) ||
    hasValue(fields.budget) ||
    hasValue(fields.echeance)
  ) {
    inferredStatus = 'onboarding_completed';
  } else if (hasValue(fields.email)) {
    inferredStatus = 'contact_submitted';
  }

  return chooseFarthestStatus(currentStatus, inferredStatus || currentStatus || 'contact_submitted');
}

function getSupabaseAdminClient(options = {}) {
  const { strict = false } = options;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (strict) {
      throw new Error('SUPABASE_URL et SUPABASE_SERVICE_KEY requis');
    }
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function fetchExistingClient(supabase, normalizedEmail) {
  const variants = expandStatusVariants(PIPELINE_STATUSES);
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase lecture: ${error.message}`);
  }

  if (data && data.status && !variants.includes(data.status) && !normalizeClientStatus(data.status)) {
    data.status = 'contact_submitted';
  }

  return data || null;
}

async function upsertClientPipeline(options) {
  const {
    email,
    fields = {},
    status,
    inferStatusFromFields = false,
    strict = false,
  } = options || {};

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email requis');
  }

  const supabase = getSupabaseAdminClient({ strict });
  if (!supabase) {
    return { skipped: true, reason: 'missing_supabase_env' };
  }

  const existingClient = await fetchExistingClient(supabase, normalizedEmail);
  const currentStatus = existingClient && existingClient.status ? normalizeClientStatus(existingClient.status) : null;

  const clientData = {
    email: normalizedEmail,
    updated_at: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      clientData[key] = value;
    }
  }

  const requestedStatus = isPipelineStatus(status) ? normalizeClientStatus(status) : normalizeClientStatus(status);
  const nextStatus = requestedStatus && isPipelineStatus(requestedStatus)
    ? chooseFarthestStatus(currentStatus, requestedStatus)
    : inferStatusFromFields
      ? inferPipelineStatus(clientData, currentStatus)
      : currentStatus || null;

  if (nextStatus) {
    clientData.status = nextStatus;
  }

  const { data, error } = await supabase
    .from('clients')
    .upsert(clientData, { onConflict: 'email' })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase ecriture: ${error.message}`);
  }

  const reconciledClient = data || { ...(existingClient || {}), ...clientData };
  await safeReconcileClientTasks({
    supabase,
    client: reconciledClient,
  });

  return {
    skipped: false,
    data: reconciledClient,
    status: nextStatus || null,
  };
}

module.exports = {
  PIPELINE_STATUSES,
  chooseFarthestStatus,
  getSupabaseAdminClient,
  hasValue,
  inferPipelineStatus,
  normalizeClientStatus,
  upsertClientPipeline,
};
