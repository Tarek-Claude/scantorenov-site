const { createClient } = require('@supabase/supabase-js');
const { resolveIdentityClient } = require('./_identity-client');
const { enrichClientProgress } = require('./_admin-client-progress');
const { normalizeClientStatus } = require('./_cockpit-config');
const { upsertClientPipeline } = require('./_client-pipeline');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

exports.handler = async (event, context) => {
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

  try {
    const resolution = await resolveIdentityClient({
      context,
      createIfMissing: true
    });
    let client = resolution.client;
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id,client_id,type,status,scheduled_at,duration_minutes,location,notes,created_at')
      .eq('client_id', client.id)
      .order('scheduled_at', { ascending: true });

    if (appointmentsError && appointmentsError.code !== '42P01' && appointmentsError.code !== 'PGRST205') {
      throw new Error(`Lecture rendez-vous: ${appointmentsError.message}`);
    }

    const enrichedClient = enrichClientProgress(client, appointments || []);
    const resolvedStatus = normalizeClientStatus(enrichedClient.status || client.status || 'identity_created') || 'identity_created';
    const currentPhase = Number(client.phase || 3);
    const minimumPhaseForStatus = resolvedStatus === 'call_done' ? 4 : currentPhase;
    const resolvedPhase = Math.max(currentPhase, minimumPhaseForStatus);

    if (
      resolvedStatus !== normalizeClientStatus(client.status || null) ||
      resolvedPhase !== currentPhase
    ) {
      const reconciliation = await upsertClientPipeline({
        email: resolution.normalizedEmail,
        fields: {
          phase: resolvedPhase
        },
        status: resolvedStatus,
        strict: true
      });
      if (reconciliation && reconciliation.data) {
        client = reconciliation.data;
      } else {
        client = {
          ...enrichedClient,
          phase: resolvedPhase,
          status: resolvedStatus
        };
      }
    } else {
      client = {
        ...enrichedClient,
        phase: resolvedPhase,
        status: resolvedStatus
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...client,
        clientId: client.id,
        nom: client.nom || client.prenom || resolution.normalizedEmail,
        status: client.status || 'identity_created',
      }),
    };
  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    console.error('resolve-client error:', error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: error && error.message ? error.message : 'Erreur serveur' }),
    };
  }
};
