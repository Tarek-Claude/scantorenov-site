const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');
const { normalizeClientStatus, upsertClientPipeline } = require('./_client-pipeline');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-session, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
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
  const requestedStatus = normalizeClientStatus(body.status);

  if (!clientId || !requestedStatus) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'clientId et status valides requis' }),
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

    const result = await upsertClientPipeline({
      email: client.email,
      status: requestedStatus,
      strict: true,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        client: result.data,
        status: result.status || requestedStatus,
      }),
    };
  } catch (error) {
    console.error('[admin-update-status] error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Erreur serveur' }),
    };
  }
};
