/**
 * Scantorenov — Upload de fichiers vers Supabase Storage
 *
 * Recoit un fichier en base64 et l'uploade dans le bucket "plans"
 * sous le chemin {email_safe}/{filename}.
 *
 * POST /.netlify/functions/admin-upload-file
 * Headers: Authorization: Bearer <session_token>
 * Body: {
 *   email: "client@example.com",
 *   filename: "photo1.jpg",
 *   contentType: "image/jpeg",
 *   data: "<base64>"
 * }
 */

const { authorizeAdminRequest } = require('./_admin-session');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-session, x-admin-secret',
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

  const auth = authorizeAdminRequest(event);
  if (!auth.authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorise' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps invalide' }) };
  }

  const { email, filename, contentType, data } = body;
  if (!email || !filename || !data) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email, filename et data requis' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase non configure' }) };
  }

  const safeEmail = email.replace('@', '_at_');
  const storagePath = `${safeEmail}/${filename}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/plans/${storagePath}`;

  try {
    const fileBuffer = Buffer.from(data, 'base64');

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: fileBuffer
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Storage upload ${response.status}: ${errText}`);
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/plans/${storagePath}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, url: publicUrl, filename })
    };
  } catch (err) {
    console.error('[admin-upload-file] error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
