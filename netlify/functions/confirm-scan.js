const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const CLIENT_CONFIRMATION_NOTE_TYPE = 'scan_confirmation_client_email';
const ADMIN_CONFIRMATION_NOTE_TYPE = 'scan_confirmation_admin_email';

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function getResendClient() {
  const apiKey = typeof process.env.RESEND_API_KEY === 'string'
    ? process.env.RESEND_API_KEY.trim()
    : '';

  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

function getSiteUrl() {
  const value = process.env.SITE_URL
    || process.env.URL
    || process.env.DEPLOY_PRIME_URL
    || 'https://scantorenov.com';

  return String(value).replace(/\/+$/, '');
}

function getEmailFrom() {
  return process.env.EMAIL_FROM || 'ScantoRenov <avant-projet@scantorenov.com>';
}

function getAdminNotificationEmail() {
  return process.env.ADMIN_NOTIFICATION_EMAIL || 'scantorenov@gmail.com';
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function formatDateFR(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTimeFR(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function fetchNotificationNotes(supabase, clientId, appointmentId) {
  const { data, error } = await supabase
    .from('project_notes')
    .select('type')
    .eq('client_id', clientId)
    .eq('appointment_id', appointmentId)
    .in('type', [CLIENT_CONFIRMATION_NOTE_TYPE, ADMIN_CONFIRMATION_NOTE_TYPE]);

  if (error) {
    throw new Error(`Supabase lecture project_notes: ${error.message}`);
  }

  return new Set(Array.isArray(data) ? data.map((row) => row.type).filter(Boolean) : []);
}

async function rememberNotification(supabase, clientId, appointmentId, type, summary) {
  const { error } = await supabase
    .from('project_notes')
    .insert([{
      client_id: clientId,
      appointment_id: appointmentId,
      type,
      summary,
      created_by: 'stripe_webhook'
    }]);

  if (error) {
    throw new Error(`Supabase insert project_notes: ${error.message}`);
  }
}

async function sendClientConfirmationEmail(resendClient, context) {
  const client = context.client;
  const appt = context.appt;
  const phoneNote = context.phoneNote;
  const siteUrl = context.siteUrl;
  const prenom = client.prenom || client.nom || 'Madame/Monsieur';
  const adresseRdv = appt.location || client.adresse || 'votre bien';
  const telephone = [client.indicatif, client.telephone].filter(Boolean).join(' ');
  const dateStr = formatDateFR(appt.scheduled_at);
  const timeStr = formatTimeFR(appt.scheduled_at);
  const duration = appt.duration_minutes
    ? `${appt.duration_minutes} minutes`
    : 'Entre 1h et 2h30 selon la superficie';

  const needsHtml = phoneNote && Array.isArray(phoneNote.needs) && phoneNote.needs.length > 0
    ? `<p style="margin:0 0 8px 0;font-size:0.88rem;color:#5A5A5A;">Besoins identifiés : ${phoneNote.needs.join(', ')}</p>`
    : '';

  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:620px;margin:0 auto;color:#2A2A2A;line-height:1.7;">
      <div style="text-align:center;padding:32px 0 24px;">
        <img src="${siteUrl}/logo-scantorenov.webp" alt="ScantoRenov" style="width:60px;height:auto;" />
      </div>

      <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.5rem;text-align:center;margin:0 0 28px 0;">
        Votre scan 3D est confirmé
      </h2>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 12px 0;padding:0 24px;">
        Bonjour ${prenom},
      </p>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 24px 0;padding:0 24px;">
        Votre paiement a bien été reçu et votre rendez-vous de scan 3D est
        <strong>officiellement confirmé</strong>. Voici le récapitulatif :
      </p>

      <div style="margin:0 24px 24px;padding:24px;border:1px solid #E8E8E8;background:#FBFAF7;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;width:40%;">Date</td>
            <td style="padding:8px 0;color:#5A5A5A;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Heure</td>
            <td style="padding:8px 0;color:#5A5A5A;">${timeStr}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Durée estimée</td>
            <td style="padding:8px 0;color:#5A5A5A;">${duration}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Adresse</td>
            <td style="padding:8px 0;color:#5A5A5A;">${adresseRdv}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Montant réglé</td>
            <td style="padding:8px 0;color:#5A5A5A;"><strong>180 € TTC</strong></td>
          </tr>
        </table>
        ${needsHtml}
      </div>

      <div style="margin:0 24px 24px;padding:20px;border-left:4px solid #2D5F3E;background:#F5F9F6;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 8px 0;font-weight:600;font-size:0.9rem;color:#2D5F3E;">
          Comment préparer la visite ?
        </p>
        <ul style="margin:0;padding-left:20px;font-size:0.88rem;color:#5A5A5A;">
          <li>Assurez-vous d'être présent(e) ou d'avoir délégué l'accès au bien</li>
          <li>Libérez les pièces : rangez les encombrants pour un scan optimal</li>
          <li>Prévoyez les clés et codes d'accès nécessaires</li>
          <li>Si possible, rassemblez les plans existants du bien</li>
        </ul>
      </div>

      <div style="text-align:center;margin:24px;">
        <a href="${siteUrl}/espace-client.html"
           style="display:inline-block;background:#2D5F3E;color:#fff;text-decoration:none;padding:14px 32px;border-radius:4px;font-size:0.9rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">
          Accéder à mon espace
        </a>
      </div>

      <p style="font-size:0.85rem;color:#9A9A9A;text-align:center;padding:0 24px;margin:0 0 24px 0;">
        Des questions ? Contactez-nous à
        <a href="mailto:avant-projet@scantorenov.com" style="color:#2D5F3E;">avant-projet@scantorenov.com</a>
        ${telephone ? ` ou au <a href="tel:${telephone}" style="color:#2D5F3E;">${telephone}</a>` : ''}
      </p>

      <div style="text-align:center;padding:24px 0;border-top:1px solid #E8E8E8;margin-top:16px;">
        <p style="font-size:0.78rem;color:#9A9A9A;margin:0;">
          ScantoRenov · <a href="${siteUrl}" style="color:#9A9A9A;">scantorenov.com</a> · avant-projet@scantorenov.com
        </p>
      </div>
    </div>
  `;

  return resendClient.emails.send({
    from: getEmailFrom(),
    to: [client.email],
    subject: `Scan 3D confirmé - ${dateStr} à ${timeStr} - ScantoRenov`,
    html
  });
}

async function sendAdminNotificationEmail(resendClient, context) {
  const client = context.client;
  const appt = context.appt;
  const prenom = client.prenom || '';
  const nom = client.nom || '';
  const fullName = [prenom, nom].filter(Boolean).join(' ') || client.email;
  const telephone = [client.indicatif, client.telephone].filter(Boolean).join(' ') || 'N/A';
  const adresseRdv = appt.location || client.adresse || 'Non renseignée';
  const dateStr = formatDateFR(appt.scheduled_at);
  const timeStr = formatTimeFR(appt.scheduled_at);
  const duration = appt.duration_minutes ? `${appt.duration_minutes} min` : 'Durée à confirmer';

  const html = `
    <h2 style="color:#2D5F3E;">RDV Scan 3D confirmé</h2>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
      <tr><td style="padding:6px 12px;font-weight:bold;">Client</td><td style="padding:6px 12px;">${fullName}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;"><a href="mailto:${client.email}">${client.email}</a></td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Téléphone</td><td style="padding:6px 12px;">${telephone}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Adresse</td><td style="padding:6px 12px;">${adresseRdv}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Date scan</td><td style="padding:6px 12px;">${dateStr} à ${timeStr}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Durée</td><td style="padding:6px 12px;">${duration}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Paiement</td><td style="padding:6px 12px;color:#2D5F3E;font-weight:bold;">180 € TTC reçu</td></tr>
    </table>
    <p style="margin-top:16px;font-size:13px;color:#5A5A5A;">
      <a href="https://supabase.com/dashboard" style="color:#2D5F3E;">Voir dans Supabase</a>
    </p>
  `;

  return resendClient.emails.send({
    from: getEmailFrom(),
    to: [getAdminNotificationEmail()],
    subject: `[SCAN CONFIRMÉ] ${fullName} - ${dateStr} ${timeStr}`,
    html
  });
}

async function runScanConfirmation(options = {}) {
  const clientId = options.clientId;
  const appointmentId = options.appointmentId;
  const logger = options.logger || console;

  if (!clientId || !appointmentId) {
    throw createHttpError(400, 'clientId et appointmentId requis');
  }

  const supabase = getSupabaseAdmin();
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, email, prenom, nom, adresse, telephone, indicatif')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    throw createHttpError(404, 'Client introuvable');
  }

  const { data: appt, error: apptError } = await supabase
    .from('appointments')
    .select('id, client_id, type, status, scheduled_at, duration_minutes, location')
    .eq('id', appointmentId)
    .eq('type', 'scan_3d')
    .single();

  if (apptError || !appt || appt.client_id !== clientId) {
    throw createHttpError(404, 'RDV scan introuvable');
  }

  const { data: phoneNote } = await supabase
    .from('project_notes')
    .select('confirmed_surface, confirmed_budget, needs')
    .eq('client_id', clientId)
    .eq('type', 'phone_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingNotes = await fetchNotificationNotes(supabase, clientId, appointmentId);
  const resendClient = getResendClient();
  const result = {
    success: false,
    statusCode: 200,
    emailConfigured: !!resendClient,
    clientDelivered: existingNotes.has(CLIENT_CONFIRMATION_NOTE_TYPE),
    adminDelivered: existingNotes.has(ADMIN_CONFIRMATION_NOTE_TYPE)
  };

  if (!resendClient) {
    result.statusCode = 503;
    result.message = 'RESEND_API_KEY non configurée';
    return result;
  }

  const emailContext = {
    client,
    appt,
    phoneNote: phoneNote || null,
    siteUrl: getSiteUrl()
  };

  if (!result.clientDelivered) {
    try {
      await sendClientConfirmationEmail(resendClient, emailContext);
      await rememberNotification(
        supabase,
        clientId,
        appointmentId,
        CLIENT_CONFIRMATION_NOTE_TYPE,
        'Email de confirmation scan envoyé au client'
      );
      result.clientDelivered = true;
      logger.log('Email confirmation scan envoyé au client:', client.email);
    } catch (error) {
      result.clientError = error.message;
      logger.error('Email client échoué:', error);
    }
  } else {
    logger.log('confirm-scan: email client déjà journalisé, envoi ignoré');
  }

  if (!result.adminDelivered) {
    try {
      await sendAdminNotificationEmail(resendClient, emailContext);
      await rememberNotification(
        supabase,
        clientId,
        appointmentId,
        ADMIN_CONFIRMATION_NOTE_TYPE,
        'Notification admin scan envoyée'
      );
      result.adminDelivered = true;
      logger.log('Email admin scan envoyé:', appt.id);
    } catch (error) {
      result.adminError = error.message;
      logger.error('Email admin échoué:', error);
    }
  } else {
    logger.log('confirm-scan: email admin déjà journalisé, envoi ignoré');
  }

  result.success = result.clientDelivered && result.adminDelivered;
  if (!result.success) {
    result.statusCode = 502;
    result.message = 'Confirmation scan partiellement traitée';
  }

  return result;
}

async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  try {
    const adminSecret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'];
    const expectedAdminSecret = typeof process.env.ADMIN_SECRET === 'string'
      ? process.env.ADMIN_SECRET.trim()
      : '';

    if (!expectedAdminSecret) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'ADMIN_SECRET non configuré' }) };
    }

    if (!adminSecret || adminSecret !== expectedAdminSecret) {
      console.warn('confirm-scan: accès refusé - admin-secret manquant ou invalide');
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const result = await runScanConfirmation({
      clientId: body.clientId,
      appointmentId: body.appointmentId,
      logger: console
    });

    return {
      statusCode: result.statusCode,
      headers,
      body: JSON.stringify(result)
    };
  } catch (err) {
    const statusCode = err && err.statusCode ? err.statusCode : 500;
    console.error('confirm-scan error:', err);
    return { statusCode, headers, body: JSON.stringify({ error: err.message }) };
  }
}

exports.handler = handler;
module.exports.runScanConfirmation = runScanConfirmation;
