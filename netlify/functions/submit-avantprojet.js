/**
 * Scantorenov — Transmission de l'avant-projet
 *
 * Quand le client clique "Transmettre mon avant-projet" :
 *   1. Envoie un email récapitulatif au CLIENT (confirmation)
 *   2. Envoie un email avec la synthèse complète à SCANTORENOV
 *   3. Retourne un statut de confirmation
 *
 * Service email : Resend (gratuit jusqu'à 100 emails/jour)
 *   → Clé API à configurer : RESEND_API_KEY
 *   → Domaine expéditeur : noreply@scantorenov.com (après vérification domaine Resend)
 *     Fallback : onboarding@resend.dev (avant vérification)
 */

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

// ── Templates emails HTML ──

function buildClientEmail(data) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f7fa;margin:0;padding:32px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#2D5F3E;padding:32px 40px;">
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:700;color:#fff;">
      SCANTO<span style="color:#2D5F3E;">RENOV</span>
    </div>
  </div>

  <!-- Corps -->
  <div style="padding:36px 40px;">
    <h1 style="font-size:20px;color:#2D5F3E;margin:0 0 20px;">
      Votre avant-projet a bien été transmis
    </h1>

    <p style="font-size:14px;color:#333;line-height:1.7;">
      Bonjour ${data.clientName},
    </p>
    <p style="font-size:14px;color:#333;line-height:1.7;">
      Nous avons bien reçu la transmission de votre avant-projet de rénovation.
      Nos équipes vont l'analyser avec attention et un chef de projet dédié
      vous sera attribué dans les plus brefs délais.
    </p>

    <div style="background:#f5f8fc;border-left:3px solid #2D5F3E;padding:16px 20px;margin:24px 0;">
      <div style="font-size:12px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
        Récapitulatif
      </div>
      <table style="font-size:13px;color:#333;line-height:1.8;border-collapse:collapse;">
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Bien</td><td>${data.adresse}</td></tr>
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Type</td><td>${data.typeBien}</td></tr>
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Simulations</td><td>${data.nbSimulations} visuel(s) générés</td></tr>
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Échanges</td><td>${data.nbEchanges} messages avec Marcel</td></tr>
        <tr><td style="font-weight:600;padding-right:16px;vertical-align:top;">Date</td><td>${data.date}</td></tr>
      </table>
    </div>

    <h2 style="font-size:15px;color:#2D5F3E;margin:28px 0 12px;">Prochaines étapes</h2>
    <ol style="font-size:13px;color:#444;line-height:2;padding-left:20px;">
      <li><strong>Attribution</strong> d'un chef de projet dédié</li>
      <li><strong>Spécifications et budget</strong> — élaboration du devis détaillé</li>
      <li><strong>Financement</strong> — identification des aides (MaPrimeRénov', CEE, éco-PTZ…)</li>
      <li><strong>Planification</strong> — phasage et délais prévisionnels</li>
      <li><strong>Consultation d'entreprises</strong> et choix final</li>
    </ol>

    <p style="font-size:14px;color:#333;line-height:1.7;margin-top:24px;">
      Votre espace client reste accessible à tout moment pour consulter
      vos simulations et échanger avec Marcel.
    </p>

    <p style="font-size:14px;color:#333;line-height:1.7;">
      Bien à vous,<br>
      <strong>Tarek BECHAR</strong><br>
      <span style="color:#888;font-size:13px;">Président fondateur — Scantorenov</span>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f5f7fa;padding:20px 40px;text-align:center;font-size:11px;color:#999;">
    Scantorenov · scantorenov.com · contact@scantorenov.com
  </div>
</div>
</body>
</html>`;
}

function buildAdminEmail(data) {
  // Construire le résumé de conversation
  let conversationSummary = '';
  if (data.conversation && data.conversation.length > 0) {
    conversationSummary = data.conversation
      .map(m => `<div style="margin-bottom:8px;padding:8px 12px;background:${m.role === 'user' ? '#e8f4fd' : '#f0f0f0'};border-radius:6px;font-size:12px;">
        <strong style="color:${m.role === 'user' ? '#0066cc' : '#666'};">${m.role === 'user' ? data.clientName : 'Marcel'} :</strong><br>
        ${m.content.substring(0, 300)}${m.content.length > 300 ? '…' : ''}
      </div>`)
      .join('');
  }

  // Construire la liste des visuels
  let visuelsHtml = '';
  if (data.visuels && data.visuels.length > 0) {
    visuelsHtml = data.visuels
      .map((v, i) => `<div style="display:inline-block;margin:4px;"><img src="${v.src}" alt="Visuel ${i+1}" style="width:200px;height:140px;object-fit:cover;border:1px solid #ddd;"/><br><span style="font-size:11px;color:#666;">${v.caption}</span></div>`)
      .join('');
  }

  // Programme de travaux
  let programmeHtml = '<em style="color:#999;">Aucun programme détaillé extrait.</em>';
  if (data.programme && data.programme.length > 0) {
    programmeHtml = '<ul style="padding-left:18px;margin:0;font-size:13px;line-height:1.8;">'
      + data.programme.map(t => `<li>${t}</li>`).join('')
      + '</ul>';
  }

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f7fa;margin:0;padding:32px;">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <div style="background:#2D5F3E;padding:24px 40px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:20px;font-weight:700;color:#fff;">SCANTO<span style="color:#2D5F3E;">RENOV</span></div>
    <div style="color:#2D5F3E;font-size:12px;font-weight:600;letter-spacing:0.1em;">AVANT-PROJET TRANSMIS</div>
  </div>

  <div style="padding:32px 40px;">
    <h1 style="font-size:18px;color:#2D5F3E;margin:0 0 4px;">
      Nouveau avant-projet reçu
    </h1>
    <p style="font-size:13px;color:#888;margin:0 0 24px;">Transmis le ${data.date}</p>

    <!-- IDENTIFICATION -->
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

    <!-- DEMANDE INITIALE -->
    <div style="font-size:11px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">
      Demande initiale
    </div>
    <div style="background:#fefcf5;border-left:3px solid #e8a84a;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#333;line-height:1.7;font-style:italic;">
      « ${data.demande} »
    </div>

    <!-- STATISTIQUES -->
    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:#f5f8fc;padding:16px;text-align:center;border:1px solid #e0e8f0;">
        <div style="font-size:24px;font-weight:700;color:#2D5F3E;">${data.nbSimulations}</div>
        <div style="font-size:11px;color:#666;">Visuels générés</div>
      </div>
      <div style="flex:1;background:#f5f8fc;padding:16px;text-align:center;border:1px solid #e0e8f0;">
        <div style="font-size:24px;font-weight:700;color:#2D5F3E;">${data.nbEchanges}</div>
        <div style="font-size:11px;color:#666;">Échanges Marcel</div>
      </div>
    </div>

    <!-- PROGRAMME DE TRAVAUX -->
    <div style="font-size:11px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">
      Programme de travaux envisagé
    </div>
    <div style="margin-bottom:24px;">
      ${programmeHtml}
    </div>

    <!-- VISUELS -->
    ${visuelsHtml ? `
    <div style="font-size:11px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">
      Visuels sélectionnés (${data.visuels.length})
    </div>
    <div style="margin-bottom:24px;">
      ${visuelsHtml}
    </div>` : ''}

    <!-- CONVERSATION -->
    ${conversationSummary ? `
    <div style="font-size:11px;font-weight:700;color:#2D5F3E;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">
      Historique des échanges avec Marcel (${data.conversation.length} messages)
    </div>
    <div style="max-height:600px;overflow-y:auto;margin-bottom:24px;">
      ${conversationSummary}
    </div>` : ''}

  </div>

  <div style="background:#2D5F3E;padding:16px 40px;text-align:center;font-size:11px;color:#8A8A8A;">
    Notification automatique · Espace client Scantorenov
  </div>
</div>
</body>
</html>`;
}

// ── Envoi via Resend ──
async function sendEmail(to, subject, htmlContent) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log('[EMAIL] RESEND_API_KEY non configurée — email simulé vers:', to);
    console.log('[EMAIL] Sujet:', subject);
    return { success: true, simulated: true };
  }

  const fromAddress = process.env.EMAIL_FROM || 'Scantorenov <noreply@scantorenov.com>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject: subject,
      html: htmlContent
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend error ${response.status}: ${err}`);
  }

  return await response.json();
}

// ── Handler principal ──
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps invalide' }) };
  }

  const {
    clientName, clientEmail, adresse, typeBien, demande,
    nbSimulations, nbEchanges, programme, visuels, conversation
  } = body;

  if (!clientEmail) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email client manquant' }) };
  }

  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const heure = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const data = {
    clientName: clientName || 'Client',
    clientEmail,
    adresse: adresse || 'Non renseignée',
    typeBien: typeBien || 'Non renseigné',
    demande: demande || 'Aucune description.',
    nbSimulations: nbSimulations || 0,
    nbEchanges: nbEchanges || 0,
    programme: programme || [],
    visuels: visuels || [],
    conversation: conversation || [],
    date: `${date} à ${heure}`
  };

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'avant-projet@scantorenov.com';

  try {
    // 1. Email au client (confirmation)
    const clientResult = await sendEmail(
      clientEmail,
      'Scantorenov — Votre avant-projet a bien été transmis',
      buildClientEmail(data)
    );
    console.log('[TRANSMISSION] Email client envoyé:', clientResult);

    // 2. Email à l'admin (synthèse complète)
    const adminResult = await sendEmail(
      ADMIN_EMAIL,
      `[Avant-projet] ${data.clientName} — ${data.typeBien} — ${data.adresse}`,
      buildAdminEmail(data)
    );
    console.log('[TRANSMISSION] Email admin envoyé:', adminResult);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        message: 'Avant-projet transmis avec succès.',
        clientEmailSent: !clientResult.simulated,
        adminEmailSent: !adminResult.simulated,
        date: data.date
      })
    };

  } catch (err) {
    console.error('[TRANSMISSION] Erreur:', err.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({
        error: "Erreur lors de la transmission. Réessayez dans un instant.",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      })
    };
  }
};
