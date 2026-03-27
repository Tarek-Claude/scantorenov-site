# Prompt Codex — Sprint 3 D-4 : Mail de confirmation de RDV scan après paiement

**Destinataire:** Codex / ChatGPT
**Contexte:** ScantoRenov — Phase 2, confirmation du RDV scan 3D suite au paiement Stripe
**Statut:** D-3 complété (webhook Stripe confirmé, clients.status = 'scan_payment_completed')
**Durée estimée:** 1 jour
**Dépendances:** D-3 complété, `confirm-scan.js` appelé par `webhook-stripe.js` après paiement

---

## Stack technique

**Frontend:** n/a (ce sprint est 100% backend)
**Backend:** Netlify Functions (Node 18)
**Base de données:** Supabase PostgreSQL — schéma v3, tables `clients`, `appointments`, `project_notes`
**Email:** Resend API — expéditeur `avant-projet@scantorenov.com`

**Convention de code :**
- Netlify Functions : `const`/`let` (Node 18)
- Emails via Resend : `new Resend(process.env.RESEND_API_KEY)`
- Supabase admin : `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`

**Statuts pipeline concernés :**
```
scan_payment_completed  → paiement reçu, RDV confirmé, email D-4 envoyé
```

**Rappel schéma `appointments` :**
```sql
type          TEXT  -- 'scan_3d'
status        TEXT  -- 'confirmed' (après D-3)
scheduled_at  TIMESTAMPTZ
duration_minutes INTEGER
location      TEXT  -- adresse du bien
```

---

## D-4 | Mail de confirmation de RDV scan après paiement

**Fichier à créer :** `netlify/functions/confirm-scan.js`
**Complexité :** Faible

### Contexte

Dès que le webhook Stripe (`webhook-stripe.js` — D-3) confirme le paiement de 180 €, il appelle `confirm-scan.js` en interne. Cette fonction doit :
1. Récupérer les données du client et du RDV scan dans Supabase
2. Récupérer les données contextuelles depuis `project_notes` (phone_summary) — adresse, surface
3. Envoyer un **email de confirmation au client** depuis `avant-projet@scantorenov.com`
4. Envoyer une **notification à l'admin** (`scantorenov@gmail.com`)

L'email client doit être professionnel, rassurant, et donner au client toutes les informations pratiques pour préparer le jour du scan.

---

### Sous-tâches

**D-4a : Créer `netlify/functions/confirm-scan.js`**

Endpoint POST, appelé en interne par `webhook-stripe.js`. Peut aussi être appelé manuellement par l'admin (avec `x-admin-secret`).

```javascript
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = 'https://scantorenov.com';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { clientId, appointmentId } = JSON.parse(event.body || '{}');

    if (!clientId || !appointmentId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'clientId et appointmentId requis' }) };
    }

    // 1. Récupérer le client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email, prenom, nom, adresse, telephone, indicatif')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Client introuvable' }) };
    }

    // 2. Récupérer le RDV scan
    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .select('id, type, status, scheduled_at, duration_minutes, location')
      .eq('id', appointmentId)
      .eq('type', 'scan_3d')
      .single();

    if (apptError || !appt) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'RDV scan introuvable' }) };
    }

    // 3. Récupérer la synthèse téléphonique pour le contexte (optionnel)
    const { data: phoneNote } = await supabase
      .from('project_notes')
      .select('confirmed_surface, confirmed_budget, needs')
      .eq('client_id', clientId)
      .eq('type', 'phone_summary')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 4. Envoyer les emails
    const emailContext = {
      client,
      appt,
      phoneNote: phoneNote || null,
    };

    const [clientEmailResult, adminEmailResult] = await Promise.allSettled([
      sendClientConfirmationEmail(emailContext),
      sendAdminNotificationEmail(emailContext),
    ]);

    if (clientEmailResult.status === 'rejected') {
      console.error('❌ Email client échoué:', clientEmailResult.reason);
    } else {
      console.log('✅ Email confirmation scan envoyé au client:', client.email);
    }

    if (adminEmailResult.status === 'rejected') {
      console.error('❌ Email admin échoué:', adminEmailResult.reason);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        emailSent: clientEmailResult.status === 'fulfilled',
      }),
    };
  } catch (err) {
    console.error('confirm-scan error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
```

---

**D-4b : Template email client — confirmation RDV scan**

```javascript
async function sendClientConfirmationEmail({ client, appt, phoneNote }) {
  const prenom = client.prenom || client.nom || 'Madame/Monsieur';
  const adresseRdv = appt.location || client.adresse || 'votre bien';
  const telephone = [client.indicatif, client.telephone].filter(Boolean).join(' ');

  const rdvDate = new Date(appt.scheduled_at);
  const dateStr = rdvDate.toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = rdvDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const duration = appt.duration_minutes
    ? `${appt.duration_minutes} minutes`
    : 'Entre 1h et 2h30 selon la superficie';

  // Préparer les besoins identifiés (depuis project_notes)
  const needsHtml = phoneNote?.needs?.length
    ? `<p style="margin:0 0 8px 0;font-size:0.88rem;color:#5A5A5A;">
         Besoins identifiés : ${phoneNote.needs.join(', ')}
       </p>`
    : '';

  const html = `
  <div style="font-family:'Inter',Arial,sans-serif;max-width:620px;margin:0 auto;
              color:#2A2A2A;line-height:1.7;">

    <!-- En-tête logo -->
    <div style="text-align:center;padding:32px 0 24px;">
      <img src="${SITE_URL}/logo-scantorenov.webp" alt="ScantoRenov" style="width:60px;height:auto;" />
    </div>

    <!-- Titre -->
    <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;
               font-size:1.5rem;text-align:center;margin:0 0 28px 0;">
      Votre scan 3D est confirmé ✓
    </h2>

    <!-- Corps -->
    <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 12px 0;padding:0 24px;">
      Bonjour ${prenom},
    </p>
    <p style="font-size:0.95rem;color:#5A5A5A;margin:0 0 24px 0;padding:0 24px;">
      Votre paiement a bien été reçu et votre rendez-vous de scan 3D est
      <strong>officiellement confirmé</strong>. Voici le récapitulatif :
    </p>

    <!-- Bloc récapitulatif RDV -->
    <div style="margin:0 24px 24px;padding:24px;border:1px solid #E8E8E8;
                background:#FBFAF7;border-radius:8px;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <tr>
          <td style="padding:8px 0;font-weight:600;color:#2D5F3E;width:40%;">Date</td>
          <td style="padding:8px 0;color:#5A5A5A;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Heure</td>
          <td style="padding:8px 0;color:#5A5A5A;">${timeStr}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Durée estimée</td>
          <td style="padding:8px 0;color:#5A5A5A;">${duration}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Adresse</td>
          <td style="padding:8px 0;color:#5A5A5A;">${adresseRdv}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;color:#2D5F3E;">Montant réglé</td>
          <td style="padding:8px 0;color:#5A5A5A;"><strong>180 € TTC</strong></td>
        </tr>
      </table>
      ${needsHtml}
    </div>

    <!-- Conseils pratiques -->
    <div style="margin:0 24px 24px;padding:20px;border-left:4px solid #2D5F3E;
                background:#F5F9F6;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 8px 0;font-weight:600;font-size:0.9rem;color:#2D5F3E;">
        📋 Comment préparer la visite ?
      </p>
      <ul style="margin:0;padding-left:20px;font-size:0.88rem;color:#5A5A5A;">
        <li>Assurez-vous d'être présent(e) ou d'avoir délégué l'accès au bien</li>
        <li>Libérez les pièces : rangez les encombrants pour un scan optimal</li>
        <li>Prévoyez les clés et codes d'accès nécessaires</li>
        <li>Si possible, rassemblez les plans existants du bien</li>
      </ul>
    </div>

    <!-- CTA espace client -->
    <div style="text-align:center;margin:24px;">
      <a href="${SITE_URL}/espace-client.html"
         style="display:inline-block;background:#2D5F3E;color:#fff;text-decoration:none;
                padding:14px 32px;border-radius:4px;font-size:0.9rem;font-weight:600;
                letter-spacing:0.05em;text-transform:uppercase;">
        Accéder à mon espace →
      </a>
    </div>

    <!-- Contact -->
    <p style="font-size:0.85rem;color:#9A9A9A;text-align:center;padding:0 24px;margin:0 0 24px 0;">
      Des questions ? Contactez-nous à
      <a href="mailto:avant-projet@scantorenov.com" style="color:#2D5F3E;">
        avant-projet@scantorenov.com
      </a>
      ${telephone ? `ou au <a href="tel:${telephone}" style="color:#2D5F3E;">${telephone}</a>` : ''}
    </p>

    <!-- Pied de page -->
    <div style="text-align:center;padding:24px 0;border-top:1px solid #E8E8E8;margin-top:16px;">
      <p style="font-size:0.78rem;color:#9A9A9A;margin:0;">
        ScantoRenov · <a href="${SITE_URL}" style="color:#9A9A9A;">scantorenov.com</a>
        · avant-projet@scantorenov.com
      </p>
    </div>
  </div>`;

  return resend.emails.send({
    from: 'ScantoRenov <avant-projet@scantorenov.com>',
    to: [client.email],
    subject: `Scan 3D confirmé – ${dateStr} à ${timeStr} – ScantoRenov`,
    html,
  });
}
```

---

**D-4c : Email admin — notification RDV scan confirmé**

```javascript
async function sendAdminNotificationEmail({ client, appt }) {
  const prenom = client.prenom || '';
  const nom = client.nom || '';
  const fullName = [prenom, nom].filter(Boolean).join(' ') || client.email;
  const telephone = [client.indicatif, client.telephone].filter(Boolean).join(' ') || 'N/A';
  const adresseRdv = appt.location || client.adresse || 'Non renseignée';

  const rdvDate = new Date(appt.scheduled_at);
  const dateStr = rdvDate.toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = rdvDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const duration = appt.duration_minutes ? `${appt.duration_minutes} min` : 'Durée à confirmer';

  const html = `
    <h2 style="color:#2D5F3E;">✅ RDV Scan 3D Confirmé</h2>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
      <tr><td style="padding:6px 12px;font-weight:bold;">Client</td><td style="padding:6px 12px;">${fullName}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Email</td>
          <td style="padding:6px 12px;"><a href="mailto:${client.email}">${client.email}</a></td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Téléphone</td><td style="padding:6px 12px;">${telephone}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Adresse</td><td style="padding:6px 12px;">${adresseRdv}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Date scan</td><td style="padding:6px 12px;">${dateStr} à ${timeStr}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Durée</td><td style="padding:6px 12px;">${duration}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;">Paiement</td>
          <td style="padding:6px 12px;color:#2D5F3E;font-weight:bold;">180 € TTC reçu ✓</td></tr>
    </table>
    <p style="margin-top:16px;font-size:13px;color:#5A5A5A;">
      <a href="https://supabase.com/dashboard" style="color:#2D5F3E;">Voir dans Supabase</a>
    </p>`;

  return resend.emails.send({
    from: 'ScantoRenov <avant-projet@scantorenov.com>',
    to: ['scantorenov@gmail.com'],
    subject: `[SCAN CONFIRMÉ] ${fullName} — ${dateStr} ${timeStr}`,
    html,
  });
}
```

---

**D-4d : Tests**

**Test 1 — Appel direct (simulation post-paiement) :**
```bash
curl -X POST https://<site>.netlify.app/.netlify/functions/confirm-scan \
  -H "Content-Type: application/json" \
  -d '{"clientId":"<uuid-client>","appointmentId":"<uuid-appointment>"}'
```
→ Vérifier : réponse 200, email reçu par le client, notification admin reçue

**Test 2 — Via parcours complet D-3 :**
- Effectuer un paiement test Stripe (carte `4242...`)
- Vérifier que `webhook-stripe.js` appelle `confirm-scan.js`
- Vérifier que le client reçoit l'email depuis `avant-projet@scantorenov.com`
- Vérifier le contenu : date/heure, adresse, durée, montant payé, conseils pratiques

**Test 3 — Contenu de l'email :**
Vérifier que l'email contient :
- [ ] Nom du client (`prenom`)
- [ ] Date du RDV formatée en français (ex: "mardi 15 avril 2026")
- [ ] Heure du RDV
- [ ] Durée estimée
- [ ] Adresse du bien
- [ ] Confirmation du paiement 180 € TTC
- [ ] Section "Comment préparer la visite ?"
- [ ] Lien vers l'espace client
- [ ] Adresse email de contact `avant-projet@scantorenov.com`
- [ ] Pas de caractères corrompus (accents, guillemets)

**Test 4 — Cas d'erreur :**
- Client inexistant → vérifier réponse 404
- RDV de mauvais type (ex: `phone_call`) → vérifier réponse 404
- Simuler une erreur Resend → vérifier que le 500 est loggué mais pas bloquant pour D-3

---

### Critères d'acceptation

- ✅ `confirm-scan.js` est appelé par `webhook-stripe.js` après chaque paiement scan confirmé
- ✅ Le client reçoit un email depuis `avant-projet@scantorenov.com`
- ✅ L'email contient : date/heure du RDV, adresse du bien, durée, confirmation 180 € TTC
- ✅ L'email inclut la section "Comment préparer la visite ?"
- ✅ L'admin reçoit une notification avec toutes les infos du RDV
- ✅ L'email fonctionne avec ou sans `project_notes.phone_summary` (fallbacks propres)
- ✅ Pas de caractères corrompus — encodage UTF-8 correct
- ✅ Les dates sont formatées en français (`fr-FR`)

---

## Validation D-4

Parcours complet :
1. Client effectue un paiement test Stripe (D-3) → webhook confirmé
2. `webhook-stripe.js` appelle `confirm-scan.js` en interne
3. Client reçoit l'email de confirmation depuis `avant-projet@scantorenov.com`
4. Email : date du RDV en français, adresse, durée estimée, montant réglé, conseils pratiques
5. Admin reçoit `[SCAN CONFIRMÉ] Prénom Nom — mardi 15 avril 2026 10:00`
6. Supabase : `appointments.status = 'confirmed'`, `clients.status = 'scan_payment_completed'` (déjà mis à jour par D-3)

---

## Notes pour Codex

- Rester dans le scope D-4 : uniquement `confirm-scan.js` et ses templates email
- Le style de l'email doit être cohérent avec `confirm-appointment.js` (même palette, même structure)
- La section "Comment préparer la visite ?" est fixe — ne pas la rendre dynamique pour l'instant
- Si `appt.duration_minutes` est null, utiliser le fallback `'Entre 1h et 2h30 selon la superficie'`
- Ne pas appeler `confirm-scan.js` dans D-4 — il est appelé par `webhook-stripe.js` (D-3e)
- Vérifier l'encodage UTF-8 du fichier et des chaînes de caractères dans les templates

Bon courage! 🚀
