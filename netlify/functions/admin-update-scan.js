/**
 * Scantorenov — Mise à jour des fichiers d'un scan client
 *
 * Sauvegarde photos_urls et plans_urls dans la table scans
 * (ces colonnes ont été migrées de clients vers scans en v3).
 *
 * POST /.netlify/functions/admin-update-scan
 * Headers: Authorization: Bearer <session_token>
 * Body: {
 *   clientId: "uuid",
 *   photos_urls: ["https://..."],   // optionnel
 *   plans_urls:  ["https://..."],   // optionnel
 *   matterport_model_id: "...",     // optionnel
 *   matterport_data: {...}          // optionnel
 * }
 */

const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-session, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = authorizeAdminRequest(event);
  if (!auth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps invalide' }) };
  }

  const { clientId, photos_urls, plans_urls, matterport_model_id, matterport_data, mode } = body;
  const replace = mode === 'replace';

  if (!clientId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'clientId requis' }) };
  }

  const supabase = getSupabaseAdmin();

  try {
    // Chercher le scan primaire existant du client
    const { data: existingScan } = await supabase
      .from('scans')
      .select('id, photos_urls, plans_urls')
      .eq('client_id', clientId)
      .eq('is_primary', true)
      .maybeSingle();

    const payload = {
      client_id: clientId,
      is_primary: true,
    };

    // Mode 'replace' : on remplace, sinon on fusionne (sans doublons)
    if (photos_urls !== undefined) {
      if (replace) {
        payload.photos_urls = photos_urls;
      } else {
        const existing = (existingScan && existingScan.photos_urls) || [];
        const merged = [...existing];
        for (const u of photos_urls) if (!merged.includes(u)) merged.push(u);
        payload.photos_urls = merged;
      }
    }
    if (plans_urls !== undefined) {
      if (replace) {
        payload.plans_urls = plans_urls;
      } else {
        const existing = (existingScan && existingScan.plans_urls) || [];
        const merged = [...existing];
        for (const u of plans_urls) if (!merged.includes(u)) merged.push(u);
        payload.plans_urls = merged;
      }
    }
    if (matterport_model_id !== undefined) {
      payload.matterport_model_id = matterport_model_id;
    }
    if (matterport_data !== undefined) {
      payload.matterport_data = matterport_data;
    }

    let result;
    if (existingScan) {
      result = await supabase
        .from('scans')
        .update(payload)
        .eq('id', existingScan.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('scans')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, scan: result.data }),
    };
  } catch (err) {
    console.error('[admin-update-scan] error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
