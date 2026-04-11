/**
 * Scantorenov - Notification "Visite virtuelle disponible"
 *
 * Cette fonction est appelee par l'admin quand il active la visite
 * virtuelle d'un client. Elle :
 *   1. Met a jour les metadonnees Identity (matterport_id + acces virtuel)
 *   2. Retourne un contenu d'email utilisable si l'envoi automatique n'est pas configure
 *
 * Usage (admin) :
 *   POST /.netlify/functions/notify-virtual-tour
 *   Body: { "email": "client@email.com", "matterport_id": "ABC123xyz" }
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
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps invalide' }) };
  }

  const { email, matterport_id } = body;
  if (!email || !matterport_id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'email et matterport_id requis' })
    };
  }

  const siteUrl = process.env.URL || 'https://scantorenov.com';
  const identityUrl = `${siteUrl}/.netlify/identity`;

  try {
    const identityToken = process.env.IDENTITY_ADMIN_TOKEN;

    if (!identityToken) {
      console.warn('IDENTITY_ADMIN_TOKEN non configure - notification email non envoyee');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          warning: 'Token admin non configure. Le matterport_id sera a ajouter manuellement dans les metadonnees du compte.',
          email_template: generateEmailText(email, siteUrl)
        })
      };
    }

    const usersResp = await fetch(`${identityUrl}/admin/users`, {
      headers: { 'Authorization': `Bearer ${identityToken}` }
    });

    if (!usersResp.ok) throw new Error('Impossible de lister les utilisateurs');
    const usersData = await usersResp.json();
    const user = usersData.users?.find((entry) => entry.email === email);

    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Utilisateur ${email} non trouve` })
      };
    }

    const updateResp = await fetch(`${identityUrl}/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${identityToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_metadata: {
          ...user.app_metadata,
          matterport_id,
          virtual_tour_unlocked: true,
        }
      })
    });

    if (!updateResp.ok) throw new Error('Impossible de mettre a jour le compte');

    console.log(`[VISITE VIRTUELLE] Activee pour ${email} - model: ${matterport_id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Visite virtuelle activee pour ${email}`,
        matterport_id,
        email_template: generateEmailText(email, siteUrl)
      })
    };
  } catch (err) {
    console.error('[NOTIFY] Erreur:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

function generateEmailText(email, siteUrl) {
  return {
    to: email,
    subject: 'Votre visite virtuelle est disponible - Scantorenov',
    body: `Felicitations !

Votre visite virtuelle est desormais disponible dans votre espace client personnalise.

Rendez-vous sur votre compte afin de commencer a simuler votre projet de renovation avec Marcel.

${siteUrl}/espace-client

Bien a vous,
Tarek`
  };
}
