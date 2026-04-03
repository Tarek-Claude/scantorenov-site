/**
 * Scantorenov - Transmission de l'avant-projet
 *
 * Quand le client clique "Transmettre mon avant-projet" :
 *   1. Envoie un email recapitulatif au client
 *   2. Envoie un email avec la synthese complete a Scantorenov
 *   3. Met a jour le pipeline client sur le statut canonique final
 */

const { upsertClientPipeline } = require('./_client-pipeline');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function buildClientEmail(data) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f7fa;margin:0;padding:32px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#2D5F3E;padding:32px 40px;">
    <div style="font-size:22px;font-weight:700;color:#fff;">SCANTORENOV</div>
  </div>

  <div style="padding:36px 40px;">
    <h1 style="font-size:20px;color:#2D5F3E;margin:0 0 20px;">Votre avant-projet a bien ete transmis</h1>

    <p style="font-size:14px;color:#333;line-height:1.7;">Bonjour ${data.clientName},</p>
    <p style="font-size:14px;color:#333;line-height:1.7;">
      Nous avons bien recu la transmission de votre avant-projet de renovation.
      Nos equipes vont l'analyser avec attention et un chef de projet dedie
      vous sera attribue dans les plus brefs delais.
    </p>

    <div style="background:#f5f8fc;border-left:3px solid #2D5F3E;padding:16px 20px;margin:24px 0;">
      <div style="font-size:12px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
        Recapitulatif
      </div>
      <table style="font-size:13px;color:#333;line-height:1.8;border-collapse:collapse;">
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Bien</td><td>${data.adresse}</td></tr>
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Type</td><td>${data.typeBien}</td></tr>
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Simulations</td><td>${data.nbSimulations} visuel(s) generes</td></tr>
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Echanges</td><td>${data.nbEchanges} messages avec Marcel</td></tr>
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Date</td><td>${data.date}</td></tr>
      </table>
    </div>

    <h2 style="font-size:15px;color:#2D5F3E;margin:28px 0 12px;">Prochaines etapes</h2>
    <ol style="font-size:13px;color:#444;line-height:2;padding-left:20px;">
      <li><strong>Attribution</strong> d'un chef de projet dedie</li>
      <li><strong>Specifications et budget</strong> - elaboration du devis detaille</li>
      <li><strong>Financement</strong> - identification des aides disponibles</li>
      <li><strong>Planification</strong> - phasage et delais previsionnels</li>
      <li><strong>Consultation d'entreprises</strong> et choix final</li>
    </ol>

    <p style="font-size:14px;color:#333;line-height:1.7;margin-top:24px;">
      Votre espace client reste accessible a tout moment pour consulter
      vos simulations et echanger avec Marcel.
    </p>

    <p style="font-size:14px;color:#333;line-height:1.7;">
      Bien a vous,<br>
      <strong>Tarek BECHAR</strong><br>
      <span style="color:#888;font-size:13px;">President fondateur - Scantorenov</span>
    </p>
  </div>

  <div style="background:#f5f7fa;padding:20px 40px;text-align:center;font-size:11px;color:#999;">
    Scantorenov - scantorenov.com - contact@scantorenov.com
  </div>
</div>
</body>
</html>`;
}

function buildAdminEmail(data) {
  let conversationSummary = '';
  if (Array.isArray(data.conversation) && data.conversation.length > 0) {
    conversationSummary = data.conversation
      .map((message) => `
        <div style="margin-bottom:8px;padding:8px 12px;background:${message.role === 'user' ? '#e8f4fd' : '#f0f0f0'};border-radius:6px;font-size:12px;">
          <strong style="color:${message.role === 'user' ? '#0066cc' : '#666'};">${message.role === 'user' ? data.clientName : 'Marcel'} :</strong><br>
          ${String(message.content || '').substring(0, 300)}${String(message.content || '').length > 300 ? '...' : ''}
        </div>
      `)
      .join('');
  }

  let visuelsHtml = '';
  if (Array.isArray(data.visuels) && data.visuels.length > 0) {
    visuelsHtml = data.visuels
      .map((visuel, index) => `
        <div style="display:inline-block;margin:4px;">
          <img src="${visuel.src}" alt="Visuel ${index + 1}" style="width:200px;height:140px;object-fit:cover;border:1px solid #ddd;"/>
          <br>
          <span style="font-size:11px;color:#666;">${visuel.caption || ''}</span>
        </div>
      `)
      .join('');
  }

  let programmeHtml = '<em style="color:#999;">Aucun programme detaille extrait.</em>';
  if (Array.isArray(data.programme) && data.programme.length > 0) {
    programmeHtml = '<ul style="padding-left:18px;margin:0;font-size:13px;line-height:1.8;">'
      + data.programme.map((travaux) => `<li>${travaux}</li>`).join('')
      + '</ul>';
  }

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f7fa;margin:0;padding:32px;">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#2D5F3E;padding:24px 40px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:20px;font-weight:700;color:#fff;">SCANTORENOV</div>
    <div style="color:#d9e6dd;font-size:12px;font-weight:600;letter-spacing:0.1em;">AVANT-PROJET TRANSMIS</div>
  </div>

  <div style="padding:32px 40px;">
    <h1 style="font-size:18px;color:#2D5F3E;margin:0 0 4px;">Nouvel avant-projet recu</h1>
    <p style="font-size:13px;color:#888;margin:0 0 24px;">Transmis le ${data.date}</p>

    <div style="background:#f5f8fc;padding:20px;margin-bottom:24px;border:1px solid #e0e8f0;">
      <div style="font-size:11px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:12px;">
        Identification client
      </div>
      <table style="font-size:13px;color:#333;line-height:1.8;border-collapse:collapse;width:100%;">
        <tr><td style="font-weight:600;width:140px;">Client</td><td>${data.clientName}</td></tr>
        <tr><td style="font-weight:600;">Email</td><td><a href="mailto:${data.clientEmail}">${data.clientEmail}</a></td></tr>
        <tr><td style="font-weight:600;">Adresse du bien</td><td>${data.adresse}</td></tr>
        <tr><td style="font-weight:600;">Type de bien</td><td>${data.typeBien}</td></tr>
      </table>
    </div>

    <div style="font-size:11px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">
      Demande initiale
    </div>
    <div style="background:#fefcf5;border-left:3px solid #e8a84a;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#333;line-height:1.7;font-style:italic;">
      "${data.demande}"
    </div>

    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:#f5f8fc;padding:16px;text-align:center;border:1px solid #e0e8f0;">
        <div style="font-size:24px;font-weight:700;color:#2D5F3E;">${data.nbSimulations}</div>
        <div style="font-size:11px;color:#666;">Visuels generes</div>
      </div>
      <div style="flex:1;background:#f5f8fc;padding:16px;text-align:center;border:1px solid #e0e8f0;">
        <div style="font-size:24px;font-weight:700;color:#2D5F3E;">${data.nbEchanges}</div>
        <div style="font-size:11px;color:#666;">Echanges Marcel</div>
      </div>
    </div>

    <div style="font-size:11px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">
      Programme de travaux envisage
    </div>
    <div style="margin-bottom:24px;">${programmeHtml}</div>

    ${visuelsHtml ? `
      <div style="font-size:11px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">
        Visuels selectionnes (${data.visuels.length})
      </div>
      <div style="margin-bottom:24px;">${visuelsHtml}</div>
    ` : ''}

    ${conversationSummary ? `
      <div style="font-size:11px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">
        Historique des echanges avec Marcel (${data.conversation.length} messages)
      </div>
      <div style="max-height:600px;overflow-y:auto;margin-bottom:24px;">${conversationSummary}</div>
    ` : ''}
  </div>

  <div style="background:#2D5F3E;padding:16px 40px;text-align:center;font-size:11px;color:#d9e6dd;">
    Notification automatique - Espace client Scantorenov
  </div>
</div>
</body>
</html>`;
}

async function sendEmail(to, subject, htmlContent) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log('[EMAIL] RESEND_API_KEY non configuree - email simule vers:', to);
    console.log('[EMAIL] Sujet:', subject);
    return { success: true, simulated: true };
  }

  const fromAddress = process.env.EMAIL_FROM || 'Scantorenov <noreply@scantorenov.com>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject,
      html: htmlContent,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend error ${response.status}: ${err}`);
  }

  return response.json();
}

exports.handler = async function handler(event) {
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

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Corps invalide' }),
    };
  }

  const {
    clientName,
    clientEmail,
    adresse,
    typeBien,
    demande,
    nbSimulations,
    nbEchanges,
    programme,
    visuels,
    conversation,
  } = body;

  if (!clientEmail) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Email client manquant' }),
    };
  }

  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const heure = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const data = {
    clientName: clientName || 'Client',
    clientEmail,
    adresse: adresse || 'Non renseignee',
    typeBien: typeBien || 'Non renseigne',
    demande: demande || 'Aucune description.',
    nbSimulations: nbSimulations || 0,
    nbEchanges: nbEchanges || 0,
    programme: Array.isArray(programme) ? programme : [],
    visuels: Array.isArray(visuels) ? visuels : [],
    conversation: Array.isArray(conversation) ? conversation : [],
    date: `${date} a ${heure}`,
  };

  const adminEmail = process.env.ADMIN_EMAIL || 'avant-projet@scantorenov.com';

  try {
    const clientResult = await sendEmail(
      clientEmail,
      "Scantorenov - Votre avant-projet a bien ete transmis",
      buildClientEmail(data)
    );
    console.log('[TRANSMISSION] Email client envoye:', clientResult);

    const adminResult = await sendEmail(
      adminEmail,
      `[Avant-projet] ${data.clientName} - ${data.typeBien} - ${data.adresse}`,
      buildAdminEmail(data)
    );
    console.log('[TRANSMISSION] Email admin envoye:', adminResult);

    const pipelineResult = await upsertClientPipeline({
      email: clientEmail,
      status: 'avant_projet_transmitted',
      strict: true,
    });
    console.log('[TRANSMISSION] Pipeline client mis a jour:', pipelineResult.status);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Avant-projet transmis avec succes.',
        clientEmailSent: !clientResult.simulated,
        adminEmailSent: !adminResult.simulated,
        pipelineStatus: pipelineResult.status || 'avant_projet_transmitted',
        date: data.date,
      }),
    };
  } catch (error) {
    console.error('[TRANSMISSION] Erreur:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erreur lors de la transmission. Reessayez dans un instant.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
