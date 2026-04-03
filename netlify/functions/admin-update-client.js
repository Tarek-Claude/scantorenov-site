/**
 * Scantorenov — Administration des clients
 *
 * Met a jour les metadonnees d'un client (phase, projet, dates...).
 * Protege par ADMIN_SECRET (variable d'environnement).
 *
 * POST /.netlify/functions/admin-update-client
 * Headers: Authorization: Bearer <ADMIN_SECRET>
 * Body: {
 *   email: "client@example.com",
 *   phase: 4,
 *   project: { nom, adresse, type_bien, demande, telephone, budget, echeance },
 *   matterport_id: "ABC123",
 *   scan_date: "2026-04-15",
 *   scan_confirmed: true,
 *   reformulation: "Texte reformule apres entretien",
 *   proposal_url: "https://...",
 *   matterport_data: { ... }
 * }
 */

const { authorizeAdminRequest } = require('./_admin-session');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-session, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // --- Authentification ---
  if (!authorizeAdminRequest(event).authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorise' }) };
  }

  // --- Parse body ---
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps invalide' }) };
  }

  const { email } = body;
  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email requis' }) };
  }

  // --- Obtenir l'URL Identity et le token admin ---
  let identityUrl, adminToken;

  if (context.clientContext && context.clientContext.identity) {
    identityUrl = context.clientContext.identity.url;
    adminToken = context.clientContext.identity.token;
  } else {
    identityUrl = process.env.IDENTITY_URL
      || (process.env.URL ? process.env.URL + '/.netlify/identity' : null);
    adminToken = process.env.IDENTITY_ADMIN_TOKEN;
  }

  if (!identityUrl || !adminToken) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Identity non configuree. Definir IDENTITY_URL et IDENTITY_ADMIN_TOKEN, ou appeler avec un JWT valide.'
      })
    };
  }

  try {
    // 1. Chercher l'utilisateur par email
    const listRes = await fetch(`${identityUrl}/admin/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!listRes.ok) {
      const errText = await listRes.text();
      throw new Error(`Identity API ${listRes.status}: ${errText}`);
    }
    const listData = await listRes.json();
    const users = listData.users || [];
    const user = users.find(u => u.email === email);

    if (!user) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: `Utilisateur ${email} non trouve` }) };
    }

    // 2. Fusionner les metadonnees
    const current = user.app_metadata || {};
    const updated = { ...current };

    if (body.phase !== undefined) updated.phase = body.phase;
    if (body.project !== undefined) updated.project = { ...(current.project || {}), ...body.project };
    if (body.matterport_id !== undefined) updated.matterport_id = body.matterport_id;
    if (body.matterport_data !== undefined) updated.matterport_data = body.matterport_data;
    if (body.scan_date !== undefined) updated.scan_date = body.scan_date;
    if (body.scan_confirmed !== undefined) updated.scan_confirmed = body.scan_confirmed;
    if (body.reformulation !== undefined) updated.reformulation = body.reformulation;
    if (body.proposal_url !== undefined) updated.proposal_url = body.proposal_url;
    if (body.moe !== undefined) updated.moe = { ...(current.moe || {}), ...body.moe };
    if (body.moe_accepted !== undefined) updated.moe_accepted = body.moe_accepted;
    if (body.chantier !== undefined) updated.chantier = { ...(current.chantier || {}), ...body.chantier };

    // 3. Mettre a jour
    const updateRes = await fetch(`${identityUrl}/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ app_metadata: updated })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Mise a jour echouee ${updateRes.status}: ${errText}`);
    }

    const updatedUser = await updateRes.json();

    console.log(`[ADMIN] Client ${email} mis a jour — phase: ${updated.phase}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        email,
        phase: updated.phase,
        app_metadata: updated
      })
    };

  } catch (err) {
    console.error('[ADMIN] Erreur:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
