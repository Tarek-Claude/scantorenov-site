const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const { authorizeAdminRequest } = require('./_admin-session');

const SITE_URL = 'https://scantorenov.com';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

function getScanDuration(surface) {
  const surfaceNum = parseInt(surface, 10);

  if (!surfaceNum) return '1h à 2h';
  if (surfaceNum <= 50) return '45 min à 1h';
  if (surfaceNum <= 100) return '1h à 1h30';
  if (surfaceNum <= 200) return '1h30 à 2h30';
  return '2h30 à 3h';
}

function getScanDurationLabel(phoneNote) {
  if (phoneNote && phoneNote.confirmed_surface) {
    return `Durée estimée : environ ${getScanDuration(phoneNote.confirmed_surface)}`;
  }

  return 'Durée estimée : entre 1h et 2h selon la superficie du bien';
}

async function sendInvitationEmail(client, scanDuration) {
  const prenom = client.prenom || client.nom || 'Madame/Monsieur';
  const adresse = client.adresse || 'votre bien';
  const espaceUrl = `${SITE_URL}/espace-client.html`;

  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:620px;margin:0 auto;color:#2A2A2A;line-height:1.7;">
      <div style="text-align:center;padding:32px 0 24px;">
        <img src="${SITE_URL}/logo-scantorenov.webp" alt="Scantorenov" style="width:60px;height:auto;" />
      </div>

      <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.5rem;text-align:center;margin:0 0 28px 0;">
        Prochaine étape : votre scan 3D
      </h2>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Bonjour ${prenom},
      </p>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        Suite à notre échange téléphonique, nous sommes heureux de vous accompagner
        dans votre projet de rénovation de <strong>${adresse}</strong>.
      </p>

      <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
        La prochaine étape consiste à réaliser un <strong>scan 3D Matterport</strong> de votre bien.
        Ce jumeau numérique de haute précision constituera la base de votre avant-projet.
      </p>

      <div style="margin:24px;padding:24px;border:1px solid #E8E8E8;background:#FBFAF7;border-radius:8px;">
        <p style="margin:0 0 8px 0;font-size:0.9rem;color:#2D5F3E;font-weight:600;">Prise de rendez-vous scan</p>
        <p style="margin:0;font-size:0.9rem;color:#5A5A5A;">${scanDuration}</p>
        <p style="margin:8px 0 0 0;font-size:0.9rem;color:#5A5A5A;">
          La prestation de scan est facturée <strong>180 € TTC</strong>,
          à régler en ligne lors de la validation de votre créneau.
        </p>
      </div>

      <div style="text-align:center;margin:32px 24px;">
        <a href="${espaceUrl}"
           style="display:inline-block;background:#2D5F3E;color:#fff;text-decoration:none;padding:14px 32px;border-radius:4px;font-size:0.9rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">
          Accéder à mon espace →
        </a>
      </div>

      <p style="font-size:0.85rem;color:#9A9A9A;text-align:center;padding:0 24px;">
        Besoin d'aide ? Contactez-nous à
        <a href="mailto:avant-projet@scantorenov.com" style="color:#2D5F3E;">avant-projet@scantorenov.com</a>
      </p>

      <div style="text-align:center;padding:24px 0;border-top:1px solid #E8E8E8;margin-top:32px;">
        <p style="font-size:0.78rem;color:#9A9A9A;margin:0;">
          Scantorenov · <a href="${SITE_URL}" style="color:#9A9A9A;">scantorenov.com</a>
        </p>
      </div>
    </div>
  `;

  const result = await resend.emails.send({
    from: 'ScantoRenov <avant-projet@scantorenov.com>',
    to: [client.email],
    subject: `${prenom}, réservez votre scan 3D - ScantoRenov`,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  console.log(`Invitation scan envoyée à ${client.email}`, result.data?.id);
  return result;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret, x-admin-session',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!authorizeAdminRequest(event).authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  try {
    const { clientId, email } = body;

    if (!clientId && !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'clientId ou email requis' }),
      };
    }

    let query = supabase.from('clients').select('*');
    query = clientId ? query.eq('id', clientId) : query.eq('email', email);

    const { data: client, error: clientError } = await query.single();

    if (clientError || !client) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Client introuvable' }),
      };
    }

    if (client.status !== 'call_done') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Statut invalide : ${client.status} (attendu: call_done)` }),
      };
    }

    const { data: phoneNote } = await supabase
      .from('project_notes')
      .select('confirmed_surface, internal_notes')
      .eq('client_id', client.id)
      .eq('type', 'phone_summary')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const scanDuration = getScanDurationLabel(phoneNote);

    await sendInvitationEmail(client, scanDuration);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Email d'invitation envoyé à ${client.email}`,
      }),
    };
  } catch (err) {
    console.error('invite-scan error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
