const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// URL de création de compte client
const SITE_URL = 'https://scantorenov.com';
const SIGNUP_URL = `${SITE_URL}/connexion.html#inscription`;

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
    await resend.emails.send({
      from: 'Scantorenov <contact@scantorenov.com>',
      to: [data.email],
      subject: `${data.genre} ${data.nom}, votre demande a bien été reçue`,
      html: `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;color:#2A2A2A;">
          <div style="text-align:center;padding:32px 0 24px;">
            <img src="${SITE_URL}/logo-scantorenov.webp" alt="Scantorenov" style="width:60px;height:auto;" />
          </div>
          <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.6rem;text-align:center;">
            Merci ${data.prenom}, votre demande est entre nos mains.
          </h2>
          <p style="font-size:0.92rem;line-height:1.7;color:#5A5A5A;text-align:center;padding:0 24px;">
            Nous avons bien reçu votre demande concernant votre projet de rénovation
            (${data.typeBien} — ${data.precision}). Notre équipe reviendra vers vous très prochainement.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${SIGNUP_URL}"
               style="display:inline-block;padding:14px 32px;background:#2D5F3E;color:#FFFFFF;text-decoration:none;border-radius:6px;font-size:0.85rem;font-weight:600;letter-spacing:0.05em;">
              Créer mon espace client
            </a>
          </div>
          <p style="font-size:0.82rem;color:#8A8A8A;text-align:center;line-height:1.6;padding:0 24px;">
            En créant votre espace, vous accéderez à votre jumeau numérique,
            à Marcel — notre assistant IA — et à vos simulations visuelles.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
          <p style="font-size:0.75rem;color:#8A8A8A;text-align:center;">
            Scantorenov — Précision d'intérieur<br/>
            contact@scantorenov.com
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
