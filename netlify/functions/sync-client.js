/**
 * Scantorenov — Synchronisation client vers Supabase
 *
 * Reçoit les données client depuis le script PC et les écrit dans Supabase.
 * Protégé par ADMIN_SECRET.
 *
 * POST /.netlify/functions/sync-client
 * Headers: Authorization: Bearer <ADMIN_SECRET>
 * Body: {
 *   email: "client@example.com",
 *   nom: "Prénom NOM",
 *   adresse: "...",
 *   type_bien: "...",
 *   demande: "...",
 *   surface: "...",
 *   telephone: "...",
 *   budget: "...",
 *   echeance: "...",
 *   phase: 5,
 *   matterport_model_id: "ABC123",
 *   matterport_iframe: "https://my.matterport.com/show/?m=ABC123",
 *   matterport_data: { ... },
 *   proposal_url: "...",
 *   moe: { ... },
 *   chantier: { ... }
 * }
 */

const { createClient } = require('@supabase/supabase-js');

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

  // --- Authentification ---
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = event.headers.authorization || '';

  if (!adminSecret) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ADMIN_SECRET non configure' }) };
  }
  if (authHeader !== `Bearer ${adminSecret}`) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorise' }) };
  }

  // --- Supabase ---
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'SUPABASE_URL et SUPABASE_SERVICE_KEY requis' })
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

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

  try {
    // Préparer les données (ne garder que les champs définis)
    const clientData = { email };
    const fields = [
      'nom', 'adresse', 'type_bien', 'demande', 'surface',
      'echeance', 'budget', 'telephone', 'phase',
      'matterport_model_id', 'matterport_iframe', 'matterport_data',
      'proposal_url', 'moe', 'moe_accepted', 'chantier'
    ];

    for (const f of fields) {
      if (body[f] !== undefined) clientData[f] = body[f];
    }

    // Upsert : crée si nouveau, met à jour si existant (basé sur email unique)
    const { data, error } = await supabase
      .from('clients')
      .upsert(clientData, { onConflict: 'email' })
      .select();

    if (error) {
      throw new Error(`Supabase erreur: ${error.message}`);
    }

    console.log(`[SYNC] Client ${email} synchronise — phase: ${clientData.phase || 'inchangee'}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        email,
        data: data[0] || clientData
      })
    };

  } catch (err) {
    console.error('[SYNC] Erreur:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
