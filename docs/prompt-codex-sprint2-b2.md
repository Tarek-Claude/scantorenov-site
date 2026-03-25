# Prompt Codex — Sprint 2 B-2: Mail de confirmation de réception de demande de RDV téléphonique

**Destinataire:** Codex / ChatGPT
**Contexte:** ScantoRenov application, Sprint 2 mails de confirmation et logique pipeline
**Statut:** Sprint 1 finalisé, B-1 complété
**Durée estimée:** 1-2 jours
**Dépendances:** A-1, A-2, A-3, A-4 finalisés; B-1 complété

---

## Stack technique

**Frontend:** HTML/CSS/JS vanilla (pas de framework, pas de bundler)
**Backend:** Netlify Functions (Node 18)
**Base de données:** Supabase PostgreSQL (schema v3 avec table `appointments`)
**Auth:** Netlify Identity
**Email:** Resend API (contact@scantorenov.com pour Sprint 1, avant-projet@scantorenov.com pour Sprint 2+)
**Captcha:** Cloudflare Turnstile (RGPD)

**Convention de code:**
- Netlify Functions: utiliser `const`/`let` (Node 18)
- Emails via Resend: `new Resend(process.env.RESEND_API_KEY)`
- Supabase client: `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`

**Statuts pipeline:**
```
new_lead → account_created → call_requested → call_done
```

---

## B-2 | Mail de confirmation de réception de demande de RDV téléphonique

**Fichiers:**
- `index.html` (formulaire)
- `netlify/functions/contact.js` (logique d'envoi email et pipeline)

**Complexité:** Moyenne

### Context

Actuellement, le formulaire de contact `index.html` traite toutes les demandes de la même manière. Il faut:
1. Distinguer deux types de demandes: **"Renseignement"** (demande générale) vs **"Demande de rappel téléphonique"** (demande urgente pour RDV)
2. Envoyer un template email **différent** selon le type au client (reconnaître qu'il demande un RDV)
3. Mettre à jour le statut du client dans le pipeline à `call_requested` au lieu de rester à `new_lead`

### Sous-tâches

**B-2a:** Ajouter un champ "Type de demande" dans le formulaire de contact (`index.html`)

Ajouter un sélecteur radio ou dropdown dans le formulaire contactForm, avant le bouton submit:

```html
<fieldset style="margin: 15px 0; border: 1px solid #e0e0e0; padding: 12px; border-radius: 4px;">
  <legend style="font-weight: bold; font-size: 14px;">Type de demande</legend>

  <label style="display: block; margin: 8px 0;">
    <input type="radio" name="requestType" value="inquiry" checked />
    Renseignement sur vos services
  </label>

  <label style="display: block; margin: 8px 0;">
    <input type="radio" name="requestType" value="callback" />
    Demande de rappel téléphonique
  </label>
</fieldset>
```

**B-2b:** Récupérer la valeur du type de demande en JavaScript

Dans le script du formulaire, ajouter:
```javascript
var requestType = document.querySelector('input[name="requestType"]:checked').value;
// requestType sera soit "inquiry" soit "callback"
```

**B-2c:** Transmettre le type de demande au serveur

Ajouter `requestType` aux données JSON envoyées à `contact.js`:
```javascript
var formData = {
  email: emailVal,
  prenom: prenomVal,
  nom: nomVal,
  telephone: telephoneVal,
  indicatif: indicatifVal,
  type_bien: typeBienVal,
  adresse: adresseVal,
  budget: budgetVal,
  demande: demandeVal,
  requestType: requestType  // ← AJOUTER CETTE LIGNE
};
```

**B-2d:** Adapter la logique de `contact.js` pour distinguer les deux types de demande

Dans `netlify/functions/contact.js`:

**Section 1: Récupérer le type de demande**
```javascript
const requestType = request.body.requestType || 'inquiry'; // défaut: renseignement
```

**Section 2: Créer deux templates de mail client distincts**

Template A - Pour **"Renseignement"** (requestType = "inquiry"):
```
Objet: Bienvenue — Créez votre espace ScantoRenov

Bonjour {{prenom}},

Merci pour votre intérêt envers ScantoRenov !

Votre demande de renseignement a bien été reçue.
Nos experts examineront vos informations et vous recontacteront
dans les meilleurs délais pour discuter de votre projet.

Récapitulatif:
- Type de bien: {{type_bien}}
- Adresse: {{address}}
- Téléphone: {{indicatif}} {{telephone}}
- Détails: {{demande}}

Pour accéder à votre espace personnel dès maintenant,
créez un compte: {{signupUrl}}

À bientôt !
L'équipe ScantoRenov
```

Template B - Pour **"Demande de rappel téléphonique"** (requestType = "callback"):
```
Objet: Votre demande de rappel — ScantoRenov

Bonjour {{prenom}},

Merci de votre demande !

Nous avons bien reçu votre demande de **rappel téléphonique**.
Un membre de notre équipe vous contactera au numéro:
{{indicatif}} {{telephone}}

dans les **24h ouvrables**.

Nous aurons l'occasion de discuter:
- Vos besoins spécifiques pour {{type_bien}}
- Les travaux envisagés
- Un devis préliminaire

En attendant votre appel, vous pouvez créer votre espace personnel:
{{signupUrl}}

À bientôt !
L'équipe ScantoRenov
```

**Section 3: Envoyer le bon template en fonction du type**
```javascript
var clientEmailTemplate;
if (requestType === 'callback') {
  clientEmailTemplate = templateCallbackRequest;
} else {
  clientEmailTemplate = templateInquiry;
}

const clientEmail = await resend.emails.send({
  from: 'avant-projet@scantorenov.com',
  to: email,
  subject: requestType === 'callback'
    ? 'Votre demande de rappel — ScantoRenov'
    : 'Bienvenue — Créez votre espace ScantoRenov',
  html: clientEmailTemplate
});
```

**B-2e:** Mettre à jour le statut pipeline en fonction du type de demande

Adapter la logique de statut dans `contact.js`:

```javascript
// Déterminer le statut en fonction du type de demande
var newStatus = 'new_lead';
if (requestType === 'callback') {
  newStatus = 'call_requested'; // Skip new_lead, aller directement à call_requested
}

// UPDATE ou INSERT dans Supabase
await supabase
  .from('clients')
  .update({
    status: newStatus,
    indicatif: indicatif,
    telephone: telephone
    // ... autres champs
  })
  .eq('email', email);
```

**B-2f:** Mail admin: ajouter le type de demande

Adapter aussi le mail envoyé à l'admin (`contact@scantorenov.com`) pour clarifier le type:

```
Objet: [RENSEIGNEMENT] Nouvelle demande : {{prenom}} {{nom}} — {{type_bien}}
// ou
Objet: [RAPPEL TÉLÉPHONIQUE] Demande de rappel : {{prenom}} {{nom}} — {{type_bien}}

Contenu:
Type de demande: {{requestType === 'callback' ? 'Demande de rappel téléphonique' : 'Renseignement'}}
Priorité: {{requestType === 'callback' ? 'HAUTE (rappel demandé)' : 'Normal'}}
...
```

**B-2g:** Test

Scénario 1 - "Renseignement":
- Remplir le formulaire de contact
- Sélectionner "Renseignement sur vos services"
- Soumettre
- Vérifier que le client reçoit un mail avec objet "Bienvenue — Créez votre espace ScantoRenov"
- Vérifier dans Supabase que `clients.status = 'new_lead'`

Scénario 2 - "Demande de rappel":
- Remplir le formulaire de contact
- Sélectionner "Demande de rappel téléphonique"
- Soumettre
- Vérifier que le client reçoit un mail avec objet "Votre demande de rappel — ScantoRenov"
- Vérifier que le contenu mentionne "rappel téléphonique" et le numéro
- Vérifier dans Supabase que `clients.status = 'call_requested'`

Vérifier aussi:
- L'admin reçoit deux mails distincts avec les bons objets
- Les templates s'affichent sans caractères corrompus
- Toutes les variables sont remplacées correctement

### Critères d'acceptation

- ✅ Le formulaire affiche un sélecteur "Type de demande" avec deux options: Renseignement / Rappel
- ✅ La valeur `requestType` est transmise au serveur
- ✅ Deux templates d'email client distincts selon le type
- ✅ Mail "Renseignement" utilise le sujet "Bienvenue"
- ✅ Mail "Rappel" utilise le sujet "Votre demande de rappel" et mentionne le numéro de téléphone
- ✅ Le statut pipeline est mis à jour: `new_lead` pour renseignement, `call_requested` pour rappel
- ✅ L'admin reçoit deux objets distincts: "[RENSEIGNEMENT]" ou "[RAPPEL TÉLÉPHONIQUE]"
- ✅ Pas d'erreurs d'encodage, tous les templates s'affichent correctement

---

## Validation B-2

Parcours complet:

**Test 1: Demande de renseignement**
1. Depuis `index.html`, remplir le formulaire avec type "Renseignement"
2. Soumettre → client reçoit mail "Bienvenue"
3. Vérifier dans Supabase: `clients.status = 'new_lead'`
4. Vérifier admin reçoit mail avec "[RENSEIGNEMENT]" dans l'objet

**Test 2: Demande de rappel**
1. Depuis `index.html`, remplir le formulaire avec type "Demande de rappel téléphonique"
2. Soumettre → client reçoit mail "Votre demande de rappel"
3. Mail mentionne explicitement "rappel téléphonique" et le numéro
4. Vérifier dans Supabase: `clients.status = 'call_requested'`
5. Vérifier admin reçoit mail avec "[RAPPEL TÉLÉPHONIQUE]" dans l'objet

**Critères finaux:**
- ✅ Les deux flux sont distincts et non ambigus pour le client
- ✅ Le pipeline reflète correctement l'intention du client (new_lead vs call_requested)
- ✅ L'admin peut distinguer rapidement le type de demande dans sa boîte mail
- ✅ Tous les champs du formulaire sont préservés et transmis correctement

---

## Notes pour Codex

- Reste stricte sur le scope B-2: ajouter le sélecteur de type, adapter les templates, mettre à jour le pipeline
- Préserver la structure existante du formulaire et des autres champs
- Les deux templates doivent utiliser les mêmes variables ({{prenom}}, {{type_bien}}, etc.), juste du contenu différent
- Vérifier que les objets des emails admin ne contiennent pas de caractères corrompus (A-1 doit être finalisé)
- Tester sur Chrome et Firefox
- L'ordre des sous-tâches est important: formulaire → transmission → templating → pipeline → tests

Bon courage! 🚀
