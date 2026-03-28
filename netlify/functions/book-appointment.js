const { createClient } = require('@supabase/supabase-js');
const { upsertClientPipeline } = require('./_client-pipeline');
const { APPOINTMENT_RULES, findConflict, isSlotBookable } = require('./_appointment-utils');

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

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

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
    const clientId = body.clientId;
    const scheduledAt = body.scheduledAt;
    const durationMinutes = APPOINTMENT_RULES.phone_call.durationMinutes;

    if (!clientId || !scheduledAt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'clientId and scheduledAt are required' }),
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

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, status')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Client introuvable' }),
      };
    }

    if (
      normalizeEmail(identityUser.email) &&
      normalizeEmail(client.email) &&
      normalizeEmail(identityUser.email) !== normalizeEmail(client.email)
    ) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden' }),
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
    console.error('book-appointment error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
