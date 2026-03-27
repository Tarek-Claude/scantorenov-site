# Prompt Codex — Sprint 3 D-1 : Mail d'invitation à la prise de RDV scan 3D

**Destinataire:** Codex / ChatGPT
**Contexte:** ScantoRenov — Phase 2 Étude/Avant-projet, invitation scan 3D
**Statut:** Sprint 2 (B-1 à B-4) finalisé, phase C (synthèse appel + statut call_done) complétée
**Durée estimée:** 1 jour
**Dépendances:** C-1 (project_notes type='phone_summary' renseignée), C-2 complétée, statut client = `call_done`

---

## Stack technique

**Frontend:** HTML/CSS/JS vanilla (pas de framework, pas de bundler)
**Backend:** Netlify Functions (Node 18)
**Base de données:** Supabase PostgreSQL (schéma v3 — 4 tables : clients, appointments, project_notes, payments, scans)
**Auth:** Netlify Identity
**Email:** Resend API — expéditeur `avant-projet@scantorenov.com`

**Convention de code :**
- Netlify Functions : utiliser `const`/`let` (Node 18)
- Emails via Resend : `new Resend(process.env.RESEND_API_KEY)`
- Supabase admin : `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`
- Protection admin : vérifier `request.headers['x-admin-secret'] === process.env.ADMIN_SECRET`

**Statuts pipeline v3 (ordre croissant) :**
```
new_lead → account_created → call_requested → call_done
→ scan_scheduled → scan_payment_completed → scan_completed
→ analysis_ready → avant_projet_ready → accompaniment_subscribed
```

---

## D-1 | Mail d'invitation à la prise de RDV scan 3D

**Fichier à créer :** `netlify/functions/invite-scan.js`
**Complexité :** Faible

### Contexte

Suite à l'échange téléphonique (phase C), le chef de projet ScantoRenov a saisi la synthèse de l'appel dans `project_notes` (type=`phone_summary`). Le statut du client est maintenant `call_done`. L'admin déclenche manuellement l'envoi d'un email invitant le prospect à se connecter à son espace personnel pour prendre un RDV de scan 3D.

La durée estimée du scan a été qualifiée pendant l'appel — elle est stockée dans `project_notes.confirmed_surface` ou dans `project_notes.internal_notes`. L'email doit la mentionner.

**Mise à jour requise dans `netlify/functions/_client-pipeline.js`** : ajouter les nouveaux statuts dans le tableau `PIPELINE_STATUSES` (voir D-1a ci-dessous).

---

### Sous-tâches

**D-1a : Mettre à jour `_client-pipeline.js` avec les nouveaux statuts**

Ouvrir `netlify/functions/_client-pipeline.js` et modifier le tableau `PIPELINE_STATUSES` :

```javascript
const PIPELINE_STATUSES = [
  'new_lead',
  'account_created',
  'onboarding_completed',
  'call_requested',
  'call_done',
  'scan_scheduled',          // ← déjà présent
  'scan_payment_completed',  // ← AJOUTER
  'scan_completed',
  'analysis_ready',
  'avant_projet_ready',
  'accompaniment_subscribed' // ← AJOUTER
];
```

---

**D-1b : Créer la fonction `netlify/functions/invite-scan.js`**

Endpoint POST, protégé par `ADMIN_SECRET`. Accepte `{ clientId }` ou `{ email }` dans le body.

```javascript
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = 'https://scantorenov.com';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Vérification admin
  const adminSecret = event.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { clientId, email: emailParam } = JSON.parse(event.body || '{}');

    if (!clientId && !emailParam) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'clientId ou email requis' }) };
    }

    // 1. Récupérer le client
    let query = supabase.from('clients').select('*');
    if (clientId) query = query.eq('id', clientId);
    else query = query.eq('email', emailParam);
    const { data: client, error: clientError } = await query.single();

    if (clientError || !client) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Client introuvable' }) };
    }

    if (client.status !== 'call_done') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Statut invalide : ${client.status} (attendu: call_done)` }) };
    }

    // 2. Récupérer la synthèse téléphonique pour la durée estimée
    const { data: phoneNote } = await supabase
      .from('project_notes')
      .select('summary, confirmed_surface, confirmed_budget, needs')
      .eq('client_id', client.id)
      .eq('type', 'phone_summary')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const scanDuration = phoneNote?.confirmed_surface
      ? `Durée estimée : environ ${getScanDuration(phoneNote.confirmed_surface)}`
      : 'Durée estimée : entre 1h et 2h selon la superficie du bien';

    // 3. Envoyer l'email d'invitation
    await sendInvitationEmail(client, scanDuration);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: `Email d'invitation envoyé à ${client.email}` }),
    };
  } catch (err) {
    console.error('invite-scan error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
```

**Helper — estimation de durée de scan selon surface :**
```javascript
function getScanDuration(surface) {
  const surfaceNum = parseInt(surface);
  if (!surfaceNum) return '1h à 2h';
  if (surfaceNum <= 50) return '45 min à 1h';
  if (surfaceNum <= 100) return '1h à 1h30';
  if (surfaceNum <= 200) return '1h30 à 2h30';
  return '2h30 à 3h';
}
```

---

**D-1c : Template HTML du mail d'invitation scan**

Style cohérent avec `confirm-appointment.js` (même structure, même palette de couleurs).

```javascript
async function sendInvitationEmail(client, scanDuration) {
  const prenom = client.prenom || client.nom || 'Madame/Monsieur';
  const adresse = client.adresse || 'votre bien';
  const espace_url = `${SITE_URL}/espace-client.html`;

  const html = `
  <div style="font-family:'Inter',Arial,sans-serif;max-width:620px;margin:0 auto;color:#2A2A2A;line-height:1.7;">
    <div style="text-align:center;padding:32px 0 24px;">
      <img src="${SITE_URL}/logo-scantorenov.webp" alt="Scantorenov" style="width:60px;height:auto;" />
    </div>

    <h2 style="color:#2D5F3E;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.5rem;text-align:center;margin:0 0 28px 0;">
      Prochaine étape : votre scan 3D
    </h2>

    <p style="font-size:0.95rem;color:#5A5A5A;padding:0 24px;">
      Bonjour ${prenom},
    </p>
    <p style="font-size:0.95rem;color:#5A5A5A;padding:0 24px;">
      Suite à notre échange téléphonique, nous sommes heureux de vous accompagner
      dans votre projet de rénovation de <strong>${adresse}</strong>.
    </p>
    <p style="font-size:0.95rem;color:#5A5A5A;padding:0 24px;">
      La prochaine étape consiste à réaliser un <strong>scan 3D Matterport</strong> de votre bien.
      Ce jumeau numérique de haute précision constituera la base de votre avant-projet.
    </p>

    <div style="margin:24px;padding:20px;border:1px solid #E8E8E8;background:#FBFAF7;border-radius:8px;">
      <p style="margin:0 0 8px 0;font-size:0.9rem;color:#2D5F3E;font-weight:600;">📅 Prise de rendez-vous scan</p>
      <p style="margin:0;font-size:0.9rem;color:#5A5A5A;">${scanDuration}</p>
      <p style="margin:8px 0 0 0;font-size:0.9rem;color:#5A5A5A;">
        La prestation de scan est facturée <strong>180 € TTC</strong>,
        à régler en ligne lors de la validation de votre créneau.
      </p>
    </div>

    <div style="text-align:center;margin:32px 24px;">
      <a href="${espace_url}"
         style="display:inline-block;background:#2D5F3E;color:#fff;text-decoration:none;
                padding:14px 32px;border-radius:4px;font-size:0.9rem;font-weight:600;
                letter-spacing:0.05em;text-transform:uppercase;">
        Accéder à mon espace →
      </a>
    </div>

    <p style="font-size:0.85rem;color:#9A9A9A;text-align:center;padding:0 24px;">
      Besoin d'aide ? Contactez-nous à
      <a href="mailto:avant-projet@scantorenov.com" style="color:#2D5F3E;">avant-projet@scantorenov.com</a>
    </p>

    <div style="text-align:center;padding:24px 0;border-top:1px solid #E8E8E8;margin-top:32px;">
      <p style="font-size:0.78rem;color:#9A9A9A;margin:0;">
        Scantorenov · <a href="${SITE_URL}" style="color:#9A9A9A;">scantorenov.com</a>
      </p>
    </div>
  </div>`;

  const result = await resend.emails.send({
    from: 'ScantoRenov <avant-projet@scantorenov.com>',
    to: [client.email],
    subject: `${prenom}, réservez votre scan 3D – ScantoRenov`,
    html,
  });

  if (result.error) throw new Error(`Resend error: ${result.error.message}`);
  console.log(`✅ Invitation scan envoyée à ${client.email}`, result.data?.id);
  return result;
}
```

---

**D-1d : Configurer `avant-projet@scantorenov.com` dans Resend**

Si ce n'est pas encore fait :
1. Aller sur https://resend.com/domains
2. Vérifier que le domaine `scantorenov.com` est bien vérifié
3. Dans le code, s'assurer d'utiliser `avant-projet@scantorenov.com` comme expéditeur (et non `contact@scantorenov.com`)
4. Tester un envoi depuis le dashboard Resend avant déploiement

---

**D-1e : Tests**

**Test 1 — Appel direct :**
```bash
curl -X POST https://<site>.netlify.app/.netlify/functions/invite-scan \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"email": "client-test@example.com"}'
```
→ Vérifier : réponse 200, email reçu par le client

**Test 2 — Statut invalide :**
- Appeler avec un client au statut `new_lead` → vérifier réponse 400 avec message explicite

**Test 3 — Client inexistant :**
- Appeler avec un email inconnu → vérifier réponse 404

---

### Critères d'acceptation

- ✅ `_client-pipeline.js` contient `scan_payment_completed` et `accompaniment_subscribed`
- ✅ `invite-scan.js` est protégée par `ADMIN_SECRET`
- ✅ Fonctionne uniquement pour les clients avec statut `call_done`
- ✅ La durée estimée du scan est récupérée depuis `project_notes` (phone_summary)
- ✅ Email envoyé depuis `avant-projet@scantorenov.com`
- ✅ Le lien pointe vers `espace-client.html`
- ✅ La tarification (180 € TTC) est mentionnée dans l'email
- ✅ Pas d'erreurs d'encodage UTF-8 dans les templates

---

## Validation D-1

Parcours complet :
1. Client en statut `call_done` existe dans Supabase avec `project_notes.phone_summary`
2. Admin appelle `POST /.netlify/functions/invite-scan` avec l'email du client
3. Client reçoit l'email depuis `avant-projet@scantorenov.com`
4. Email contient : prénom, adresse du bien, durée estimée scan, mention 180 € TTC, lien espace client
5. Cliquer sur le lien → `espace-client.html` s'affiche avec la section de prise de RDV scan (D-2)

---

## Notes pour Codex

- Rester dans le scope D-1 : création de `invite-scan.js` + mise à jour de `_client-pipeline.js`
- Ne pas modifier `book-appointment.js` ni `confirm-appointment.js` (D-2 s'en chargera)
- L'email doit avoir le même style visuel que `confirm-appointment.js` (même palette verte `#2D5F3E`)
- Ne pas modifier le statut du client dans cette fonction — l'invitation est une action unilatérale admin
- Vérifier l'encodage UTF-8 (accents dans les templates)

Bon courage! 🚀
