const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        clients: clients || [],
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
