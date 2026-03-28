const { createClient } = require('@supabase/supabase-js');
const {
  APPOINTMENT_RULES,
  findConflictInList,
  generateSlots,
  getDurationMinutes,
  isIsoDateOnly,
  parseDateOnly,
  shiftDateString,
  zonedDateTimeToUtc,
} = require('./_appointment-utils');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Supabase configuration missing' }),
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const type = params.type;
    const fromDate = params.from;
    const toDate = params.to;

    if (!APPOINTMENT_RULES[type]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid appointment type' }),
      };
    }

    if (!isIsoDateOnly(fromDate) || !isIsoDateOnly(toDate) || !parseDateOnly(fromDate) || !parseDateOnly(toDate)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'from and to must be valid ISO dates (YYYY-MM-DD)' }),
      };
    }

    if (fromDate > toDate) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'from must be before or equal to to' }),
      };
    }

    const generatedSlots = generateSlots(type, fromDate, toDate);
    const fetchStart = zonedDateTimeToUtc(shiftDateString(fromDate, -1), '00:00:00').toISOString();
    const fetchEnd = zonedDateTimeToUtc(shiftDateString(toDate, 1), '23:59:59').toISOString();

    const { data, error } = await supabase
      .from('appointments')
      .select('scheduled_at, duration_minutes, type')
      .neq('status', 'cancelled')
      .gte('scheduled_at', fetchStart)
      .lte('scheduled_at', fetchEnd)
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('get-available-slots query error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to load appointments' }),
      };
    }

    const appointments = data || [];
    const slots = generatedSlots.map((slot) => {
      const slotStart = new Date(slot.scheduledAt);
      const conflict = findConflictInList(
        appointments,
        slotStart,
        getDurationMinutes({ type, duration_minutes: slot.durationMinutes })
      );

      return {
        date: slot.date,
        time: slot.time,
        available: slot.available && !conflict,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ type, slots }),
    };
  } catch (error) {
    console.error('get-available-slots error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
