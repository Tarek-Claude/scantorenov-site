# Prompt Codex — Sprint 3 D-3 : Paiement Stripe 180 € TTC (validation RDV scan)

**Destinataire:** Codex / ChatGPT
**Contexte:** ScantoRenov — Phase 2, paiement de validation du RDV scan 3D
**Statut:** D-2 complété (RDV scan sélectionné via Calendly, appointments.status='requested')
**Durée estimée:** 2-3 jours
**Dépendances:** D-2 complété (`window.__pendingScanAppointmentId` disponible), table `payments` (schéma v3)

---

## Stack technique

**Frontend:** HTML/CSS/JS vanilla (pas de framework, pas de bundler)
**Backend:** Netlify Functions (Node 18)
**Base de données:** Supabase PostgreSQL — schéma v3, tables `clients`, `appointments`, `payments`
**Paiement:** Stripe Checkout (mode hébergé, redirection)
**Email:** Resend API (`avant-projet@scantorenov.com`) — déclenché après webhook Stripe

**Convention de code :**
- Netlify Functions : `const`/`let` (Node 18)
- Supabase admin : `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`
- Stripe : `require('stripe')(process.env.STRIPE_SECRET_KEY)`
- Protection webhook Stripe : `stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)`

**Variables d'environnement à ajouter dans Netlify dashboard :**
```
STRIPE_SECRET_KEY         sk_live_... (ou sk_test_... en développement)
STRIPE_WEBHOOK_SECRET     whsec_...
STRIPE_PRICE_SCAN_ID      price_... (ID du prix Stripe pour "Scan 3D - 180€")
```

**Statuts pipeline concernés :**
```
scan_scheduled          → client a sélectionné un créneau, en attente de paiement
scan_payment_completed  → paiement 180€ confirmé, RDV confirmé
```

**Schéma table `payments` (v3) :**
```sql
id                  UUID PRIMARY KEY
client_id           UUID REFERENCES clients(id)
stripe_session_id   TEXT
stripe_payment_intent TEXT
type                TEXT  -- 'scan_3d'
amount_cents        INTEGER  -- 18000 (180€)
currency            TEXT DEFAULT 'eur'
status              TEXT  -- 'pending' | 'completed' | 'refunded' | 'failed'
description         TEXT
paid_at             TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT now()
```

---

## D-3 | Paiement Stripe 180 € TTC — validation du RDV scan

**Fichiers à créer :**
- `netlify/functions/create-checkout.js` — crée la session Stripe Checkout
- `netlify/functions/webhook-stripe.js` — reçoit la confirmation de paiement Stripe

**Fichiers à modifier :**
- `espace-client.html` — section bouton de paiement + pages retour Stripe

**Complexité :** Haute

### Contexte

Après que le prospect a sélectionné un créneau scan (D-2), son RDV est en statut `requested` dans `appointments`. Pour confirmer définitivement ce créneau, le prospect doit payer **180 € TTC** via Stripe Checkout.

Flux :
```
Sélection créneau (D-2)
  → Bouton "Valider et payer 180 €" dans espace-client.html
  → create-checkout.js → Session Stripe Checkout
  → Redirection vers page Stripe hébergée
  → Paiement effectué
  → Stripe envoie webhook → webhook-stripe.js
  → Mise à jour BDD + envoi email confirmation (D-4)
  → Redirection vers espace-client.html?payment=success
```

---

### Sous-tâches

**D-3a : Configurer Stripe**

1. Créer un compte Stripe sur https://stripe.com (ou utiliser le compte existant)
2. Dans le dashboard Stripe → **Produits** → **Ajouter un produit** :
   - Nom : `Scan 3D Matterport – ScantoRenov`
   - Prix : `180,00 €` en paiement unique, devise EUR
   - Copier l'ID du prix : `price_XXXX` → stocker dans variable d'env `STRIPE_PRICE_SCAN_ID`
3. Récupérer les clés API : `sk_test_...` (test) ou `sk_live_...` (production)
4. **Configurer le webhook Stripe** :
   - Dashboard Stripe → Développeurs → Webhooks → Ajouter un endpoint
   - URL : `https://<site>.netlify.app/.netlify/functions/webhook-stripe`
   - Événements à écouter : `checkout.session.completed`
   - Copier la clé de signature : `whsec_...` → stocker dans `STRIPE_WEBHOOK_SECRET`

---

**D-3b : Créer `netlify/functions/create-checkout.js`**

Endpoint POST, authentifiable par JWT Netlify Identity (Bearer token).

```javascript
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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
    const { clientId, appointmentId, productType } = JSON.parse(event.body || '{}');

    if (!clientId || !appointmentId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'clientId et appointmentId requis' }) };
    }

    // 1. Récupérer le client et le RDV
    const [{ data: client }, { data: appt }] = await Promise.all([
      supabase.from('clients').select('id, email, prenom, nom, stripe_customer_id').eq('id', clientId).single(),
      supabase.from('appointments').select('id, type, scheduled_at, status').eq('id', appointmentId).single(),
    ]);

    if (!client) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Client introuvable' }) };
    if (!appt) return { statusCode: 404, headers, body: JSON.stringify({ error: 'RDV introuvable' }) };
    if (appt.type !== 'scan_3d') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Type de RDV invalide' }) };

    // 2. Créer ou récupérer le customer Stripe
    let stripeCustomerId = client.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: client.email,
        name: [client.prenom, client.nom].filter(Boolean).join(' '),
        metadata: { supabase_client_id: clientId },
      });
      stripeCustomerId = customer.id;
      await supabase.from('clients').update({ stripe_customer_id: stripeCustomerId }).eq('id', clientId);
    }

    // 3. Créer la session Stripe Checkout
    const priceId = process.env.STRIPE_PRICE_SCAN_ID;
    if (!priceId) throw new Error('STRIPE_PRICE_SCAN_ID non configuré');

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${SITE_URL}/espace-client.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/espace-client.html?payment=cancelled`,
      metadata: {
        client_id: clientId,
        appointment_id: appointmentId,
        product_type: 'scan_3d',
      },
      // Pré-remplir l'email
      customer_email: !stripeCustomerId ? client.email : undefined,
    });

    // 4. Créer un enregistrement payment 'pending' dans Supabase
    await supabase.from('payments').insert([{
      client_id: clientId,
      stripe_session_id: session.id,
      type: 'scan_3d',
      amount_cents: 18000,
      currency: 'eur',
      status: 'pending',
      description: `Scan 3D Matterport – RDV ${appt.scheduled_at}`,
    }]);

    console.log(`✅ Session Stripe créée: ${session.id} pour client ${clientId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ checkoutUrl: session.url, sessionId: session.id }),
    };
  } catch (err) {
    console.error('create-checkout error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
```

---

**D-3c : Bouton de paiement dans `espace-client.html`**

Ajouter, à la suite de la section `scanBookingSection` (D-2), une nouvelle section de paiement qui s'affiche après sélection du créneau :

```html
<!-- ═══════════  PAIEMENT SCAN 3D (D-3)  ═══════════ -->
<div id="scanPaymentSection" style="display:none;margin-top:24px;
     padding:24px;border:1px solid #E8E8E8;border-radius:12px;background:#FBFAF7;">
  <h3 style="color:#2D5F3E;margin:0 0 16px 0;">Valider votre réservation</h3>
  <p style="font-size:0.9rem;color:#5A5A5A;margin:0 0 20px 0;">
    Pour confirmer définitivement votre créneau, réglez la prestation de scan en ligne.
    Vous serez redirigé vers notre page de paiement sécurisée Stripe.
  </p>

  <div style="display:flex;align-items:center;gap:12px;padding:16px;
       background:#fff;border:1px solid #E8E8E8;border-radius:8px;margin-bottom:20px;">
    <span style="font-size:1.4rem;">💳</span>
    <div>
      <div style="font-weight:600;font-size:1rem;color:#2A2A2A;">Scan 3D Matterport</div>
      <div style="font-size:0.85rem;color:#9A9A9A;">Paiement unique sécurisé</div>
    </div>
    <div style="margin-left:auto;font-size:1.2rem;font-weight:700;color:#2D5F3E;">180 € TTC</div>
  </div>

  <button id="payNowBtn" onclick="initiateScanPayment()"
          style="width:100%;background:#2D5F3E;color:#fff;border:none;cursor:pointer;
                 padding:16px 24px;border-radius:6px;font-size:0.95rem;font-weight:600;
                 letter-spacing:0.05em;text-transform:uppercase;">
    💳  VALIDER ET PAYER 180 €
  </button>

  <p id="paymentError" style="display:none;color:#C62828;font-size:0.85rem;
     text-align:center;margin-top:12px;"></p>
</div>
```

**Fonction JavaScript `initiateScanPayment()` :**

```javascript
async function initiateScanPayment() {
  var btn = document.getElementById('payNowBtn');
  var errEl = document.getElementById('paymentError');

  if (!currentClientId || !window.__pendingScanAppointmentId) {
    if (errEl) { errEl.textContent = 'Erreur : RDV ou identifiant client manquant.'; errEl.style.display = ''; }
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Redirection en cours…';
  if (errEl) errEl.style.display = 'none';

  try {
    var resp = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: currentClientId,
        appointmentId: window.__pendingScanAppointmentId,
        productType: 'scan_3d',
      }),
    });
    var data = await resp.json();

    if (!resp.ok || !data.checkoutUrl) {
      throw new Error(data.error || 'Erreur lors de la création du paiement');
    }

    // Rediriger vers Stripe Checkout
    window.location.href = data.checkoutUrl;

  } catch (err) {
    console.error('initiateScanPayment error:', err);
    btn.disabled = false;
    btn.textContent = '💳  VALIDER ET PAYER 180 €';
    if (errEl) { errEl.textContent = 'Erreur : ' + err.message; errEl.style.display = ''; }
  }
}
```

**Afficher la section paiement après sélection du créneau (dans `handleScanSlotSelected`) :**

```javascript
// Ajouter à la fin de handleScanSlotSelected() :
var paySection = document.getElementById('scanPaymentSection');
if (paySection) {
  paySection.style.display = '';
  paySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
```

---

**D-3d : Gérer le retour depuis Stripe dans `espace-client.html`**

Détecter les paramètres `payment=success` ou `payment=cancelled` dans l'URL et afficher une notification :

```javascript
// Exécuter au chargement de la page
(function checkPaymentReturn() {
  var params = new URLSearchParams(window.location.search);
  var paymentStatus = params.get('payment');
  if (!paymentStatus) return;

  // Nettoyer l'URL
  window.history.replaceState({}, '', '/espace-client.html');

  if (paymentStatus === 'success') {
    showPaymentSuccessBanner();
  } else if (paymentStatus === 'cancelled') {
    showPaymentCancelledBanner();
  }
})();

function showPaymentSuccessBanner() {
  var banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;top:16px;left:50%;transform:translateX(-50%);
    background:#2D5F3E;color:#fff;padding:16px 28px;border-radius:8px;
    font-size:0.95rem;font-weight:500;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.15);`;
  banner.textContent = '✅ Paiement confirmé — votre RDV scan est validé !';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 6000);
}

function showPaymentCancelledBanner() {
  var banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;top:16px;left:50%;transform:translateX(-50%);
    background:#C62828;color:#fff;padding:16px 28px;border-radius:8px;
    font-size:0.95rem;font-weight:500;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.15);`;
  banner.textContent = 'Paiement annulé — votre créneau n\'est pas encore confirmé.';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 5000);
}
```

---

**D-3e : Créer `netlify/functions/webhook-stripe.js`**

Reçoit les événements Stripe, traite `checkout.session.completed`.

```javascript
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Stripe webhook signature invalide:', err.message);
    return { statusCode: 400, body: `Webhook error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    await handleCheckoutCompleted(session);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

async function handleCheckoutCompleted(session) {
  const { client_id: clientId, appointment_id: appointmentId, product_type: productType } = session.metadata || {};

  if (!clientId || !appointmentId) {
    console.error('webhook-stripe: metadata manquante (client_id, appointment_id)');
    return;
  }

  console.log(`✅ Paiement confirmé — client: ${clientId}, RDV: ${appointmentId}`);

  // 1. Mettre à jour payments → status 'completed'
  await supabase
    .from('payments')
    .update({
      status: 'completed',
      stripe_payment_intent: session.payment_intent,
      paid_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', session.id);

  // 2. Mettre à jour appointments → status 'confirmed'
  await supabase
    .from('appointments')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', appointmentId);

  // 3. Mettre à jour clients → status 'scan_payment_completed'
  await supabase
    .from('clients')
    .update({ status: 'scan_payment_completed', updated_at: new Date().toISOString() })
    .eq('id', clientId)
    .in('status', ['scan_scheduled', 'call_done']);

  // 4. Déclencher l'email de confirmation (D-4)
  try {
    const resp = await fetch(
      `${process.env.URL}/.netlify/functions/confirm-scan`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, appointmentId }),
      }
    );
    if (!resp.ok) console.error('confirm-scan call failed:', await resp.text());
  } catch (err) {
    console.error('Erreur déclenchement confirm-scan:', err.message);
    // Non-bloquant : le paiement est déjà confirmé
  }
}
```

**Note importante :** La variable `process.env.URL` est automatiquement injectée par Netlify avec l'URL du site déployé.

---

**D-3f : Installer le package Stripe**

Dans `package.json`, vérifier que `stripe` est dans les dépendances :

```bash
npm install stripe --save
```

Puis s'assurer que `package.json` contient :
```json
"dependencies": {
  "stripe": "^14.0.0",
  ...
}
```

---

**D-3g : Tests en mode TEST Stripe**

**Avant tout test :** s'assurer que `STRIPE_SECRET_KEY = sk_test_...` (jamais les clés live en développement).

**Test 1 — Création de session Checkout :**
```bash
curl -X POST https://<site>.netlify.app/.netlify/functions/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"clientId":"<uuid>","appointmentId":"<uuid>","productType":"scan_3d"}'
```
→ Réponse doit contenir `checkoutUrl` → ouvrir le lien dans le navigateur → page Stripe de test

**Test 2 — Paiement test Stripe :**
- Numéro de carte test : `4242 4242 4242 4242`, date future, CVC `123`
- Après paiement → redirection vers `espace-client.html?payment=success`
- Vérifier dans Supabase : `payments.status = 'completed'`, `appointments.status = 'confirmed'`, `clients.status = 'scan_payment_completed'`
- Vérifier que l'email D-4 a été envoyé (voir logs Netlify)

**Test 3 — Annulation :**
- Sur la page Stripe → cliquer "Retour" → redirection vers `espace-client.html?payment=cancelled`
- Vérifier que la bannière d'annulation s'affiche
- Vérifier dans Supabase que `payments.status` reste `pending`

**Test 4 — Webhook (simulé via Stripe CLI) :**
```bash
stripe listen --forward-to localhost:8888/.netlify/functions/webhook-stripe
stripe trigger checkout.session.completed
```

---

### Critères d'acceptation

- ✅ Le bouton "Valider et payer 180 €" apparaît après sélection du créneau scan
- ✅ Clic sur le bouton → redirection vers Stripe Checkout (page hébergée Stripe)
- ✅ Paiement test réussi → `payments.status = 'completed'`
- ✅ Paiement test réussi → `appointments.status = 'confirmed'`
- ✅ Paiement test réussi → `clients.status = 'scan_payment_completed'`
- ✅ Paiement test réussi → `confirm-scan.js` appelé (email D-4 envoyé)
- ✅ Retour sur `espace-client.html` avec la bannière de succès ou annulation
- ✅ Signature du webhook vérifiée (pas de traitement sans signature valide)
- ✅ `payments` INSERT avec `stripe_session_id` dès la création de la session

---

## Validation D-3

Parcours complet :
1. Client en statut `scan_scheduled` ouvre `espace-client.html`
2. La section paiement est visible avec le montant 180 € TTC
3. Clic sur "Valider et payer" → redirection vers Stripe Checkout
4. Renseigner `4242 4242 4242 4242` (carte test) → payer
5. Retour sur `espace-client.html` → bannière verte "Paiement confirmé"
6. Supabase : `payments.status = 'completed'`, `appointments.status = 'confirmed'`, `clients.status = 'scan_payment_completed'`
7. Email de confirmation reçu (D-4)

---

## Notes pour Codex

- **Toujours commencer avec les clés TEST Stripe** (`sk_test_`, `whsec_test_`) — ne jamais utiliser les clés live dans les tests
- La vérification de signature webhook est OBLIGATOIRE — ne jamais traiter un webhook sans elle
- La fonction `confirm-scan.js` (D-4) sera créée séparément — prévoir le call interne dans `handleCheckoutCompleted()`
- Si `process.env.URL` n'est pas disponible localement (Netlify dev), utiliser `http://localhost:8888` en fallback
- Tester avec le Stripe CLI pour les webhooks en local : `stripe listen --forward-to localhost:8888/.netlify/functions/webhook-stripe`
- Ne pas stocker le numéro de carte ni les données sensibles Stripe en base — uniquement les IDs de session et payment_intent

Bon courage! 🚀
