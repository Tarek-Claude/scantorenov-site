const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  const { payload } = JSON.parse(event.body);
  const { nom, email, telephone, sujet, message } = payload.data || {};

  // Vérification minimale
  if (!email || !nom) {
    console.log('Soumission ignorée : données manquantes', payload.data);
    return { statusCode: 200, body: 'OK — données insuffisantes' };
  }

  // Transporter Gmail SMTP
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,       // scantorenov@gmail.com
      pass: process.env.GMAIL_APP_PASSWORD // Mot de passe d'application Google
    }
  });

  const siteUrl = process.env.URL || 'https://scantorenov.com';

  // ── 1. Alerte interne → scantorenov@gmail.com ──
  const alertHtml = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#2D5F3E;margin-bottom:16px;">📩 Nouvelle demande de contact</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 12px;font-weight:600;color:#5A5A5A;">Nom</td><td style="padding:8px 12px;">${nom}</td></tr>
        <tr style="background:#F5F2ED;"><td style="padding:8px 12px;font-weight:600;color:#5A5A5A;">Email</td><td style="padding:8px 12px;">${email}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;color:#5A5A5A;">Téléphone</td><td style="padding:8px 12px;">${telephone || '—'}</td></tr>
        <tr style="background:#F5F2ED;"><td style="padding:8px 12px;font-weight:600;color:#5A5A5A;">Sujet</td><td style="padding:8px 12px;">${sujet || '—'}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;color:#5A5A5A;">Message</td><td style="padding:8px 12px;">${message || '—'}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:0.85rem;color:#8A8A8A;">Reçu le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>
    </div>
  `;

  // ── 2. Confirmation au demandeur ──
  const confirmHtml = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <img src="${siteUrl}/Logo-scantorenov.png" alt="Scantorenov" style="width:60px;margin-bottom:16px;mix-blend-mode:multiply;" />
      <h2 style="font-family:'Cormorant Garamond',Georgia,serif;color:#2D5F3E;font-weight:300;font-size:1.6rem;">
        Merci ${nom}, nous avons bien reçu votre demande.
      </h2>
      <p style="color:#5A5A5A;line-height:1.6;margin:16px 0;">
        Notre équipe prendra connaissance de votre message et vous recontactera dans les plus brefs délais.
      </p>
      <div style="background:#F5F2ED;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="font-weight:600;color:#2A2A2A;margin-bottom:8px;">Récapitulatif de votre demande :</p>
        <p style="color:#5A5A5A;margin:4px 0;"><strong>Sujet :</strong> ${sujet || '—'}</p>
        <p style="color:#5A5A5A;margin:4px 0;"><strong>Message :</strong> ${message || '—'}</p>
      </div>

      <hr style="border:none;border-top:1px solid #e0ddd8;margin:24px 0;" />

      <h3 style="font-family:'Cormorant Garamond',Georgia,serif;color:#1A5F6A;font-weight:400;font-size:1.2rem;margin-bottom:12px;">
        🏠 Créez votre espace client
      </h3>
      <p style="color:#5A5A5A;line-height:1.6;margin-bottom:16px;">
        En créant votre compte, vous accéderez à votre jumeau numérique 3D, à Marcel — votre assistant IA de rénovation — et à vos simulations visuelles.
      </p>
      <a href="${siteUrl}/connexion.html" style="display:inline-block;background:#2D5F3E;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:500;font-size:0.95rem;">
        Créer mon compte
      </a>

      <p style="margin-top:32px;font-size:0.82rem;color:#8A8A8A;">
        Scantorenov — Précision d'intérieur<br/>
        <a href="${siteUrl}" style="color:#1A5F6A;">scantorenov.com</a>
      </p>
    </div>
  `;

  try {
    // Envoi des deux mails en parallèle
    await Promise.all([
      transporter.sendMail({
        from: `"Scantorenov" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: `🏠 Nouveau contact : ${nom} — ${sujet || 'Demande'}`,
        html: alertHtml
      }),
      transporter.sendMail({
        from: `"Scantorenov" <${process.env.GMAIL_USER}>`,
        to: email,
        replyTo: process.env.GMAIL_USER,
        subject: `Scantorenov — Votre demande a bien été reçue`,
        html: confirmHtml
      })
    ]);

    console.log(`✅ Emails envoyés — alerte + confirmation pour ${email}`);
    return { statusCode: 200, body: 'Emails envoyés' };

  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return { statusCode: 500, body: `Erreur: ${error.message}` };
  }
};
