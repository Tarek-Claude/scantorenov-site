const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const SITE_URL = 'https://scantorenov.com';

// Service key pour bypasser RLS et lire les données client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

/* ── Helpers ─────────────────────────────────────────── */

function formatDateFR(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatTimeFR(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function typeLabelFR(type) {
  const map = { phone_call: 'Appel téléphonique', video: 'Visioconférence', on_site: 'Visite sur site' };
  return map[type] || type;
}

/* ── Email client : confirmation ─────────────────────── */

function buildConfirmEmailHtml({ prenom, nom, scheduledAt, durationMinutes, type }) {
  const dateStr = formatDateFR(scheduledAt);
  const timeStr = formatTimeFR(scheduledAt);
  const typeLabel = typeLabelFR(type);
  const fullName = [prenom, nom].filter(Boolean).join(' ');

  return `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:620px;margin:0 auto;color:#2A2A2A;line-height:1.7;">
      <div style="text-align:center;padding:32px 0 24px;">
        <img src="${SITE_URL}/logo-scantorenov.webp" alt="Scantorenov" style="width:60px;height:auto;" />
      </div>

      <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.5rem;text-align:center;margin:0 0 28px 0;">
        Rendez-vous confirmé
      </h2>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Bonjour ${prenom || fullName},
      </p>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Votre rendez-vous avec l'équipe <strong>ScantoRenov</strong> est confirmé. Voici le récapitulatif :
      </p>

      <div style="margin:24px;padding:24px;border:1px solid #E8E8E8;background:#FBFAF7;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;width:40%;">Type</td>
            <td style="padding:8px 0;color:#5A5A5A;">${typeLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Date</td>
            <td style="padding:8px 0;color:#5A5A5A;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Heure</td>
            <td style="padding:8px 0;color:#5A5A5A;">${timeStr}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Durée</td>
            <td style="padding:8px 0;color:#5A5A5A;">${durationMinutes} minutes</td>
          </tr>
        </table>
      </div>

      <p style="font-size:0.9rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Vous pouvez consulter et gérer vos rendez-vous depuis votre <a href="${SITE_URL}/espace-client" style="color:#2D5F3E;font-weight:600;">espace client</a>.
      </p>

      <p style="font-size:0.9rem;color:#5A5A5A;margin:0 0 32px 0;padding:0 24px;">
        Pour toute question, contactez-nous à <a href="mailto:contact@scantorenov.com" style="color:#2D5F3E;">contact@scantorenov.com</a>.
      </p>

      <div style="text-align:center;padding:24px 0;border-top:1px solid #E8E8E8;margin-top:32px;">
        <p style="font-size:0.78rem;color:#9A9A9A;margin:0;">
          Scantorenov · <a href="${SITE_URL}" style="color:#9A9A9A;">scantorenov.com</a> · contact@scantorenov.com
        </p>
      </div>
    </div>
  `;
}

/* ── Email client : annulation ───────────────────────── */

function buildCancelEmailHtml({ prenom, nom, scheduledAt, type }) {
  const dateStr = formatDateFR(scheduledAt);
  const timeStr = formatTimeFR(scheduledAt);
  const typeLabel = typeLabelFR(type);

  return `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:620px;margin:0 auto;color:#2A2A2A;line-height:1.7;">
      <div style="text-align:center;padding:32px 0 24px;">
        <img src="${SITE_URL}/logo-scantorenov.webp" alt="Scantorenov" style="width:60px;height:auto;" />
      </div>

      <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.5rem;text-align:center;margin:0 0 28px 0;">
        Rendez-vous annulé
      </h2>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Bonjour ${prenom || nom},
      </p>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Votre rendez-vous du <strong>${dateStr} à ${timeStr}</strong> (${typeLabel}) a bien été annulé.
      </p>

      <p style="font-size:0.9rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Si vous souhaitez prendre un nouveau rendez-vous, rendez-vous dans votre
        <a href="${SITE_URL}/espace-client" style="color:#2D5F3E;font-weight:600;">espace client</a>.
      </p>

      <p style="font-size:0.9rem;color:#5A5A5A;margin:0 0 32px 0;padding:0 24px;">
        Pour toute question : <a href="mailto:contact@scantorenov.com" style="color:#2D5F3E;">contact@scantorenov.com</a>
      </p>

      <div style="text-align:center;padding:24px 0;border-top:1px solid #E8E8E8;margin-top:32px;">
        <p style="font-size:0.78rem;color:#9A9A9A;margin:0;">
          Scantorenov · <a href="${SITE_URL}" style="color:#9A9A9A;">scantorenov.com</a> · contact@scantorenov.com
        </p>
      </div>
    </div>
  `;
}

/* ── Email admin : notification ──────────────────────── */

function buildAdminEmailHtml({ action, prenom, nom, email, scheduledAt, durationMinutes, type }) {
  const dateStr = formatDateFR(scheduledAt);
  const timeStr = formatTimeFR(scheduledAt);
  const typeLabel = typeLabelFR(type);
  const fullName = [prenom, nom].filter(Boolean).join(' ');
  const actionLabel = action === 'confirm' ? '✅ CONFIRMÉ' : '❌ ANNULÉ';
  const color = action === 'confirm' ? '#2D5F3E' : '#C62828';

  return `
    <h2 style="color:${color};">Rendez-vous ${actionLabel}</h2>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
      <tr><td style="padding:6px 12px;font-weight:bold;">Client</td><td style="padding:6px 12px;">${fullName}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Type</td><td style="padding:6px 12px;">${typeLabel}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Date</td><td style="padding:6px 12px;">${dateStr} à ${timeStr}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Durée</td><td style="padding:6px 12px;">${durationMinutes} min</td></tr>
    </table>
  `;
}

/* ── Handler principal ───────────────────────────────── */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { appointmentId, action, clientId } = body;

    if (!appointmentId || !action || !clientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: appointmentId, action, clientId' }),
      };
    }

    if (!['confirm', 'cancel'].includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action. Must be "confirm" or "cancel"' }),
      };
    }

    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';

    // 1. Mettre à jour le statut du rendez-vous
    const { data: apptData, error: updateError } = await supabase
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
        body: JSON.stringify({ error: 'Failed to update appointment status', details: updateError.message }),
      };
    }

    if (!apptData || apptData.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Appointment not found or unauthorized access' }),
      };
    }

    const appt = apptData[0];
    console.log(`Appointment ${appointmentId} → ${newStatus}`);

    // 2. Récupérer les données du client (service key bypasse RLS)
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('email, prenom, nom')
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      console.warn('Client data not found, skipping email:', clientError?.message);
      // On retourne quand même le succès de la mise à jour
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: `Appointment ${action}ed successfully (email skipped: client not found)`,
          appointment: appt,
        }),
      };
    }

    const { email: clientEmail, prenom, nom } = clientData;
    const emailContext = {
      prenom,
      nom,
      email: clientEmail,
      scheduledAt: appt.scheduled_at,
      durationMinutes: appt.duration_minutes,
      type: appt.type,
    };

    // 3. B-4d : Mettre à jour le pipeline client si confirmation
    if (action === 'confirm') {
      try {
        const { error: pipelineError } = await supabase
          .from('clients')
          .update({
            status: 'call_requested',
            call_scheduled_at: appt.scheduled_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', clientId)
          // Ne rétrograder jamais : n'écraser que si le statut actuel est en dessous de call_requested
          .in('status', ['new_lead', 'account_created', 'onboarding_completed', 'call_requested']);

        if (pipelineError) {
          console.warn('B-4d pipeline update failed (non-blocking):', pipelineError.message);
        } else {
          console.log(`B-4d: client ${clientId} pipeline → call_requested, call_scheduled_at=${appt.scheduled_at}`);
        }
      } catch (pipelineErr) {
        console.warn('B-4d pipeline exception (non-blocking):', pipelineErr.message);
      }
    }

    // 4. B-4b : Envoyer les emails via Resend
    const emailResults = await Promise.allSettled([
      // Email au client
      resend.emails.send({
        from: 'ScantoRenov <contact@scantorenov.com>',
        to: [clientEmail],
        subject: action === 'confirm'
          ? `Confirmation de votre rendez-vous – ScantoRenov`
          : `Annulation de votre rendez-vous – ScantoRenov`,
        html: action === 'confirm'
          ? buildConfirmEmailHtml(emailContext)
          : buildCancelEmailHtml(emailContext),
      }),
      // Notification admin
      resend.emails.send({
        from: 'ScantoRenov <contact@scantorenov.com>',
        to: ['scantorenov@gmail.com'],
        subject: action === 'confirm'
          ? `[RDV CONFIRMÉ] ${[prenom, nom].filter(Boolean).join(' ')}`
          : `[RDV ANNULÉ] ${[prenom, nom].filter(Boolean).join(' ')}`,
        html: buildAdminEmailHtml({ action, ...emailContext }),
      }),
    ]);

    emailResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`Email ${i === 0 ? 'client' : 'admin'} failed:`, result.reason);
      } else {
        console.log(`Email ${i === 0 ? 'client' : 'admin'} sent:`, result.value?.data?.id);
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Appointment ${action}ed successfully`,
        appointment: appt,
        emailSent: emailResults[0].status === 'fulfilled',
      }),
    };
  } catch (err) {
    console.error('confirm-appointment error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: err.message }),
    };
  }
};
