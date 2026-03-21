const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// URL de création de compte client
const SITE_URL = process.env.DEPLOY_URL || 'https://scantorenov.com';
const getSignupUrl = (email) => `${SITE_URL}/connexion.html#inscription&email=${encodeURIComponent(email)}`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Netlify Forms envoie en x-www-form-urlencoded
    const params = new URLSearchParams(event.body);
    const data = {
      genre: params.get('genre') || '',
      prenom: params.get('prenom') || '',
      nom: params.get('nom') || '',
      email: params.get('email') || '',
      telephone: params.get('telephone') || '',
      adresse: params.get('adresse') || '',
      qualite: params.get('qualite') || '',
      typeBien: params.get('typeBien') || '',
      precision: params.get('precision') || '',
      echeance: params.get('echeance') || '',
      budget: params.get('budget') || '',
      message: params.get('message') || ''
    };

    const fullName = `${data.genre} ${data.prenom} ${data.nom}`.trim();

    // 1) Mail d'alerte interne → Scantorenov
    await resend.emails.send({
      from: 'Scantorenov <contact@scantorenov.com>',
      to: ['scantorenov@gmail.com'],
      subject: `Nouvelle demande : ${fullName} — ${data.typeBien}`,
      html: `
        <h2 style="color:#2D5F3E;">Nouvelle demande de contact</h2>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
          <tr><td style="padding:6px 12px;font-weight:bold;">Nom</td><td style="padding:6px 12px;">${fullName}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Téléphone</td><td style="padding:6px 12px;">${data.telephone}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Adresse</td><td style="padding:6px 12px;">${data.adresse}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Qualité</td><td style="padding:6px 12px;">${data.qualite}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Type de bien</td><td style="padding:6px 12px;">${data.typeBien} — ${data.precision}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Échéance</td><td style="padding:6px 12px;">${data.echeance}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Budget</td><td style="padding:6px 12px;">${data.budget}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Message</td><td style="padding:6px 12px;">${data.message}</td></tr>
        </table>
      `
    });

    // 2) Mail de confirmation → Demandeur + invitation à créer le compte
    const signupUrl = getSignupUrl(data.email);
    await resend.emails.send({
      from: 'Scantorenov <contact@scantorenov.com>',
      to: [data.email],
      subject: `Bienvenue ${data.prenom}, créez votre espace de rénovation`,
      html: `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:650px;margin:0 auto;color:#2A2A2A;line-height:1.7;">
          <div style="text-align:center;padding:32px 0 24px;">
            <img src="${SITE_URL}/logo-scantorenov.webp" alt="Scantorenov" style="width:60px;height:auto;" />
          </div>

          <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.5rem;text-align:center;margin:0 0 28px 0;">
            Bonjour ${data.prenom},
          </h2>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
            C'est avec joie que nous accueillons votre demande de renseignement. Un projet de rénovation est toujours un moment important et nous vous remercions de l'intérêt que vous portez aux solutions proposées par Scantorenov.
          </p>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
            Ce mail est la première étape de notre processus d'accompagnement.
          </p>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 24px 0;padding:0 24px;">
            Vous trouverez, ci-dessous, un lien sur lequel nous vous invitons à cliquer afin de procéder à la création de votre espace personnalisé de rénovation.
          </p>

          <div style="text-align:center;margin:36px 0;">
            <a href="${signupUrl}"
               style="display:inline-block;padding:14px 40px;background:#2D5F3E;color:#FFFFFF;text-decoration:none;border-radius:6px;font-size:0.9rem;font-weight:600;letter-spacing:0.05em;box-shadow:0 2px 8px rgba(45,95,62,0.2);">
              Créer mon espace client
            </a>
          </div>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:32px 0 18px 0;padding:0 24px;">
            Une fois votre compte créé, vous serez recontacté sous 48h, afin de convenir d'un rendez-vous pour la réalisation du scan 3D Matterport et répondre à toutes vos questions.
          </p>

          <hr style="border:none;border-top:1px solid #E8E8E8;margin:40px 0;" />

          <p style="font-size:0.9rem;color:#5A5A5A;margin:24px 0 8px 0;padding:0 24px;">
            Bien à vous,
          </p>

          <div style="padding:0 24px;margin:16px 0 32px 0;">
            <p style="font-size:0.95rem;font-weight:600;color:#2D5F3E;margin:0 0 4px 0;">Tarek BECHAR</p>
            <p style="font-size:0.85rem;color:#8A8A8A;margin:0;">Président fondateur de Scantorenov<br/>et du bureau d'études Réno'Island</p>
          </div>

          <hr style="border:none;border-top:1px solid #E8E8E8;margin:32px 0;" />

          <p style="font-size:0.75rem;color:#8A8A8A;text-align:center;margin:0;padding:0 24px;">
            Scantorenov — Précision d'intérieur<br/>
            <a href="mailto:contact@scantorenov.com" style="color:#2D5F3E;text-decoration:none;">contact@scantorenov.com</a>
          </p>
        </div>
      `
    });

    // Retourner succès (Netlify Forms gère la redirection)
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Email error:', error);
    // Ne pas bloquer la soumission du formulaire même si l'email échoue
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, emailError: error.message })
    };
  }
};
