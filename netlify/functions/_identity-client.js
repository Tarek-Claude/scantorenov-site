const { createClient } = require('@supabase/supabase-js');
const { upsertClientPipeline } = require('./_client-pipeline');
const { enrichClientProgress } = require('./_admin-client-progress');
const { buildPaymentAccessSummary, fetchClientPayments } = require('./_payment-access');

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function createResolutionError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isMissingTableError(error) {
  return error && (error.code === '42P01' || error.code === 'PGRST205');
}

async function fetchClientAppointments(clientId) {
  if (!clientId) return [];

  const { data, error } = await getSupabaseAdmin()
    .from('appointments')
    .select('id,client_id,type,status,scheduled_at,duration_minutes,location,notes,created_at')
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: true });

  if (error && !isMissingTableError(error)) {
    throw new Error(`Supabase lecture rendez-vous: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

async function fetchPrimaryScan(supabase, clientId) {
  if (!clientId) return null;
  const { data, error } = await supabase
    .from('scans')
    .select('matterport_model_id, matterport_data, photos_urls, plans_urls, photos_meta')
    .eq('client_id', clientId)
    .eq('is_primary', true)
    .maybeSingle();
  if (error && !isMissingTableError(error)) {
    console.warn(`[identity-client] lecture scan: ${error.message}`);
  }
  return data || null;
}

async function attachClientProgress(client) {
  if (!client || typeof client !== 'object') {
    return { client, appointments: [], payments: [] };
  }

  const supabase = getSupabaseAdmin();
  const [appointments, payments, scan] = await Promise.all([
    fetchClientAppointments(client.id),
    fetchClientPayments(supabase, client.id),
    fetchPrimaryScan(supabase, client.id),
  ]);
  const paymentAccess = buildPaymentAccessSummary(payments, client);

  // Merge scan fields: scan data takes priority over client columns (v3: matterport_model_id moved to scans)
  const merged = {
    ...enrichClientProgress(client, appointments, payments),
    payment_access: paymentAccess,
    virtual_tour_unlocked: paymentAccess.virtualTourUnlocked,
  };
  if (scan) {
    if (scan.matterport_model_id) merged.matterport_model_id = scan.matterport_model_id;
    if (scan.matterport_data) merged.matterport_data = merged.matterport_data || scan.matterport_data;
    if (scan.photos_urls) merged.photos_urls = scan.photos_urls;
    if (scan.plans_urls) merged.plans_urls = scan.plans_urls;
    if (Array.isArray(scan.photos_meta) && scan.photos_meta.length) merged.photos_meta = scan.photos_meta;
  }

  return {
    client: merged,
    appointments,
    payments,
  };
}

async function findClientByRequestedId(requestedClientId) {
  if (!isUuid(requestedClientId)) {
    return null;
  }

  const { data, error } = await getSupabaseAdmin()
    .from('clients')
    .select('*')
    .eq('id', requestedClientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase lecture clientId: ${error.message}`);
  }

  return data || null;
}

async function findExactClientByEmail(normalizedEmail) {
  const { data, error } = await getSupabaseAdmin()
    .from('clients')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase lecture email exact: ${error.message}`);
  }

  return data || null;
}

async function findClientsByEmailFallback(normalizedEmail) {
  const { data, error } = await getSupabaseAdmin()
    .from('clients')
    .select('*')
    .ilike('email', normalizedEmail)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`Supabase lecture email: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

function pickBestEmailCandidate(candidates, normalizedEmail) {
  if (!candidates.length) return null;

  for (let i = 0; i < candidates.length; i += 1) {
    if (normalizeEmail(candidates[i].email) === normalizedEmail) {
      return candidates[i];
    }
  }

  return candidates[0];
}

async function resolveIdentityClient(options = {}) {
  const {
    context,
    requestedClientId = null,
    createIfMissing = false
  } = options;

  const identityUser = context && context.clientContext ? context.clientContext.user : null;
  if (!identityUser) {
    throw createResolutionError(401, 'Unauthorized');
  }

  const normalizedEmail = normalizeEmail(identityUser.email);
  if (!normalizedEmail) {
    throw createResolutionError(400, 'Email manquant');
  }

  const requestedClient = await findClientByRequestedId(requestedClientId);
  if (requestedClient && normalizeEmail(requestedClient.email) === normalizedEmail) {
    const progress = await attachClientProgress(requestedClient);
    return {
      client: progress.client,
      appointments: progress.appointments,
      payments: progress.payments,
      identityUser,
      normalizedEmail,
      matchedBy: 'requested_id',
      requestedClientIdMismatch: false
    };
  }

  let resolvedClient = await findExactClientByEmail(normalizedEmail);

  if (!resolvedClient) {
    const emailCandidates = await findClientsByEmailFallback(normalizedEmail);
    resolvedClient = pickBestEmailCandidate(emailCandidates, normalizedEmail);
  }

  if (!resolvedClient && createIfMissing) {
    const result = await upsertClientPipeline({
      email: normalizedEmail,
      status: 'identity_created',
      strict: true
    });
    resolvedClient = result && result.data ? result.data : null;
  }

  if (!resolvedClient) {
    throw createResolutionError(404, 'Client introuvable');
  }

  const progress = await attachClientProgress(resolvedClient);

  const requestedClientIdMismatch = !!(
    requestedClientId &&
    (!requestedClient || resolvedClient.id !== requestedClientId)
  );

  if (requestedClientIdMismatch) {
    console.warn(
      `[identity-client] clientId mismatch ignored: requested=${requestedClientId} resolved=${resolvedClient.id} email=${normalizedEmail}`
    );
  }

  return {
    client: progress.client,
    appointments: progress.appointments,
    payments: progress.payments,
    identityUser,
    normalizedEmail,
    matchedBy: 'identity_email',
    requestedClientIdMismatch
  };
}

module.exports = {
  normalizeEmail,
  resolveIdentityClient
};
