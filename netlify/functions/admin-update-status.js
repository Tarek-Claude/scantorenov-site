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

    // Cas special : validation manuelle du paiement visite virtuelle.
    // Ce statut n est pas dans la pipeline canonique, on enregistre donc
    // directement une ligne payments (type=virtual_tour, status=completed)
    // pour que buildPaymentAccessSummary retourne virtualTourUnlocked=true.
    if (requestedStatus === 'visite_payment_completed') {
      const { data: existingPayments, error: paymentsError } = await supabase
        .from('payments')
        .select('id')
        .eq('client_id', clientId)
        .eq('type', 'virtual_tour')
        .eq('status', 'completed')
        .limit(1);

      if (paymentsError) {
        throw new Error(`Lecture paiements: ${paymentsError.message}`);
      }

      if (!existingPayments || existingPayments.length === 0) {
        const { error: insertError } = await supabase
          .from('payments')
          .insert([{
            client_id: clientId,
            type: 'virtual_tour',
            amount_cents: 12000,
            currency: 'eur',
            status: 'completed',
            paid_at: new Date().toISOString(),
            description: 'Acces visite virtuelle 3D - Paiement valide manuellement par admin'
          }]);

        if (insertError) {
          throw new Error(`Enregistrement paiement visite: ${insertError.message}`);
        }
      }

      const { data: refreshedClient } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          client: refreshedClient || client,
          status: (refreshedClient && refreshedClient.status) || client.status,
          virtualTourUnlocked: true,
        }),
      };
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
