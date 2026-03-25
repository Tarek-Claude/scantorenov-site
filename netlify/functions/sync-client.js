/**
 * Scantorenov - Synchronisation client vers Supabase
 *
 * Recoit les donnees client depuis le script PC et les ecrit dans Supabase.
 * Protege par ADMIN_SECRET.
 *
 * POST /.netlify/functions/sync-client
 * Headers: Authorization: Bearer <ADMIN_SECRET>
 */

const { PIPELINE_STATUSES, upsertClientPipeline } = require('./_client-pipeline');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = event.headers.authorization || '';

  if (!adminSecret) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ADMIN_SECRET non configure' }) };
  }
  if (authHeader !== `Bearer ${adminSecret}`) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorise' }) };
  }

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

  try {
    const clientData = { email };
    const requestedStatus = typeof body.status === 'string' && PIPELINE_STATUSES.includes(body.status)
      ? body.status
      : undefined;
    const fields = [
      'nom', 'adresse', 'type_bien', 'demande', 'surface',
      'echeance', 'budget', 'telephone', 'phase',
      'matterport_model_id', 'matterport_iframe', 'matterport_data',
      'proposal_url', 'moe', 'moe_accepted', 'chantier',
      'phone', 'project_type', 'project_details',
      'call_scheduled_at', 'call_notes',
      'scan_date_proposed', 'scan_date_confirmed', 'scan_confirmed_by_client',
      'matterport_url', 'plans_urls', 'photos_urls',
      'marcel_enabled', 'avant_projet_enabled', 'last_action_required'
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        clientData[field] = body[field];
      }
    }

    if (clientData.phone !== undefined && clientData.telephone === undefined) {
      clientData.telephone = clientData.phone;
    }
    if (clientData.telephone !== undefined && clientData.phone === undefined) {
      clientData.phone = clientData.telephone;
    }
    if (clientData.project_type !== undefined && clientData.type_bien === undefined) {
      clientData.type_bien = clientData.project_type;
    }
    if (clientData.type_bien !== undefined && clientData.project_type === undefined) {
      clientData.project_type = clientData.type_bien;
    }
    if (clientData.project_details !== undefined && clientData.demande === undefined) {
      clientData.demande = clientData.project_details;
    }
    if (clientData.demande !== undefined && clientData.project_details === undefined) {
      clientData.project_details = clientData.demande;
    }
    if (clientData.matterport_url !== undefined && clientData.matterport_iframe === undefined) {
      clientData.matterport_iframe = clientData.matterport_url;
    }
    if (clientData.matterport_iframe !== undefined && clientData.matterport_url === undefined) {
      clientData.matterport_url = clientData.matterport_iframe;
    }

    const result = await upsertClientPipeline({
      email,
      fields: clientData,
      status: requestedStatus,
      inferStatusFromFields: !requestedStatus,
      strict: true
    });

    console.log(
      `[SYNC] Client ${email} synchronise - phase: ${clientData.phase || 'inchangee'} - status: ${result.status || 'inchange'}`
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        email,
        data: result.data || clientData
      })
    };
  } catch (err) {
    console.error('[SYNC] Erreur:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
