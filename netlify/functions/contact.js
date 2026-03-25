const { Resend } = require('resend');
const { upsertClientPipeline } = require('./_client-pipeline');

const resend = new Resend(process.env.RESEND_API_KEY);

const SITE_URL = process.env.DEPLOY_URL || 'https://scantorenov.com';

function getSignupUrl(data) {
  const params = [
    'email=' + encodeURIComponent(data.email),
    'full_name=' + encodeURIComponent([data.genre, data.prenom, data.nom].filter(Boolean).join(' ').trim()),
    'indicatif=' + encodeURIComponent(data.indicatif),
    'telephone=' + encodeURIComponent(data.telephone),
    'adresse=' + encodeURIComponent(data.adresse),
    'type_bien=' + encodeURIComponent(data.type_bien),
    'demande=' + encodeURIComponent(data.demande || ''),
    'qualite=' + encodeURIComponent(data.qualite),
    'budget=' + encodeURIComponent(data.budget),
    'surface=' + encodeURIComponent(data.surface),
    'echeance=' + encodeURIComponent(data.echeance),
    'precision=' + encodeURIComponent(data.precision)
  ];

  return `${SITE_URL}/connexion.html?action=signup&email=${encodeURIComponent(data.email)}#inscription&${params.join('&')}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const params = new URLSearchParams(event.body);
    const data = {
      genre: params.get('genre') || '',
      prenom: (params.get('prenom') || '').trim(),
      nom: (params.get('nom') || '').trim(),
      email: (params.get('email') || '').trim(),
      requestType: params.get('requestType') || 'inquiry',
      indicatif: params.get('indicatif') || '+33',
      telephone: (params.get('telephone') || '').trim(),
      adresse: (params.get('adresse') || '').trim(),
      qualite: params.get('qualite') || '',
      type_bien: params.get('type_bien') || params.get('typeBien') || '',
      precision: params.get('precision') || '',
      surface: params.get('surface') || '',
      echeance: params.get('echeance') || '',
      budget: params.get('budget') || '',
      demande: params.get('demande') || params.get('message') || '',
      message: params.get('message') || ''
    };

    const fullName = [data.genre, data.prenom, data.nom].filter(Boolean).join(' ').trim();
    const normalizedDemande = (data.demande || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const inferredCallbackRequest = /\brappel\b|\brendez[- ]?vous\b|\brdv\b|\btelephone\b/.test(normalizedDemande);
    const isCallbackRequest = data.requestType === 'callback' || (data.requestType !== 'inquiry' && inferredCallbackRequest);
    const requestTypeLabel = isCallbackRequest ? 'Demande de rappel téléphonique' : 'Renseignement';
    const requestPriorityLabel = isCallbackRequest ? 'HAUTE (rappel demandé)' : 'Normal';
    const pipelineStatus = isCallbackRequest ? 'call_requested' : 'new_lead';
    const adminSubject = isCallbackRequest
      ? `[RAPPEL TÉLÉPHONIQUE] Demande de rappel : ${fullName} – ${data.type_bien}`
      : `[RENSEIGNEMENT] Nouvelle demande : ${fullName} – ${data.type_bien}`;
    const clientStatusLabel = isCallbackRequest ? 'demandeur' : 'visiteur';
    const projectLabel = [data.type_bien, data.precision].filter(Boolean).join(' – ') || 'Non spécifié';
    const fullPhone = [data.indicatif, data.telephone].filter(Boolean).join(' ').trim() || 'Non spécifié';
    const budgetLabel = data.budget || 'Non spécifié';
    const addressLabel = data.adresse || 'Non spécifiée';
    const demandeLabel = data.demande || 'Non spécifiée';

    try {
      await upsertClientPipeline({
        email: data.email,
        status: pipelineStatus,
        fields: {
          genre: data.genre || null,
          prenom: data.prenom || null,
          nom: data.nom || null,
          indicatif: data.indicatif || '+33',
          telephone: data.telephone || null,
          phone: data.telephone || null,
          adresse: data.adresse || null,
          type_bien: data.type_bien || null,
          project_type: data.type_bien || null,
          demande: data.demande || null,
          project_details: data.demande || null,
          budget: data.budget || null,
          echeance: data.echeance || null
        }
      });
    } catch (pipelineError) {
      console.error('[PIPELINE] Contact sync error:', pipelineError.message);
    }

    await resend.emails.send({
      from: 'Scantorenov <contact@scantorenov.com>',
      to: ['scantorenov@gmail.com'],
      subject: adminSubject,
      html: `
        <h2 style="color:#2D5F3E;">Nouvelle demande de contact</h2>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
          <tr><td style="padding:6px 12px;font-weight:bold;">Type de demande</td><td style="padding:6px 12px;">${requestTypeLabel}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Priorité</td><td style="padding:6px 12px;">${requestPriorityLabel}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Prénom</td><td style="padding:6px 12px;">${data.prenom}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Nom</td><td style="padding:6px 12px;">${data.nom}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Téléphone</td><td style="padding:6px 12px;">${data.indicatif} ${data.telephone}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Adresse</td><td style="padding:6px 12px;">${data.adresse}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Qualité</td><td style="padding:6px 12px;">${data.qualite}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Type de bien</td><td style="padding:6px 12px;">${data.type_bien} – ${data.precision}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Échéance</td><td style="padding:6px 12px;">${data.echeance}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Budget</td><td style="padding:6px 12px;">${data.budget}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Demande</td><td style="padding:6px 12px;">${data.demande}</td></tr>
        </table>
      `
    });

    const signupUrl = getSignupUrl(data);
    const clientEmailSubject = isCallbackRequest
      ? 'Votre demande de rappel – ScantoRenov'
      : 'Bienvenue – Créez votre espace ScantoRenov';
    const clientEmailHtml = isCallbackRequest
      ? `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:650px;margin:0 auto;color:#2A2A2A;line-height:1.7;">
          <div style="text-align:center;padding:32px 0 24px;">
            <img src="${SITE_URL}/logo-scantorenov.webp" alt="Scantorenov" style="width:60px;height:auto;" />
          </div>

          <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.5rem;text-align:center;margin:0 0 28px 0;">
            Bonjour ${data.prenom},
          </h2>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
            Merci de votre demande.
          </p>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
            Nous avons bien reçu votre demande de <strong>rappel téléphonique</strong>. Un membre de notre équipe vous contactera au numéro <strong>${fullPhone}</strong> dans les <strong>24h ouvrables</strong>.
          </p>

          <div style="margin:24px;padding:20px;border:1px solid #E8E8E8;background:#FBFAF7;">
            <p style="font-size:0.78rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2D5F3E;margin:0 0 14px 0;">
              Nous préparerons avec vous
            </p>
            <ul style="margin:0;padding:0 0 0 18px;color:#5A5A5A;font-size:0.92rem;">
              <li>Vos besoins spécifiques pour ${projectLabel}</li>
              <li>Les travaux envisagés</li>
              <li>Un devis préliminaire</li>
            </ul>
          </div>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 24px 0;padding:0 24px;">
            En attendant votre appel, vous pouvez déjà créer votre espace personnel ScantoRenov.
          </p>

          <div style="text-align:center;margin:36px 0;">
            <a href="${signupUrl}"
               style="display:inline-block;padding:14px 40px;background:#2D5F3E;color:#FFFFFF;text-decoration:none;border-radius:6px;font-size:0.9rem;font-weight:600;letter-spacing:0.05em;box-shadow:0 2px 8px rgba(45,95,62,0.2);">
              Créer mon espace ScantoRenov →
            </a>
          </div>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
            À bientôt,<br/>L'équipe ScantoRenov
          </p>

          <hr style="border:none;border-top:1px solid #E8E8E8;margin:32px 0;" />

          <p style="font-size:0.75rem;color:#8A8A8A;text-align:center;margin:0;padding:0 24px;">
            Scantorenov – Précision d'intérieur<br/>
            <a href="mailto:avant-projet@scantorenov.com" style="color:#2D5F3E;text-decoration:none;">avant-projet@scantorenov.com</a>
          </p>
        </div>
      `
      : `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:650px;margin:0 auto;color:#2A2A2A;line-height:1.7;">
          <div style="text-align:center;padding:32px 0 24px;">
            <img src="${SITE_URL}/logo-scantorenov.webp" alt="Scantorenov" style="width:60px;height:auto;" />
          </div>

          <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.5rem;text-align:center;margin:0 0 28px 0;">
            Bonjour ${data.prenom},
          </h2>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
            Merci pour votre intérêt envers ScantoRenov.
          </p>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
            Votre demande de renseignement a bien été reçue. Vous êtes actuellement enregistré comme <strong>${clientStatusLabel}</strong> sur la plateforme.
          </p>

          <div style="margin:32px 24px 24px 24px;padding:20px;border:1px solid #E8E8E8;background:#FBFAF7;">
            <p style="font-size:0.78rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#2D5F3E;margin:0 0 14px 0;">
              Récapitulatif de votre demande
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:0.92rem;color:#5A5A5A;">
              <tr><td style="padding:6px 0;font-weight:600;color:#2A2A2A;">Type de bien</td><td style="padding:6px 0;">${projectLabel}</td></tr>
              <tr><td style="padding:6px 0;font-weight:600;color:#2A2A2A;">Adresse</td><td style="padding:6px 0;">${addressLabel}</td></tr>
              <tr><td style="padding:6px 0;font-weight:600;color:#2A2A2A;">Téléphone</td><td style="padding:6px 0;">${fullPhone}</td></tr>
              <tr><td style="padding:6px 0;font-weight:600;color:#2A2A2A;">Budget estimé</td><td style="padding:6px 0;">${budgetLabel}</td></tr>
              <tr><td style="padding:6px 0;font-weight:600;color:#2A2A2A;vertical-align:top;">Détails</td><td style="padding:6px 0;">${demandeLabel}</td></tr>
            </table>
          </div>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 24px 0;padding:0 24px;">
            Pour accéder à votre espace personnel dès maintenant, créez un compte via le lien ci-dessous.
          </p>

          <div style="text-align:center;margin:36px 0;">
            <a href="${signupUrl}"
               style="display:inline-block;padding:14px 40px;background:#2D5F3E;color:#FFFFFF;text-decoration:none;border-radius:6px;font-size:0.9rem;font-weight:600;letter-spacing:0.05em;box-shadow:0 2px 8px rgba(45,95,62,0.2);">
              Créer mon espace ScantoRenov →
            </a>
          </div>

          <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 18px 0;padding:0 24px;">
            Nos experts examineront vos informations et vous recontacteront dans les meilleurs délais pour discuter de votre projet.
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
            Scantorenov – Précision d'intérieur<br/>
            <a href="mailto:avant-projet@scantorenov.com" style="color:#2D5F3E;text-decoration:none;">avant-projet@scantorenov.com</a>
          </p>
        </div>
      `;
    await resend.emails.send({
      from: 'Scantorenov <avant-projet@scantorenov.com>',
      to: [data.email],
      subject: clientEmailSubject,
      html: clientEmailHtml
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Email error:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, emailError: error.message })
    };
  }
};
