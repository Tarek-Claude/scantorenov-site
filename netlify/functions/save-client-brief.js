const { createClient } = require('@supabase/supabase-js');
const { resolveIdentityClient } = require('./_identity-client');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSummary(brief) {
  return [
    `Contexte : ${brief.contexte}`,
    `Vision : ${brief.vision}`,
    `Contraintes : ${brief.contraintes}`,
    `Priorite : ${brief.priorite}`
  ].join('\n');
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Corps invalide' })
    };
  }

  const brief = {
    contexte: normalizeText(body.contexte),
    vision: normalizeText(body.vision),
    contraintes: normalizeText(body.contraintes),
    priorite: normalizeText(body.priorite)
  };

  if (!brief.contexte || !brief.vision || !brief.contraintes || !brief.priorite) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Les 4 champs du brief sont requis' })
    };
  }

  try {
    const resolution = await resolveIdentityClient({
      context,
      createIfMissing: true
    });

    const client = resolution.client;
    const internalNotes = JSON.stringify({
      ...brief,
      source: 'client_brief',
      savedAt: new Date().toISOString()
    });
    const payload = {
      client_id: client.id,
      type: 'client_brief',
      summary: buildSummary(brief),
      constraints: brief.contraintes,
      internal_notes: internalNotes,
      created_by: 'client_portal'
    };

    const { data: existingNote, error: existingNoteError } = await supabase
      .from('project_notes')
      .select('id')
      .eq('client_id', client.id)
      .eq('type', 'client_brief')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingNoteError && existingNoteError.code !== '42P01' && existingNoteError.code !== 'PGRST205') {
      throw new Error(`Lecture note brief: ${existingNoteError.message}`);
    }

    let note;
    let writeError;

    if (existingNote && existingNote.id) {
      const result = await supabase
        .from('project_notes')
        .update(payload)
        .eq('id', existingNote.id)
        .select('id,type,summary,constraints,internal_notes,created_at')
        .single();
      note = result.data;
      writeError = result.error;
    } else {
      const result = await supabase
        .from('project_notes')
        .insert(payload)
        .select('id,type,summary,constraints,internal_notes,created_at')
        .single();
      note = result.data;
      writeError = result.error;
    }

    if (writeError) {
      throw new Error(`Sauvegarde brief: ${writeError.message}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        note
      })
    };
  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    console.error('save-client-brief error:', error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: error && error.message ? error.message : 'Erreur serveur' })
    };
  }
};
