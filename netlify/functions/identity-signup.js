const { upsertClientPipeline } = require('./_client-pipeline');

/**
 * Scantorenov — Hook d'inscription Identity
 *
 * Appele automatiquement par Netlify quand un utilisateur s'inscrit.
 * Initialise :
 *   - roles: ['client']
 *   - phase: 3 (premiere visite de l'espace)
 *   - project: donnees du formulaire de contact (si transmises via user_metadata)
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
  const fullName = meta.full_name || 'Non renseigne';
  const createdAt = user.created_at || new Date().toISOString();

  console.log(`[INSCRIPTION] Nouveau compte cree :
    Nom    : ${fullName}
    Email  : ${email}
    Date   : ${createdAt}
  `);

  // Construire les donnees projet a partir des metadonnees de signup
  // Ces donnees sont passees par connexion.html depuis les parametres URL
  const project = {};
  if (meta.full_name) project.nom = meta.full_name;
  if (meta.telephone) project.telephone = meta.telephone;
  if (meta.adresse) project.adresse = meta.adresse;
  if (meta.type_bien) project.type_bien = meta.type_bien;
  if (meta.demande) project.demande = meta.demande;
  if (meta.qualite) project.qualite = meta.qualite;
  if (meta.budget) project.budget = meta.budget;
  if (meta.echeance) project.echeance = meta.echeance;
  if (meta.precision) project.precision = meta.precision;
  if (meta.surface) project.surface = meta.surface;

  // Notification admin (non bloquant)
  try {
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
      console.log('[NOTIFICATION] Fonction notify-admin non disponible.');
    });
  } catch (err) {
    console.error('[NOTIFICATION] Erreur:', err.message);
  }

  // Accepter l'inscription — phase 3 = premiere visite espace client
  try {
    await upsertClientPipeline({
      email,
      status: 'account_created',
      fields: {
        nom: meta.full_name || undefined,
        telephone: meta.telephone || undefined,
        phone: meta.telephone || undefined,
        adresse: meta.adresse || undefined,
        type_bien: meta.type_bien || undefined,
        project_type: meta.type_bien || undefined,
        demande: meta.demande || undefined,
        project_details: meta.demande || undefined,
        surface: meta.surface || undefined,
        echeance: meta.echeance || undefined,
        budget: meta.budget || undefined,
        phase: 3
      }
    });
  } catch (pipelineError) {
    console.error('[PIPELINE] Signup sync error:', pipelineError.message);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      app_metadata: {
        roles: ['client'],
        phase: 3,
        project: Object.keys(project).length > 0 ? project : undefined
      }
    })
  };
};
