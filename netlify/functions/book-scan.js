const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const identityUser = context && context.clientContext ? context.clientContext.user : null;
  if (!identityUser) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  try {
    const clientId = body.clientId;
    const scheduledAt = body.scheduledAt;
    const durationMinutes = body.durationMinutes || 90;
    const location = body.location;
    const eventTitle = body.eventTitle;

    if (!clientId || !scheduledAt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'clientId et scheduledAt requis' })
      };
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, status, adresse')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Client introuvable' })
      };
    }

    if (identityUser.email && client.email && identityUser.email !== client.email) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden' })
      };
    }

    if (client.status !== 'call_done') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Statut invalide : ${client.status} (attendu: call_done)` })
      };
    }

    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .insert([{
        client_id: clientId,
        type: 'scan_3d',
        status: 'requested',
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        location: location || client.adresse || '',
        notes: `Réservé via Calendly. Créneau: ${eventTitle || 'Scan 3D Matterport'}`
      }])
      .select()
      .single();

    if (apptError) {
      console.error('Erreur INSERT appointment:', apptError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: apptError.message }) };
    }

    const { error: updateError } = await supabase
      .from('clients')
      .update({ status: 'scan_scheduled', updated_at: new Date().toISOString() })
      .eq('id', clientId)
      .in('status', ['call_done']);

    if (updateError) {
      console.warn('book-scan client status update failed:', updateError.message);
    }

    console.log(`RDV scan créé : ${appt.id} pour client ${clientId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, appointmentId: appt.id, appointment: appt })
    };
  } catch (err) {
    console.error('book-scan error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
