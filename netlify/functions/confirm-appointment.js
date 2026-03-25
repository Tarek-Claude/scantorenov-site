const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { appointmentId, action, clientId } = body;

    if (!appointmentId || !action || !clientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required fields: appointmentId, action, clientId',
        }),
      };
    }

    // Validate action
    if (!['confirm', 'cancel'].includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid action. Must be "confirm" or "cancel"',
        }),
      };
    }

    // Determine new status based on action
    let newStatus;
    if (action === 'confirm') {
      newStatus = 'confirmed';
    } else if (action === 'cancel') {
      newStatus = 'cancelled';
    }

    // Update appointment status in Supabase
    const { data, error: updateError } = await supabase
      .from('appointments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('client_id', clientId)
      .select();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Failed to update appointment status',
          details: updateError.message,
        }),
      };
    }

    if (!data || data.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Appointment not found or unauthorized access',
        }),
      };
    }

    const updatedAppointment = data[0];

    console.log(
      `Appointment ${appointmentId} status updated to ${newStatus} for client ${clientId}`
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Appointment ${action}ed successfully`,
        appointment: updatedAppointment,
      }),
    };
  } catch (err) {
    console.error('confirm-appointment error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: err.message,
      }),
    };
  }
};
