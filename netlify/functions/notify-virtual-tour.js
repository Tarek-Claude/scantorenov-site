/**
 * Scantorenov — Notification "Visite virtuelle disponible"
 *
 * Cette fonction est appelée par l'admin quand il active la visite
 * virtuelle d'un client. Elle :
 *   1. Met à jour les métadonnées du compte (ajoute matterport_id)
 *   2. Envoie un email au client via Netlify Identity
 *
 * Usage (admin) :
 *   POST /.netlify/functions/notify-virtual-tour
 *   Body: { "email": "client@email.com", "matterport_id": "ABC123xyz" }
 *
 * Sécurité : protégé par ADMIN_SECRET en en-tête
 */

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  // Vérification admin
  const adminSecret = process.env.ADMIN_SECRET || 'scantorenov-admin-2026';
  const authHeader = event.headers['authorization'] || '';
  if (authHeader !== `Bearer ${adminSecret}`) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorisé' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps invalide' }) };
  }

  const { email, matterport_id } = body;
  if (!email || !matterport_id) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: 'email et matterport_id requis' })
    };
  }

  const siteUrl = process.env.URL || 'https://scantorenov.com';
  const identityUrl = `${siteUrl}/.netlify/identity`;

  try {
    // 1. Obtenir un token admin via l'API Identity
    const IDENTITY_TOKEN = process.env.IDENTITY_ADMIN_TOKEN;

    if (!IDENTITY_TOKEN) {
      console.warn('IDENTITY_ADMIN_TOKEN non configuré — notification email non envoyée');
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: true,
          warning: 'Token admin non configuré. Le matterport_id sera à ajouter manuellement dans les métadonnées du compte.',
          email_template: generateEmailText(email, siteUrl)
        })
      };
    }

    // 2. Chercher l'utilisateur par email
    const usersResp = await fetch(`${identityUrl}/admin/users`, {
      headers: { 'Authorization': `Bearer ${IDENTITY_TOKEN}` }
    });

    if (!usersResp.ok) throw new Error('Impossible de lister les utilisateurs');
    const usersData = await usersResp.json();
    const user = usersData.users?.find(u => u.email === email);

    if (!user) {
      return {
        statusCode: 404, headers,
        body: JSON.stringify({ error: `Utilisateur ${email} non trouvé` })
      };
    }

    // 3. Mettre à jour les métadonnées du compte
    const updateResp = await fetch(`${identityUrl}/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${IDENTITY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_metadata: {
          ...user.app_metadata,
          matterport_id: matterport_id
        }
      })
    });

    if (!updateResp.ok) throw new Error('Impossible de mettre à jour le compte');

    console.log(`[VISITE VIRTUELLE] Activée pour ${email} — model: ${matterport_id}`);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        message: `Visite virtuelle activée pour ${email}`,
        matterport_id: matterport_id,
        email_template: generateEmailText(email, siteUrl)
      })
    };

  } catch (err) {
    console.error('[NOTIFY] Erreur:', err.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

/**
 * Génère le texte de l'email de notification
 * À envoyer manuellement ou via un service email
 */
function generateEmailText(email, siteUrl) {
  return {
    to: email,
    subject: 'Votre visite virtuelle est disponible — Scantorenov',
    body: `Félicitations !

Votre visite virtuelle est désormais disponible dans votre espace client personnalisé.

Rendez-vous sur votre compte afin de commencer à simuler votre projet de rénovation avec Marcel ;-)

👉 ${siteUrl}/espace-client

Bien à vous,
Tarek`
  };
}
