/**
 * Scantorenov — Mise à jour des fichiers d'un scan client
 *
 * Sauvegarde photos_urls, plans_urls, matterport_* et photos_meta
 * dans la table scans (ces colonnes ont été migrées de clients vers
 * scans en v3).
 *
 * POST /.netlify/functions/admin-update-scan
 * Headers: Authorization: Bearer <session_token>
 * Body: {
 *   clientId: "uuid",
 *   photos_urls: ["https://..."],            // optionnel
 *   plans_urls:  ["https://..."],            // optionnel
 *   matterport_model_id: "...",              // optionnel
 *   matterport_data: {...},                  // optionnel
 *   photos_meta: [                            // optionnel (cf. dashboard-photos-meta-spec.md)
 *     { url, room, view, caption, priority }
 *   ]
 * }
 *
 * Validation photos_meta (HTTP 422 si invalide) :
 *   - url: doit être présente dans photos_urls (nouvelles OU existantes)
 *   - room: enum { salon, cuisine, chambre, sdb, wc, entrée, couloir, bureau, autre }
 *   - view: enum { large, détail, avant, arrière, extérieur }
 *   - caption: string <= 140 caractères
 *   - priority: entier 1..5
 */

const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');

const PHOTOS_META_ROOM_ENUM = new Set([
  'salon', 'cuisine', 'chambre', 'sdb', 'wc',
  'entrée', 'couloir', 'bureau', 'autre'
]);

const PHOTOS_META_VIEW_ENUM = new Set([
  'large', 'détail', 'avant', 'arrière', 'extérieur'
]);

function validatePhotosMeta(photosMeta, allowedUrls) {
  if (photosMeta === undefined || photosMeta === null) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(photosMeta)) {
    return { ok: false, error: 'photos_meta doit être un tableau' };
  }

  const allowed = new Set((allowedUrls || []).filter(Boolean));
  const cleaned = [];

  for (let i = 0; i < photosMeta.length; i += 1) {
    const entry = photosMeta[i];
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: `photos_meta[${i}] invalide` };
    }
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';
    if (!url) {
      return { ok: false, error: `photos_meta[${i}].url requis` };
    }
    if (!allowed.has(url)) {
      return {
        ok: false,
        error: `photos_meta[${i}].url absente de photos_urls (${url})`
      };
    }
    const room = typeof entry.room === 'string' ? entry.room.trim().toLowerCase() : '';
    if (!PHOTOS_META_ROOM_ENUM.has(room)) {
      return { ok: false, error: `photos_meta[${i}].room invalide (${room || 'vide'})` };
    }
    const view = typeof entry.view === 'string' ? entry.view.trim().toLowerCase() : '';
    if (!PHOTOS_META_VIEW_ENUM.has(view)) {
      return { ok: false, error: `photos_meta[${i}].view invalide (${view || 'vide'})` };
    }
    const caption = typeof entry.caption === 'string' ? entry.caption.trim() : '';
    if (caption.length > 140) {
      return { ok: false, error: `photos_meta[${i}].caption > 140 caractères` };
    }
    const priority = Number.parseInt(entry.priority, 10);
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
      return { ok: false, error: `photos_meta[${i}].priority doit être 1..5` };
    }
    cleaned.push({ url, room, view, caption, priority });
  }

  return { ok: true, value: cleaned };
}

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

  const { clientId, photos_urls, plans_urls, matterport_model_id, matterport_data, photos_meta, mode } = body;
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

    // Validation photos_meta : l'URL annotée doit exister dans photos_urls
    // (soit celles passées dans cette requête, soit celles déjà en base).
    if (photos_meta !== undefined) {
      const effectivePhotosUrls = Array.isArray(payload.photos_urls)
        ? payload.photos_urls
        : (existingScan && Array.isArray(existingScan.photos_urls) ? existingScan.photos_urls : []);

      const validation = validatePhotosMeta(photos_meta, effectivePhotosUrls);
      if (!validation.ok) {
        return {
          statusCode: 422,
          headers,
          body: JSON.stringify({ error: validation.error, code: 'photos_meta_invalid' }),
        };
      }
      payload.photos_meta = validation.value;
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
      // Colonne photos_meta absente : la migration n'est pas appliquée sur
      // l'env courant. On renvoie un message explicite plutôt qu'un 500.
      const code = result.error.code;
      const msg = result.error.message || '';
      const isMissingColumn = code === '42703' || code === 'PGRST204'
        || /column .* does not exist/i.test(msg)
        || /could not find the .* column/i.test(msg);
      if (isMissingColumn && payload.photos_meta !== undefined) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            error: 'photos_meta non disponible : migration Supabase à appliquer',
            code: 'photos_meta_missing_column',
          }),
        };
      }
      throw new Error(result.error.message);
    }

    if (Array.isArray(payload.photos_meta)) {
      const chef = (auth && auth.login) || auth.mode || 'admin';
      console.log(`[photos-meta] updated by ${chef} client=${clientId} count=${payload.photos_meta.length}`);
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
