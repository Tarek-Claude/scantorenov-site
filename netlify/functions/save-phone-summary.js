const { createClient } = require('@supabase/supabase-js');
const { authorizeAdminRequest } = require('./_admin-session');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-session, x-admin-secret',
  'Content-Type': 'application/json',
};

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNeedsArray(value) {
  return normalizeText(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
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

  if (!authorizeAdminRequest(event).authorized) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Corps invalide' }),
    };
  }

  const clientId = normalizeText(body.clientId);
  const summary = normalizeText(body.summary);
  const needsText = normalizeText(body.needs);
  const confirmedSurface = normalizeText(body.confirmedSurface);
  const confirmedBudget = normalizeText(body.confirmedBudget);
  const constraints = normalizeText(body.constraints);
  const vigilance = normalizeText(body.vigilance);
  const nextStep = normalizeText(body.nextStep);

  if (!clientId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'clientId requis' }),
    };
  }

  if (!summary) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Le resume de l echange est requis' }),
    };
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Client introuvable' }),
      };
    }

    const payload = {
      client_id: clientId,
      type: 'phone_summary',
      summary,
      needs: toNeedsArray(needsText),
      confirmed_surface: confirmedSurface || null,
      confirmed_budget: confirmedBudget || null,
      constraints: constraints || null,
      internal_notes: JSON.stringify({
        summary,
        needs: toNeedsArray(needsText),
        confirmedSurface,
        confirmedBudget,
        constraints,
        vigilance,
        nextStep,
        source: 'admin_phone_summary_form',
        savedAt: new Date().toISOString(),
      }),
      created_by: 'admin_cockpit',
    };

    const { data: existingNote, error: existingNoteError } = await supabase
      .from('project_notes')
      .select('id')
      .eq('client_id', clientId)
      .eq('type', 'phone_summary')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingNoteError && existingNoteError.code !== '42P01' && existingNoteError.code !== 'PGRST205') {
      throw new Error(`Lecture note telephone: ${existingNoteError.message}`);
    }

    let result;
    if (existingNote && existingNote.id) {
      result = await supabase
        .from('project_notes')
        .update(payload)
        .eq('id', existingNote.id)
        .select('id,type,summary,needs,confirmed_budget,confirmed_surface,constraints,internal_notes,created_at')
        .single();
    } else {
      result = await supabase
        .from('project_notes')
        .insert(payload)
        .select('id,type,summary,needs,confirmed_budget,confirmed_surface,constraints,internal_notes,created_at')
        .single();
    }

    if (result.error || !result.data) {
      throw new Error(result.error ? result.error.message : 'Sauvegarde impossible');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        note: result.data,
      }),
    };
  } catch (error) {
    console.error('[save-phone-summary] error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Erreur serveur' }),
    };
  }
};
