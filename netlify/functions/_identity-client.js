const { createClient } = require('@supabase/supabase-js');
const { upsertClientPipeline } = require('./_client-pipeline');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

async function findClientByRequestedId(requestedClientId) {
  if (!isUuid(requestedClientId)) {
    return null;
  }

  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
    return {
      client: requestedClient,
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
      status: 'account_created',
      strict: true
    });
    resolvedClient = result && result.data ? result.data : null;
  }

  if (!resolvedClient) {
    throw createResolutionError(404, 'Client introuvable');
  }

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
    client: resolvedClient,
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
