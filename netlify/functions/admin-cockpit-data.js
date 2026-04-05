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

  const supabase = getSupabaseAdmin();

  try {
    const [{ data: clients, error: clientError }, { data: tasks, error: taskError }] = await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false }),
      supabase
        .from('admin_tasks')
        .select('id,client_id,task_type,title,description,status,priority,due_date,screen_target')
        .in('status', ['open', 'awaiting_validation', 'waiting_client', 'blocked'])
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(100),
    ]);

    if (clientError) {
      throw new Error(`Lecture clients: ${clientError.message}`);
    }
    if (taskError && taskError.code !== '42P01' && taskError.code !== 'PGRST205') {
      throw new Error(`Lecture taches: ${taskError.message}`);
    }

    let appointmentsByClientId = new Map();
    const clientIds = (clients || []).map((client) => client.id).filter(Boolean);

    if (clientIds.length > 0) {
      const { data: appointments, error: appointmentError } = await supabase
        .from('appointments')
        .select('client_id,type,status,scheduled_at')
        .in('client_id', clientIds);

      if (appointmentError && appointmentError.code !== '42P01' && appointmentError.code !== 'PGRST205') {
        throw new Error(`Lecture rendez-vous: ${appointmentError.message}`);
      }

      appointmentsByClientId = (appointments || []).reduce((acc, appointment) => {
        const clientId = appointment.client_id;
        if (!acc.has(clientId)) acc.set(clientId, []);
        acc.get(clientId).push(appointment);
        return acc;
      }, new Map());
    }

    const enrichedClients = (clients || []).map((client) =>
      enrichClientProgress(client, appointmentsByClientId.get(client.id) || [])
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        clients: enrichedClients,
        tasks: tasks || [],
      }),
    };
  } catch (error) {
    console.error('[admin-cockpit-data] error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Erreur serveur' }),
    };
  }
};
