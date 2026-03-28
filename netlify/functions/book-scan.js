const { createClient } = require('@supabase/supabase-js');
const { APPOINTMENT_RULES, findConflict, isSlotBookable } = require('./_appointment-utils');
const { resolveIdentityClient } = require('./_identity-client');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

  const identityUser = context && context.clientContext ? context.clientContext.user : null;
  if (!identityUser) {
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
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  try {
    const requestedClientId = body.clientId;
    const scheduledAt = body.scheduledAt;
    const durationMinutes = APPOINTMENT_RULES.scan_3d.durationMinutes;
    const location = body.location;
    const eventTitle = body.eventTitle;

    if (!scheduledAt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'scheduledAt requis' }),
      };
    }

    const requestedStart = new Date(scheduledAt);
    if (Number.isNaN(requestedStart.getTime())) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'scheduledAt invalide' }),
      };
    }

    if (!isSlotBookable('scan_3d', requestedStart)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Creneau hors des regles de reservation' }),
      };
    }

    const resolution = await resolveIdentityClient({
      context,
      requestedClientId,
      createIfMissing: false
    });
    const client = resolution.client;
    const clientId = client.id;

    if (client.status !== 'call_done') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Statut invalide : ${client.status} (attendu: call_done)` }),
      };
    }

    const conflict = await findConflict(supabase, requestedStart, durationMinutes);
    if (conflict) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Ce creneau est deja indisponible' }),
      };
    }

    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .insert([
        {
          client_id: clientId,
          type: 'scan_3d',
          status: 'requested',
          scheduled_at: requestedStart.toISOString(),
          duration_minutes: durationMinutes,
          location: location || client.adresse || '',
          notes: `Reserve via espace client. Creneau: ${eventTitle || 'Scan 3D Matterport'}`,
        },
      ])
      .select()
      .single();

    if (apptError || !appt) {
      console.error('Erreur INSERT appointment:', apptError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: apptError ? apptError.message : 'Insert failed' }),
      };
    }

    const { error: updateError } = await supabase
      .from('clients')
      .update({ status: 'scan_scheduled', updated_at: new Date().toISOString() })
      .eq('id', clientId)
      .in('status', ['call_done']);

    if (updateError) {
      console.warn('book-scan client status update failed:', updateError.message);
    }

    console.log(`RDV scan cree : ${appt.id} pour client ${clientId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, appointmentId: appt.id, appointment: appt }),
    };
  } catch (err) {
    const statusCode = err && err.statusCode ? err.statusCode : 500;
    console.error('book-scan error:', err);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: err && err.message ? err.message : 'Internal server error' }),
    };
  }
};
