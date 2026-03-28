const { resolveIdentityClient } = require('./_identity-client');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

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

  try {
    const resolution = await resolveIdentityClient({
      context,
      createIfMissing: true
    });
    const client = resolution.client;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...client,
        clientId: client.id,
        nom: client.nom || client.prenom || resolution.normalizedEmail,
        status: client.status || 'account_created',
      }),
    };
  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    console.error('resolve-client error:', error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: error && error.message ? error.message : 'Erreur serveur' }),
    };
  }
};
