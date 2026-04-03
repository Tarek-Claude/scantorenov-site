const {
  getConfiguredAdminLogin,
  hasConfiguredAdminCredentials,
  issueAdminSessionToken,
  verifyAdminCredentials,
} = require('./_admin-session');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

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

  if (!hasConfiguredAdminCredentials()) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'ADMIN_LOGIN et ADMIN_PASSWORD ou ADMIN_PASSWORD_SHA256 doivent etre configures',
      }),
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

  const login = String(body.login || '').trim();
  const password = String(body.password || '');

  if (!login || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Identifiant et mot de passe requis' }),
    };
  }

  if (!verifyAdminCredentials(login, password)) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Identifiants invalides' }),
    };
  }

  const token = issueAdminSessionToken(getConfiguredAdminLogin());
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      token,
      login: getConfiguredAdminLogin(),
    }),
  };
};
