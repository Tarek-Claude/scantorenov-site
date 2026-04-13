const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');
const { enrichClientProgress } = require('./_admin-client-progress');
const { safeReconcileClientTasks } = require('./_cockpit-engine');
const { buildPaymentAccessSummary } = require('./_payment-access');

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
    if (taskError && !isMissingTableError(taskError)) {
      throw new Error(`Lecture taches: ${taskError.message}`);
    }

    let appointmentsByClientId = new Map();
    let paymentsByClientId = new Map();
    let scansByClientId = new Map();
    const clientIds = (clients || []).map((client) => client.id).filter(Boolean);

    if (clientIds.length > 0) {
      const { data: scans, error: scansError } = await supabase
        .from('scans')
        .select('client_id,is_primary,photos_urls,plans_urls,matterport_model_id,matterport_data')
        .in('client_id', clientIds);

      if (scansError && !isMissingTableError(scansError)) {
        throw new Error(`Lecture scans: ${scansError.message}`);
      }

      for (const scan of scans || []) {
        const existing = scansByClientId.get(scan.client_id);
        if (!existing || scan.is_primary) {
          scansByClientId.set(scan.client_id, scan);
        }
      }

      const { data: appointments, error: appointmentError } = await supabase
        .from('appointments')
        .select('client_id,type,status,scheduled_at,notes')
        .in('client_id', clientIds);

      if (appointmentError && !isMissingTableError(appointmentError)) {
        throw new Error(`Lecture rendez-vous: ${appointmentError.message}`);
      }

      appointmentsByClientId = (appointments || []).reduce((acc, appointment) => {
        const clientId = appointment.client_id;
        if (!acc.has(clientId)) acc.set(clientId, []);
        acc.get(clientId).push(appointment);
        return acc;
      }, new Map());

      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('client_id,type,status,amount_cents,currency,paid_at,created_at,description')
        .in('client_id', clientIds);

      if (paymentsError && !isMissingTableError(paymentsError)) {
        throw new Error(`Lecture paiements: ${paymentsError.message}`);
      }

      paymentsByClientId = (payments || []).reduce((acc, payment) => {
        const clientId = payment.client_id;
        if (!acc.has(clientId)) acc.set(clientId, []);
        acc.get(clientId).push(payment);
        return acc;
      }, new Map());
    }

    const enrichedClients = (clients || []).map((client) => {
      const appointments = appointmentsByClientId.get(client.id) || [];
      const payments = paymentsByClientId.get(client.id) || [];
      const scan = scansByClientId.get(client.id) || null;
      const merged = {
        ...client,
        photos_urls: (scan && scan.photos_urls) || [],
        plans_urls: (scan && scan.plans_urls) || [],
        matterport_model_id: (scan && scan.matterport_model_id) || client.matterport_model_id || null,
        matterport_data: (scan && scan.matterport_data) || client.matterport_data || null,
      };
      return {
        ...enrichClientProgress(merged, appointments, payments),
        payment_access: buildPaymentAccessSummary(payments, merged),
      };
    });

    let activeTasks = tasks || [];
    if (!taskError) {
      for (const client of enrichedClients) {
        await safeReconcileClientTasks({
          supabase,
          client,
        });
      }

      const { data: refreshedTasks, error: refreshedTaskError } = await supabase
        .from('admin_tasks')
        .select('id,client_id,task_type,title,description,status,priority,due_date,screen_target')
        .in('status', ['open', 'awaiting_validation', 'waiting_client', 'blocked'])
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(100);

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
        clients: enrichedClients,
        tasks: activeTasks,
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
