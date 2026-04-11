const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');
const { enrichClientProgress } = require('./_admin-client-progress');
const { safeReconcileClientTasks } = require('./_cockpit-engine');
const { buildPaymentAccessSummary, fetchClientPayments } = require('./_payment-access');

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

function isMissingTableError(error) {
  return error && (error.code === '42P01' || error.code === 'PGRST205');
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
    const [
      { data: client, error: clientError },
      { data: tasks, error: taskError },
      { data: projectNotes, error: projectNotesError },
      { data: primaryScan, error: primaryScanError }
    ] = await Promise.all([
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
      supabase
        .from('project_notes')
        .select('id,type,summary,needs,confirmed_budget,confirmed_surface,constraints,internal_notes,created_at')
        .eq('client_id', body.clientId)
        .in('type', ['client_brief', 'phone_summary', 'scan_observation'])
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('scans')
        .select('id, client_id, is_primary, photos_urls, plans_urls, matterport_model_id, matterport_data')
        .eq('client_id', body.clientId)
        .eq('is_primary', true)
        .maybeSingle(),
    ]);

    if (clientError) {
      throw new Error(`Lecture client: ${clientError.message}`);
    }
    if (taskError && !isMissingTableError(taskError)) {
      throw new Error(`Lecture taches: ${taskError.message}`);
    }
    if (projectNotesError && !isMissingTableError(projectNotesError)) {
      throw new Error(`Lecture notes projet: ${projectNotesError.message}`);
    }
    if (primaryScanError && !isMissingTableError(primaryScanError)) {
      throw new Error(`Lecture scan: ${primaryScanError.message}`);
    }

    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .select('id,client_id,type,status,scheduled_at,duration_minutes,location,notes')
      .eq('client_id', body.clientId);

    if (appointmentError && !isMissingTableError(appointmentError)) {
      throw new Error(`Lecture rendez-vous: ${appointmentError.message}`);
    }

    const mergedClient = {
      ...client,
      photos_urls: primaryScan?.photos_urls || client.photos_urls || [],
      plans_urls: primaryScan?.plans_urls || client.plans_urls || [],
      matterport_model_id: client.matterport_model_id || primaryScan?.matterport_model_id || null,
      matterport_data: client.matterport_data || primaryScan?.matterport_data || null,
    };

    const payments = await fetchClientPayments(supabase, body.clientId);
    const enrichedClient = {
      ...enrichClientProgress(mergedClient, appointments || [], payments),
      payment_access: buildPaymentAccessSummary(payments, mergedClient),
    };
    let activeTasks = tasks || [];

    if (!taskError) {
      await safeReconcileClientTasks({
        supabase,
        client: enrichedClient,
      });

      const { data: refreshedTasks, error: refreshedTaskError } = await supabase
        .from('admin_tasks')
        .select('*')
        .eq('client_id', body.clientId)
        .in('status', ['open', 'awaiting_validation', 'waiting_client', 'blocked'])
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false });

      if (refreshedTaskError && !isMissingTableError(refreshedTaskError)) {
        throw new Error(`Rafraichissement taches: ${refreshedTaskError.message}`);
      }

      activeTasks = refreshedTasks || [];
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        client: enrichedClient,
        appointments: appointments || [],
        payments,
        projectNotes: projectNotes || [],
        tasks: activeTasks,
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
