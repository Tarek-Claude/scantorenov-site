/**
 * Scantorenov — Notification d'inscription
 *
 * Netlify appelle automatiquement cette fonction quand un utilisateur
 * s'inscrit via Identity. Le nom "identity-signup" est une convention Netlify.
 *
 * Ce hook peut :
 *   1. Notifier l'admin (scantorenov@gmail.com) par email
 *   2. Valider/refuser l'inscription
 *   3. Ajouter des rôles au compte
 *
 * Retourner { statusCode: 200 } = inscription acceptée
 * Retourner { statusCode: 403 } = inscription refusée
 */

exports.handler = async function(event) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  const user = body.user;
  if (!user) {
    return { statusCode: 200, body: 'No user data' };
  }

  const email = user.email || 'inconnu';
  const meta = user.user_metadata || {};
  const fullName = meta.full_name || 'Non renseigné';
  const createdAt = user.created_at || new Date().toISOString();

  console.log(`[INSCRIPTION] Nouveau compte créé :
    Nom    : ${fullName}
    Email  : ${email}
    Date   : ${createdAt}
  `);

  // ── Notification email vers l'admin ──
  // Utilise le service gratuit de notification par email via fetch
  // Option 1 : Netlify Forms (gratuit, intégré)
  // Option 2 : Email API externe (Resend, SendGrid, etc.)

  // Pour l'instant : notification via Netlify Forms (submission API)
  // L'admin recevra un email via les notifications de formulaire Netlify
  try {
    const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'scantorenov@gmail.com';

    // Envoyer une notification via un fetch interne
    // qui crée une soumission de formulaire Netlify
    const siteUrl = process.env.URL || 'https://scantorenov.com';

    await fetch(`${siteUrl}/.netlify/functions/notify-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_signup',
        name: fullName,
        email: email,
        date: createdAt
      })
    }).catch(function() {
      // Si notify-admin n'existe pas encore, on log seulement
      console.log('[NOTIFICATION] Fonction notify-admin non disponible — log seulement.');
    });

  } catch (err) {
    console.error('[NOTIFICATION] Erreur:', err.message);
    // On ne bloque pas l'inscription même si la notification échoue
  }

  // Accepter l'inscription et assigner le rôle "client"
  return {
    statusCode: 200,
    body: JSON.stringify({
      app_metadata: {
        roles: ['client']
      }
    })
  };
};
