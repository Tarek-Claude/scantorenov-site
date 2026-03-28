const { createClient } = require('@supabase/supabase-js');

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

exports.handler = async (event, context) => {
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

  const identityUser = context && context.clientContext ? context.clientContext.user : null;
  if (!identityUser) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const email = identityUser.email;
  if (!email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Email manquant' }),
    };
  }

  try {
    const { data: existing, error: selectError } = await supabase
      .from('clients')
      .select('id, nom, prenom, status, phase')
      .eq('email', email)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          clientId: existing.id,
          nom: existing.nom || existing.prenom || email,
          status: existing.status || 'account_created',
        }),
      };
    }

    const { data: created, error: insertError } = await supabase
      .from('clients')
      .insert([
        {
          email,
          status: 'account_created',
          nom: email,
        },
      ])
      .select('id, nom, status')
      .single();

    if (insertError) throw insertError;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        clientId: created.id,
        nom: created.nom || email,
        status: created.status || 'account_created',
      }),
    };
  } catch (error) {
    console.error('resolve-client error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error && error.message ? error.message : 'Erreur serveur' }),
    };
  }
};
