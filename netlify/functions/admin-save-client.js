const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');
const { upsertClientPipeline } = require('./_client-pipeline');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-session, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const ALLOWED_FIELDS = [
  'nom',
  'prenom',
  'telephone',
  'phone',
  'adresse',
  'type_bien',
  'project_type',
  'demande',
  'project_details',
  'surface',
  'budget',
  'echeance',
  'matterport_model_id',
  'matterport_iframe',
  'matterport_data',
  'proposal_url',
  'marcel_enabled',
  'avant_projet_enabled',
];

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
  const inferStatusFromFields = body.inferStatusFromFields === true;

  if (!clientId || !body.fields || typeof body.fields !== 'object') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'clientId et fields requis' }),
    };
  }

  const sanitizedFields = {};
  for (const key of ALLOWED_FIELDS) {
    if (body.fields[key] !== undefined) {
      sanitizedFields[key] = body.fields[key];
    }
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
      fields: sanitizedFields,
      inferStatusFromFields,
      strict: true,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        client: result.data,
        status: result.status || null,
      }),
    };
  } catch (error) {
    console.error('[admin-save-client] error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Erreur serveur' }),
    };
  }
};
