const { createClient } = require('@supabase/supabase-js');
const { safeReconcileClientTasks } = require('./_cockpit-engine');
const { authorizeAdminRequest } = require('./_admin-session');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret, x-admin-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function getSupabaseAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!authorizeAdminRequest(event).authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const supabase = getSupabaseAdminClient();

  try {
    if (body.all === true) {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) {
        throw new Error(`Lecture clients: ${error.message}`);
      }

      const results = [];
      for (let i = 0; i < clients.length; i += 1) {
        const result = await safeReconcileClientTasks({
          supabase,
          client: clients[i],
        });
        results.push({
          clientId: clients[i].id,
          status: clients[i].status,
          skipped: !!result.skipped,
          created: result.created || 0,
          updated: result.updated || 0,
          closed: result.closed || 0,
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          mode: 'all',
          count: results.length,
          results,
        }),
      };
    }

    if (!body.clientId && !body.email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'clientId, email ou all=true requis' }),
      };
    }

    const result = await safeReconcileClientTasks({
      supabase,
      clientId: body.clientId,
      email: body.email,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ...result,
      }),
    };
  } catch (error) {
    console.error('[reconcile-cockpit] error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Erreur serveur' }),
    };
  }
};
