# Prompt Codex — Sprint 2 B-4: Mail et procédure de confirmation du RDV téléphonique

**Destinataire:** Codex / ChatGPT
**Contexte:** ScantoRenov application, Sprint 2 confirmation RDV webhook + email
**Statut:** Sprint 1 finalisé, B-1 et B-2 complétés
**Durée estimée:** 1 jour
**Dépendances:** A-1, A-2, A-3, A-4 finalisés; B-1, B-2 complétés; B-3 intégration Calendly/Cal.com active

---

## Stack technique

**Frontend:** HTML/CSS/JS vanilla (pas de framework, pas de bundler)
**Backend:** Netlify Functions (Node 18)
**Base de données:** Supabase PostgreSQL (schema v3 avec table `appointments`)
**Auth:** Netlify Identity
**Email:** Resend API (avant-projet@scantorenov.com pour Sprint 2)
**Calendrier:** Webhooks Calendly / Cal.com

**Convention de code:**
- Netlify Functions: utiliser `const`/`let` (Node 18)
- Emails via Resend: `new Resend(process.env.RESEND_API_KEY)`
- Supabase client: `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`

**Statuts pipeline:**
```
new_lead → account_created → call_requested → call_done
```

**Statuts appointments:**
```
pending → confirmed → completed → cancelled
```

---

## B-4 | Mail et procédure de confirmation du RDV téléphonique

**Fichiers:**
- `netlify/functions/confirm-appointment.js` (nouveau, webhook handler)

**Complexité:** Faible

### Context

Une fois que le prospect ou client a pris un RDV via le calendrier Calendly/Cal.com intégré dans `espace-client.html` (Sprint 2, B-3), Calendly envoie un webhook de confirmation au serveur ScantoRenov. Cette fonction `confirm-appointment.js` doit:

1. **Recevoir le webhook** de Calendly/Cal.com
2. **Envoyer un email de confirmation** au client récapitulant les détails du RDV
3. **Mettre à jour le statut** dans la table `appointments` de `pending` à `confirmed`
4. **(Optionnel)** Mettre à jour le statut client si tout le pipeline est complété

### Sous-tâches

**B-4a:** Créer la fonction webhook `netlify/functions/confirm-appointment.js`

Ajouter une fonction Netlify qui:
- Accepte les requêtes POST du webhook Calendly/Cal.com
- Extrait les données du payload: `eventId`, `email`, `startDate`, `startTime`, `endTime`, `inviteesEmail`
- Retourne une réponse HTTP 200 pour confirmer la réception

```javascript
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const payload = JSON.parse(event.body);

    // Payload structure from Calendly webhook (example):
    // {
    //   "event": "invitee.created",
    //   "payload": {
    //     "invitee": {
    //       "event": { "uri": "https://api.calendly.com/events/..." },
    //       "email": "client@example.com",
    //       "scheduled_event": {
    //         "start_time": "2026-04-05T14:00:00.000000Z",
    //         "end_time": "2026-04-05T14:30:00.000000Z"
    //       }
    //     }
    //   }
    // }

    const invitee = payload.payload.invitee;
    const email = invitee.email;
    const startTime = invitee.scheduled_event.start_time;
    const endTime = invitee.scheduled_event.end_time;
    const eventUri = invitee.event.uri;

    // Extraire eventId depuis l'URI ou parser depuis la réponse
    const eventId = eventUri.split('/').pop(); // simplified, may need adjustment

    // À ce stade: email, startTime, endTime, eventId sont disponibles
    // Continuer à B-4b et B-4c

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
```

**B-4b:** Récupérer les données du client et préparer l'email

Dans `confirm-appointment.js`, après réception du webhook:

1. **Interroger Supabase** pour trouver le client par email:
```javascript
const { data: clientData, error: clientError } = await supabase
  .from('clients')
  .select('*')
  .eq('email', email)
  .single();

if (clientError || !clientData) {
  throw new Error(`Client not found for email: ${email}`);
}

const prenom = clientData.prenom;
const indicatif = clientData.indicatif;
const telephone = clientData.telephone;
```

2. **Formater la date et l'heure** du RDV (convertir depuis ISO 8601):
```javascript
const appointmentDate = new Date(startTime);
const formattedDate = appointmentDate.toLocaleDateString('fr-FR', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
const formattedTime = appointmentDate.toLocaleTimeString('fr-FR', {
  hour: '2-digit',
  minute: '2-digit'
});
const formattedEndTime = new Date(endTime).toLocaleTimeString('fr-FR', {
  hour: '2-digit',
  minute: '2-digit'
});
```

**B-4c:** Template email de confirmation et envoi via Resend

```javascript
const templateConfirmation = `
Objet: Rendez-vous confirmé — {{prenom}} le {{date}} à {{time}}

Bonjour {{prenom}},

Votre rendez-vous téléphonique a bien été confirmé ! 🎉

📅 RÉCAPITULATIF
Date: {{date}}
Heure: {{time}} - {{endTime}}
Durée: 30 minutes

L'équipe ScantoRenov vous contactera au numéro:
📞 {{indicatif}} {{telephone}}

AVANT VOTRE APPEL:
- Assurez-vous d'être dans un lieu calme
- Ayez à proximité vos documents de référence (photos, plans, si applicable)
- Prévoyez 30 minutes sans interruption

Si vous avez des questions ou souhaitez reprogrammer,
répondez à cet email ou contactez-nous sur contact@scantorenov.com

À très bientôt !
L'équipe ScantoRenov
`;

const confirmationEmail = await resend.emails.send({
  from: 'avant-projet@scantorenov.com',
  to: email,
  subject: `Rendez-vous confirmé — ${prenom} le ${formattedDate} à ${formattedTime}`,
  html: templateConfirmation
    .replace('{{prenom}}', prenom)
    .replace('{{date}}', formattedDate)
    .replace('{{time}}', formattedTime)
    .replace('{{endTime}}', formattedEndTime)
    .replace('{{indicatif}}', indicatif)
    .replace('{{telephone}}', telephone)
});

if (confirmationEmail.error) {
  console.error('Error sending confirmation email:', confirmationEmail.error);
  throw new Error('Failed to send confirmation email');
}
```

**B-4d:** Mettre à jour le statut de l'appointment dans Supabase

```javascript
// Rechercher l'appointment correspondant (par email et date/heure approximatives)
const { data: appointmentData, error: appointmentError } = await supabase
  .from('appointments')
  .select('*')
  .eq('client_email', email)
  .eq('type', 'phone_call')
  .eq('status', 'pending')
  .single();

if (appointmentError) {
  console.error('Error finding appointment:', appointmentError);
  throw new Error('Appointment not found');
}

// UPDATE le statut à 'confirmed'
const { error: updateError } = await supabase
  .from('appointments')
  .update({
    status: 'confirmed',
    confirmed_at: new Date().toISOString()
  })
  .eq('id', appointmentData.id);

if (updateError) {
  throw new Error(`Failed to update appointment: ${updateError.message}`);
}
```

**B-4e:** Envoyer un mail admin de notification

Adapter aussi l'envoi d'un mail simplifié à l'admin:

```javascript
const adminEmailText = `
Nouvelle confirmation de RDV:
Email client: ${email}
Nom: ${prenom}
RDV le: ${formattedDate} à ${formattedTime}
Téléphone: ${indicatif} ${telephone}
`;

await resend.emails.send({
  from: 'avant-projet@scantorenov.com',
  to: 'contact@scantorenov.com',
  subject: `[RDV CONFIRMÉ] ${prenom} — ${formattedDate} ${formattedTime}`,
  html: adminEmailText
});
```

**B-4f:** Gestion des erreurs et validation du webhook

Vérifier:
- Que le payload du webhook est valide (structure Calendly attendue)
- Que le client existe dans Supabase (par email)
- Que l'appointment existe et est en statut `pending`
- Que l'email peut être envoyé (gestion des erreurs Resend)

```javascript
// Au début de la fonction, ajouter une validation simple:
if (!payload.payload || !payload.payload.invitee) {
  return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payload' }) };
}

if (!email || !startTime) {
  return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
}
```

**B-4g:** Test

Scénarios de test:

1. **Test webhook Calendly directement:**
   - Dans Calendly/Cal.com, tester l'envoi du webhook avec les paramètres de test
   - Vérifier que la fonction retourne HTTP 200
   - Vérifier les logs Netlify pour voir les messages de débogage

2. **Test end-to-end depuis `espace-client.html`:**
   - Depuis l'espace client, cliquer sur le calendrier Calendly intégré
   - Choisir un créneau et confirmer la réservation
   - Vérifier que le client reçoit un email de confirmation (dans la boîte mail)
   - Vérifier que le mail contient:
     - La date et l'heure correctes du RDV
     - Le numéro de téléphone avec indicatif
     - Un récapitulatif clair et lisible
   - Vérifier dans Supabase que `appointments.status` est passé de `pending` à `confirmed`
   - Vérifier que l'admin reçoit une notification

3. **Test de gestion d'erreurs:**
   - Envoyer un webhook avec payload invalide → vérifier erreur 400
   - Envoyer un webhook avec email inexistant → vérifier que le client n'est pas trouvé (log)
   - Simuler une erreur Resend (invalider la clé API temporairement) → vérifier gestion gracieuse

### Critères d'acceptation

- ✅ La fonction `confirm-appointment.js` reçoit correctement les webhooks de Calendly/Cal.com
- ✅ Le client reçoit un email de confirmation avec la date et l'heure du RDV
- ✅ L'email inclut le numéro de téléphone avec indicatif (récupéré de Supabase)
- ✅ Le statut de l'appointment passe de `pending` à `confirmed` dans la base
- ✅ L'admin reçoit une notification de confirmation
- ✅ Les dates et heures sont formatées lisiblement (ex: "jeudi 5 avril 2026 à 14:00")
- ✅ Gestion des erreurs robuste (client inexistant, appointment inexistant, erreur email)
- ✅ Pas d'erreurs d'encodage UTF-8 dans les templates

---

## Validation B-4

Parcours complet:

**Test 1: Confirmation via Calendly webhook**
1. Depuis `espace-client.html`, prospect sélectionne un créneau dans le calendrier Calendly
2. Confirme la réservation
3. Calendly envoie un webhook à `confirm-appointment.js`
4. Vérifier que `appointments.status = 'confirmed'`
5. Vérifier que le client reçoit un mail de confirmation
6. Vérifier que l'admin reçoit une notification

**Test 2: Vérification des données**
1. Reprendre le mail reçu par le client
2. Vérifier que la date et l'heure sont exactes
3. Vérifier que le numéro de téléphone est complet (indicatif + numéro)
4. Vérifier que les accents et caractères spéciaux s'affichent correctement

**Test 3: Cas d'erreur**
1. Envoyer un webhook avec structure invalide → fonction retourne 400
2. Tenter de confirmer un RDV pour un client inexistant → logs d'erreur appropriés
3. Simuler erreur Resend → fonction gère et log l'erreur

**Critères finaux:**
- ✅ Le pipeline RDV est fluide de la réservation à la confirmation
- ✅ Le client a une visibilité complète sur son RDV confirmé
- ✅ L'admin est informé des confirmations pour suivi
- ✅ Aucun erreur d'encodage ou données corrompues
- ✅ Robustesse en cas d'erreur (fallbacks appropriés)

---

## Notes pour Codex

- Rester stricte sur le scope B-4: webhook + template email + UPDATE statut
- Préserver la structure des appels Calendly/Cal.com (pas de refactoring du B-3)
- Le template email doit être lisible, professionnel, et contenir tous les détails clés du RDV
- Vérifier l'encodage UTF-8 du fichier et des templates
- Tester sur Chrome et Firefox
- Si les webhooks de Calendly ne se déclenche pas, vérifier la configuration Calendly/Cal.com (URL du webhook, authentification)

Bon courage! 🚀

