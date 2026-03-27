/**
 * Netlify Function: book-appointment.js
 *
 * Purpose:
 *   - Receive Calendly webhook POST for scheduled appointment events
 *   - Extract appointment data from webhook payload
 *   - Insert new appointment record into Supabase appointments table
 *   - Return 200 OK to acknowledge webhook receipt
 *
 * Webhook Integration:
 *   - Calendly webhook URL: https://<site-url>/.netlify/functions/book-appointment
 *   - Event types: "invitee.created" (when a booking is made)
 *
 * Expected Calendly payload structure:
 *   {
 *     "event": "invitee.created",
 *     "payload": {
 *       "scheduled_event": {
 *         "event_memberships": [{ "user": { "email": "..." } }],
 *         "start_time": "2026-03-28T14:00:00Z",
 *         "duration_minutes": 30
 *       },
 *       "invitee": {
 *         "email": "client@example.com",
 *         "name": "Client Name"
 *       }
 *     }
 *   }
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client — service key requis : webhook Calendly non authentifié
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment variables (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Helper: Get or find client_id from email
 * Searches clients table for matching email
 * Returns client_id or null if not found
 */
async function getClientIdFromEmail(email) {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .single();

    if (error) {
      console.warn(`Client not found for email: ${email}`, error.message);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error(`Error fetching client for email ${email}:`, err);
    return null;
  }
}

/**
 * Main handler function
 */
exports.handler = async (event, context) => {
  console.log('📞 Received webhook from Calendly');

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse webhook payload
    const payload = typeof event.body === 'string'
      ? JSON.parse(event.body)
      : event.body;

    // Verify webhook is for a scheduled event
    if (payload.event !== 'invitee.created') {
      console.log(`⚠️  Ignoring event type: ${payload.event}`);
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }

    const inviteeData = payload.payload?.invitee;
    const scheduledEvent = payload.payload?.scheduled_event;

    if (!inviteeData || !scheduledEvent) {
      console.warn('⚠️  Missing invitee or scheduled_event data in webhook');
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payload' }) };
    }

    // Extract appointment data
    const clientEmail = inviteeData.email;
    const clientName = inviteeData.name;
    const scheduledAt = scheduledEvent.start_time;
    const durationMinutes = scheduledEvent.duration_minutes || 30;

    console.log(`📅 Processing appointment for ${clientEmail} at ${scheduledAt}`);

    // Find client_id from email
    const clientId = await getClientIdFromEmail(clientEmail);

    if (!clientId) {
      console.error(`❌ Client not found for email: ${clientEmail}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Client not found' }),
      };
    }

    console.log(`✅ Found client: ${clientId}`);

    // Idempotence : vérifier si un RDV identique existe déjà (même client + même créneau)
    const { data: existingAppt } = await supabase
      .from('appointments')
      .select('id')
      .eq('client_id', clientId)
      .eq('scheduled_at', scheduledAt)
      .eq('type', 'phone_call')
      .maybeSingle();

    if (existingAppt) {
      console.log(`⚠️  Appointment already exists for ${clientEmail} at ${scheduledAt} (id: ${existingAppt.id}) — skipping (idempotence)`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          duplicate: true,
          message: 'Appointment already recorded',
          appointmentId: existingAppt.id,
        }),
      };
    }

    // Insert appointment into Supabase
    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          client_id: clientId,
          type: 'phone_call',
          status: 'requested',
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          location: 'phone',
          notes: `Scheduled via Calendly by ${clientName} (${clientEmail})`,
        },
      ])
      .select();

    if (error) {
      console.error('❌ Error inserting appointment:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to save appointment', details: error.message }),
      };
    }

    console.log(`✅ Appointment created:`, data[0]);

    // Return success response to Calendly
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Appointment recorded successfully',
        appointmentId: data[0].id,
      }),
    };
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
    };
  }
};
