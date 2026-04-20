/**
 * Helper de persistance des visuels IA generes par Marcel.
 *
 * Flux : on recoit une URL ephemere (Together AI ~24h) et on la materialise
 * dans Supabase Storage (bucket "plans" sous-dossier "simulations/") +
 * on enregistre la metadata dans clients.simulations (colonne JSONB).
 *
 * Degradation gracieuse : si Supabase n'est pas configure ou si l'insertion
 * echoue, on retourne l'URL ephemere d'origine (meilleur qu'un echec total).
 */

const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SIMULATIONS_BUCKET = process.env.SIMULATIONS_BUCKET || 'plans';
const SIMULATIONS_PREFIX = 'simulations';
const DOWNLOAD_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 20000;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function guessExtension(contentType, fallbackUrl) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('avif')) return 'avif';
  // Fallback : inspecter l'URL
  const m = String(fallbackUrl || '').match(/\.(jpe?g|png|webp|avif)(\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function downloadImage(imageUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`download ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') || 'image/jpeg',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadToStorage({ supabaseUrl, supabaseKey, clientId, buffer, contentType, extension }) {
  const id = randomUUID();
  const storagePath = `${SIMULATIONS_PREFIX}/${clientId}/${id}.${extension}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${SIMULATIONS_BUCKET}/${storagePath}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: buffer,
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`upload ${response.status}: ${text}`);
    }
    return `${supabaseUrl}/storage/v1/object/public/${SIMULATIONS_BUCKET}/${storagePath}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function appendSimulationToClient(supabase, clientId, entry) {
  // Lecture -> concat -> update (simple et atomique pour 1 seul rendu a la fois)
  const { data, error: readError } = await supabase
    .from('clients')
    .select('simulations')
    .eq('id', clientId)
    .single();

  if (readError) {
    // Colonne simulations potentiellement absente (migration non appliquee)
    // On log et on sort silencieusement.
    console.warn('[simulations-storage] lecture clients.simulations:', readError.message);
    return false;
  }

  const current = Array.isArray(data && data.simulations) ? data.simulations : [];
  const next = current.concat([entry]);

  const { error: writeError } = await supabase
    .from('clients')
    .update({ simulations: next })
    .eq('id', clientId);

  if (writeError) {
    console.warn('[simulations-storage] ecriture clients.simulations:', writeError.message);
    return false;
  }

  return true;
}

/**
 * Transforme une URL ephemere en URL permanente + insere la metadata.
 * Retourne { url, persisted } ; url est permanente si persisted=true,
 * sinon l'URL d'origine (ephemere).
 */
async function persistSimulation({ clientId, ephemeralUrl, description, prompt, provider }) {
  if (!clientId || !ephemeralUrl) {
    return { url: ephemeralUrl, persisted: false, reason: 'missing_input' };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { url: ephemeralUrl, persisted: false, reason: 'no_supabase' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  try {
    const { buffer, contentType } = await downloadImage(ephemeralUrl);
    const extension = guessExtension(contentType, ephemeralUrl);
    const permanentUrl = await uploadToStorage({
      supabaseUrl,
      supabaseKey,
      clientId,
      buffer,
      contentType,
      extension,
    });

    const entry = {
      url: permanentUrl,
      description: description || '',
      prompt: prompt || '',
      provider: provider || 'unknown',
      created_at: new Date().toISOString(),
    };

    const ok = await appendSimulationToClient(supabase, clientId, entry);
    return { url: permanentUrl, persisted: ok, entry };
  } catch (err) {
    console.warn('[simulations-storage] persist fail:', err && err.message);
    return { url: ephemeralUrl, persisted: false, reason: err && err.message };
  }
}

module.exports = {
  persistSimulation,
  SIMULATIONS_BUCKET,
  SIMULATIONS_PREFIX,
};
