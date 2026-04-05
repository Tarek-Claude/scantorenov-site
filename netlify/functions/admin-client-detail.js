const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');
const { enrichClientProgress } = require('./_admin-client-progress');

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

  if (!body.clientId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'clientId requis' }),
    };
  }

  const supabase = getSupabaseAdmin();

  try {
    const [{ data: client, error: clientError }, { data: tasks, error: taskError }] = await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .eq('id', body.clientId)
        .single(),
      supabase
        .from('admin_tasks')
        .select('*')
        .eq('client_id', body.clientId)
        .in('status', ['open', 'awaiting_validation', 'waiting_client', 'blocked'])
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false }),
    ]);

    if (clientError) {
      throw new Error(`Lecture client: ${clientError.message}`);
    }
    if (taskError && taskError.code !== '42P01' && taskError.code !== 'PGRST205') {
      throw new Error(`Lecture taches: ${taskError.message}`);
    }

    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .select('id,client_id,type,status,scheduled_at,duration_minutes,location,notes')
      .eq('client_id', body.clientId);

    if (appointmentError && appointmentError.code !== '42P01' && appointmentError.code !== 'PGRST205') {
      throw new Error(`Lecture rendez-vous: ${appointmentError.message}`);
    }

    const enrichedClient = enrichClientProgress(client, appointments || []);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        client: enrichedClient,
        appointments: appointments || [],
        tasks: tasks || [],
      }),
    };
  } catch (error) {
    console.error('[admin-client-detail] error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Erreur serveur' }),
    };
  }
};
