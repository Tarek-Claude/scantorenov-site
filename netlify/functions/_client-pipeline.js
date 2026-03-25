const { createClient } = require('@supabase/supabase-js');

const PIPELINE_STATUSES = [
  'new_lead',
  'account_created',
  'onboarding_completed',
  'call_requested',
  'call_done',
  'scan_scheduled',
  'scan_completed',
  'analysis_ready',
  'avant_projet_ready'
];

const STATUS_RANK = PIPELINE_STATUSES.reduce((acc, status, index) => {
  acc[status] = index;
  return acc;
}, {});

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function chooseFarthestStatus(currentStatus, nextStatus) {
  const currentRank = STATUS_RANK[currentStatus];
  const nextRank = STATUS_RANK[nextStatus];

  if (nextRank === undefined) return currentStatus || null;
  if (currentRank === undefined) return nextStatus;

  return nextRank >= currentRank ? nextStatus : currentStatus;
}

function inferPipelineStatus(fields, currentStatus) {
  let inferredStatus = null;

  if (fields.avant_projet_enabled === true || hasValue(fields.proposal_url)) {
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
  }

  return chooseFarthestStatus(currentStatus, inferredStatus || currentStatus || 'new_lead');
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

async function upsertClientPipeline(options) {
  const {
    email,
    fields = {},
    status,
    inferStatusFromFields = false,
    strict = false
  } = options || {};

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email requis');
  }

  const supabase = getSupabaseAdminClient({ strict });
  if (!supabase) {
    return { skipped: true, reason: 'missing_supabase_env' };
  }

  const { data: existingClient, error: existingError } = await supabase
    .from('clients')
    .select('status')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Supabase lecture: ${existingError.message}`);
  }

  const clientData = { email: normalizedEmail, updated_at: new Date().toISOString() };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      clientData[key] = value;
    }
  }

  const currentStatus = existingClient && existingClient.status ? existingClient.status : null;
  const nextStatus = status && STATUS_RANK[status] !== undefined
    ? chooseFarthestStatus(currentStatus, status)
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

  return {
    skipped: false,
    data: data || clientData,
    status: nextStatus || null
  };
}

module.exports = {
  PIPELINE_STATUSES,
  upsertClientPipeline
};
