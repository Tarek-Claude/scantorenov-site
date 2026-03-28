const { createClient } = require('@supabase/supabase-js');
const { upsertClientPipeline } = require('./_client-pipeline');
const { APPOINTMENT_RULES, findConflict, isSlotBookable } = require('./_appointment-utils');
const { resolveIdentityClient } = require('./_identity-client');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
    const durationMinutes = APPOINTMENT_RULES.phone_call.durationMinutes;

    if (!scheduledAt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'scheduledAt is required' }),
      };
    }

    const requestedStart = new Date(scheduledAt);
    if (Number.isNaN(requestedStart.getTime())) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'scheduledAt must be a valid ISO datetime' }),
      };
    }

    if (!isSlotBookable('phone_call', requestedStart)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Requested slot is outside booking rules' }),
      };
    }

    const resolution = await resolveIdentityClient({
      context,
      requestedClientId,
      createIfMissing: true
    });
    const client = resolution.client;
    const clientId = client.id;

    const conflict = await findConflict(supabase, requestedStart, durationMinutes);
    if (conflict) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Ce creneau est deja indisponible' }),
      };
    }

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert([
        {
          client_id: clientId,
          type: 'phone_call',
          status: 'requested',
          scheduled_at: requestedStart.toISOString(),
          duration_minutes: durationMinutes,
          location: 'phone',
          notes: 'Reserve via espace client',
        },
      ])
      .select('id, scheduled_at, duration_minutes, status, type')
      .single();

    if (insertError || !appointment) {
      console.error('book-appointment insert error:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save appointment' }),
      };
    }

    try {
      await upsertClientPipeline({
        email: client.email,
        fields: {
          call_scheduled_at: appointment.scheduled_at,
        },
        status: 'call_requested',
        strict: true,
      });
    } catch (updateError) {
      console.warn('book-appointment pipeline update failed:', updateError.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        appointmentId: appointment.id,
      }),
    };
  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    console.error('book-appointment error:', error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: error && error.message ? error.message : 'Internal server error' }),
    };
  }
};
