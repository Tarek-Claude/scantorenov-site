const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const { resolveIdentityClient } = require('./_identity-client');
const { authorizeAdminRequest } = require('./_admin-session');
const { upsertClientPipeline } = require('./_client-pipeline');

const SITE_URL = 'https://scantorenov.com';

// Service key pour bypasser RLS et lire les donnees client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

/* Helpers */

function formatDateFR(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTimeFR(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function typeLabelFR(type) {
  const map = {
    phone_call: 'Appel telephonique',
    video: 'Visioconference',
    on_site: 'Visite sur site'
  };
  return map[type] || type;
}

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
        Rendez-vous confirme
      </h2>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Bonjour ${prenom || fullName},
      </p>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Votre rendez-vous avec l'equipe <strong>ScantoRenov</strong> est confirme. Voici le recapitulatif :
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
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Duree</td>
            <td style="padding:8px 0;color:#5A5A5A;">${durationMinutes} minutes</td>
          </tr>
        </table>
      </div>

      <p style="font-size:0.9rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Vous pouvez consulter et gerer vos rendez-vous depuis votre <a href="${SITE_URL}/espace-client" style="color:#2D5F3E;font-weight:600;">espace client</a>.
      </p>

      <p style="font-size:0.9rem;color:#5A5A5A;margin:0 0 32px 0;padding:0 24px;">
        Pour toute question, contactez-nous a <a href="mailto:avant-projet@scantorenov.com" style="color:#2D5F3E;">avant-projet@scantorenov.com</a>.
      </p>

      <div style="text-align:center;padding:24px 0;border-top:1px solid #E8E8E8;margin-top:32px;">
        <p style="font-size:0.78rem;color:#9A9A9A;margin:0;">
          Scantorenov · <a href="${SITE_URL}" style="color:#9A9A9A;">scantorenov.com</a> · avant-projet@scantorenov.com
        </p>
      </div>
    </div>
  `;
}

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
        Rendez-vous annule
      </h2>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Bonjour ${prenom || nom},
      </p>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Votre rendez-vous du <strong>${dateStr} a ${timeStr}</strong> (${typeLabel}) a bien ete annule.
      </p>

      <p style="font-size:0.9rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Si vous souhaitez prendre un nouveau rendez-vous, rendez-vous dans votre
        <a href="${SITE_URL}/espace-client" style="color:#2D5F3E;font-weight:600;">espace client</a>.
      </p>

      <p style="font-size:0.9rem;color:#5A5A5A;margin:0 0 32px 0;padding:0 24px;">
        Pour toute question : <a href="mailto:avant-projet@scantorenov.com" style="color:#2D5F3E;">avant-projet@scantorenov.com</a>
      </p>

      <div style="text-align:center;padding:24px 0;border-top:1px solid #E8E8E8;margin-top:32px;">
        <p style="font-size:0.78rem;color:#9A9A9A;margin:0;">
          Scantorenov · <a href="${SITE_URL}" style="color:#9A9A9A;">scantorenov.com</a> · avant-projet@scantorenov.com
        </p>
      </div>
    </div>
  `;
}

function buildAdminEmailHtml({ action, prenom, nom, email, scheduledAt, durationMinutes, type }) {
  const dateStr = formatDateFR(scheduledAt);
  const timeStr = formatTimeFR(scheduledAt);
  const typeLabel = typeLabelFR(type);
  const fullName = [prenom, nom].filter(Boolean).join(' ');
  const actionLabel = action === 'confirm' ? 'CONFIRME' : 'ANNULE';
  const color = action === 'confirm' ? '#2D5F3E' : '#C62828';

  return `
    <h2 style="color:${color};">Rendez-vous ${actionLabel}</h2>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
      <tr><td style="padding:6px 12px;font-weight:bold;">Client</td><td style="padding:6px 12px;">${fullName}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Type</td><td style="padding:6px 12px;">${typeLabel}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Date</td><td style="padding:6px 12px;">${dateStr} a ${timeStr}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Duree</td><td style="padding:6px 12px;">${durationMinutes} min</td></tr>
    </table>
  `;
}

function isPastDate(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret, x-admin-session',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const isAdminCall = authorizeAdminRequest(event).authorized;

    if (!isAdminCall && !(context && context.clientContext && context.clientContext.user)) {
      console.warn('confirm-appointment: access denied - no admin secret and no identity user');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { appointmentId, action, clientId: requestedClientId } = body;

    if (!appointmentId || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: appointmentId, action' }),
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
    let resolvedClient = null;
    let resolvedClientId = requestedClientId || null;

    if (!isAdminCall) {
      const resolution = await resolveIdentityClient({
        context,
        requestedClientId,
        createIfMissing: false
      });
      resolvedClient = resolution.client;
      resolvedClientId = resolvedClient.id;
    } else if (!resolvedClientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'clientId requis pour un appel admin' }),
      };
    }

    const { data: apptData, error: updateError } = await supabase
      .from('appointments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .eq('client_id', resolvedClientId)
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
    console.log(`Appointment ${appointmentId} -> ${newStatus}`);

    let clientData = resolvedClient;
    let clientError = null;

    if (!clientData) {
      const clientResult = await supabase
        .from('clients')
        .select('id, email, prenom, nom')
        .eq('id', resolvedClientId)
        .single();
      clientData = clientResult.data;
      clientError = clientResult.error;
    }

    if (clientError || !clientData) {
      console.warn('Client data not found, skipping email:', clientError && clientError.message ? clientError.message : '');
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

    if (action === 'confirm') {
      try {
        const shouldAdvanceToCallDone = appt.type === 'phone_call' && isPastDate(appt.scheduled_at);
        const pipelineStatus = shouldAdvanceToCallDone ? 'call_done' : 'call_requested';
        const nextPhase = shouldAdvanceToCallDone ? 4 : 3;
        const reconciliation = await upsertClientPipeline({
          email: clientEmail,
          fields: {
            phase: nextPhase,
            call_scheduled_at: appt.scheduled_at,
          },
          status: pipelineStatus,
          strict: true,
        });

        if (reconciliation && reconciliation.data) {
          clientData = reconciliation.data;
        }
        console.log(`B-4d: client ${resolvedClientId} pipeline -> ${pipelineStatus}, phase=${nextPhase}, call_scheduled_at=${appt.scheduled_at}`);
      } catch (pipelineErr) {
        console.warn('B-4d pipeline exception (non-blocking):', pipelineErr.message);
      }
    }

    const emailResults = await Promise.allSettled([
      resend.emails.send({
        from: 'ScantoRenov <avant-projet@scantorenov.com>',
        to: [clientEmail],
        subject: action === 'confirm'
          ? 'Confirmation de votre rendez-vous - ScantoRenov'
          : 'Annulation de votre rendez-vous - ScantoRenov',
        html: action === 'confirm'
          ? buildConfirmEmailHtml(emailContext)
          : buildCancelEmailHtml(emailContext),
      }),
      resend.emails.send({
        from: 'ScantoRenov <avant-projet@scantorenov.com>',
        to: ['scantorenov@gmail.com'],
        subject: action === 'confirm'
          ? `[RDV CONFIRME] ${[prenom, nom].filter(Boolean).join(' ')}`
          : `[RDV ANNULE] ${[prenom, nom].filter(Boolean).join(' ')}`,
        html: buildAdminEmailHtml({ action, ...emailContext }),
      }),
    ]);

    emailResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`Email ${i === 0 ? 'client' : 'admin'} failed:`, result.reason);
      } else {
        console.log(`Email ${i === 0 ? 'client' : 'admin'} sent:`, result.value && result.value.data ? result.value.data.id : null);
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
    const statusCode = err && err.statusCode ? err.statusCode : 500;
    console.error('confirm-appointment error:', err);
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 500 ? 'Internal server error' : err.message,
        message: err && err.message ? err.message : 'Unknown error'
      }),
    };
  }
};
