# Sprint 4 : Remplacement Calendly par système de réservation natif

## Contexte

Le système actuel utilise des iframes Calendly pour la prise de RDV téléphonique et scan 3D. Calendly pose des problèmes de disponibilité, de contrôle et de dépendance externe.

On le remplace par un **calendrier natif** intégré à `espace-client.html`, adossé à la table Supabase `appointments` comme source de vérité unique pour toute l'entreprise.

## Objectif

Supprimer toute dépendance à Calendly. Le client choisit une date dans un sélecteur, voit les créneaux disponibles (les créneaux déjà réservés par d'autres clients apparaissent comme indisponibles, **sans aucune information personnelle**), sélectionne un créneau, et valide. Le RDV est enregistré automatiquement dans Supabase `appointments`.

---

## Règles métier

### RDV téléphonique (`phone_call`)
- **Jours** : lundi au samedi
- **Plage horaire** : 8h00 – 20h00
- **Durée** : 30 minutes
- **Créneaux** : toutes les 30 min (8h00, 8h30, 9h00… 19h30)
- **Délai minimum** : pas de réservation dans les 2h qui suivent l'heure actuelle
- **Horizon** : 30 jours glissants à partir d'aujourd'hui

### RDV scan 3D (`scan_3d`)
- **Jours** : lundi au samedi
- **Plage horaire** : 8h00–12h00 et 14h00–18h00
- **Durée** : 4 heures (créneau fixe)
- **Créneaux** : exactement 2 par jour — matin (8h00-12h00) ou après-midi (14h00-18h00)
- **Délai minimum** : pas de réservation dans les 24h qui suivent
- **Horizon** : 60 jours glissants à partir de demain

### Règles communes
- **Fuseau horaire** : `Europe/Paris`
- **Jours fériés** : ne pas bloquer (géré manuellement plus tard)
- **Conflit** : un créneau est indisponible dès qu'un autre RDV (tous types confondus) le chevauche partiellement ou totalement
- **Aucune info personnelle** : les créneaux pris affichent "Indisponible", jamais le nom ou l'email du client

---

## Architecture technique

### 1. Nouvelle fonction : `netlify/functions/get-available-slots.js`

**Rôle** : retourner les créneaux disponibles pour un type de RDV et une plage de dates.

**Méthode** : `GET`

**Paramètres query string** :
- `type` : `phone_call` ou `scan_3d` (requis)
- `from` : date ISO début (requis, ex : `2026-03-29`)
- `to` : date ISO fin (requis, ex : `2026-04-28`)

**Pas d'authentification** : cette route est publique (elle ne renvoie aucune donnée personnelle).

**Logique** :
1. Valider les paramètres, retourner `400` si manquant ou invalide
2. Générer tous les créneaux possibles entre `from` et `to` selon les règles métier du type demandé
3. Charger tous les `appointments` existants entre `from` et `to` (tous types, statut `!= 'cancelled'`) depuis Supabase — ne sélectionner que `scheduled_at`, `duration_minutes`, `type` (jamais `client_id`, `email`, `notes`)
4. Marquer comme `unavailable` tout créneau qui chevauche un appointment existant
5. Appliquer le délai minimum (2h pour phone_call, 24h pour scan_3d)
6. Retourner un JSON :

```json
{
  "type": "phone_call",
  "slots": [
    { "date": "2026-03-29", "time": "08:00", "available": true },
    { "date": "2026-03-29", "time": "08:30", "available": false },
    ...
  ]
}
```

**Réponses** :
- `200` : liste des créneaux
- `400` : paramètres invalides
- `500` : erreur Supabase

### 2. Modifier `netlify/functions/book-appointment.js`

**Transformation** : passer d'un webhook Calendly à un endpoint POST direct appelé par le frontend.

**Nouvelle signature** :
- Méthode : `POST` (garder support `OPTIONS`)
- Authentification : Netlify Identity (comme `book-scan.js`)
- Body JSON :

```json
{
  "clientId": "uuid",
  "scheduledAt": "2026-03-29T09:00:00+02:00",
  "durationMinutes": 30
}
```

**Logique** :
1. Vérifier Netlify Identity (`context.clientContext.user`)
2. Parser le body, valider `clientId` et `scheduledAt`
3. Charger le client, vérifier que l'email Identity correspond
4. Vérifier que le créneau demandé est bien disponible (requête `appointments` pour détecter un conflit) — retourner `409 Conflict` si pris
5. Insérer dans `appointments` avec `type: 'phone_call'`, `status: 'requested'`, `location: 'phone'`
6. Mettre à jour `clients.status` vers `call_requested` si le statut actuel le permet (via `upsertClientPipeline` de `_client-pipeline.js`, qui utilise `chooseFarthestStatus` en interne)
7. Retourner `200` avec l'`appointmentId`

**Supprimer** : tout le code spécifique Calendly (parsing webhook `invitee.created`, structure `payload.payload.invitee`, etc.)

**Réponses** :
- `200` : RDV créé
- `400` : paramètres invalides
- `401` : non authentifié
- `403` : email mismatch
- `409` : créneau déjà pris
- `500` : erreur Supabase

### 3. Modifier `netlify/functions/book-scan.js`

**Changements mineurs** :
- Supprimer la référence Calendly dans le champ `notes` (remplacer `Réservé via Calendly` par `Réservé via espace client`)
- Ajouter une **vérification de conflit** avant l'insert (même logique que book-appointment : requête `appointments` pour détecter chevauchement, retourner `409` si pris)
- Forcer `durationMinutes` à `240` (4h) pour les scan 3D
- Garder tout le reste inchangé (authentification Identity, vérification statut `call_done`, mise à jour statut vers `scan_scheduled`)

### 4. Modifier `espace-client.html` — remplacer les iframes Calendly

#### 4a. Nouveau composant : sélecteur de date + créneaux

Créer un composant HTML/JS réutilisable (pas de framework externe) qui :

1. Affiche un **calendrier mensuel** (grille 7 colonnes lun-dim) permettant de naviguer mois par mois
2. Quand le client clique sur un jour, charge les créneaux de ce jour via `GET /.netlify/functions/get-available-slots?type=...&from=...&to=...`
3. Affiche les créneaux sous forme de **boutons** :
   - Vert (`#2D5F3E` background, blanc texte) = disponible, cliquable
   - Gris (`#E0E0E0` background, `#999` texte) = indisponible, non cliquable, tooltip "Créneau indisponible"
4. Quand le client sélectionne un créneau disponible : le bouton passe en surbrillance, un **bouton "Confirmer ce créneau"** apparaît en dessous
5. Quand le client clique sur "Confirmer" : appel POST vers `book-appointment` ou `book-scan` selon le contexte, puis affichage de la confirmation

**Style** : reprendre la palette existante (`#2D5F3E` vert principal, `#FBFAF7` fond clair, `#5A5A5A` texte doux, `#E8E8E8` bordures). Pas de librairie CSS externe. Responsive mobile.

**Optimisation réseau** : charger les créneaux par semaine ou par mois (pas jour par jour). Utiliser `from` et `to` pour couvrir le mois affiché en un seul appel.

#### 4b. Section RDV téléphonique (remplacer l'iframe Calendly existante)

Dans la section `appointmentBookingSection` (lignes ~2053-2068) et dans `phone-rdv-planning` (lignes ~2088-2097) :

- **Supprimer** les `<iframe src="https://calendly.com/scantorenov...">`
- **Remplacer** par le composant sélecteur de date + créneaux configuré pour `type: phone_call`
- Quand le RDV est confirmé côté serveur : afficher le `appointmentStatusCard` existant avec les détails du créneau

#### 4c. Section RDV scan 3D (remplacer l'iframe Calendly scan)

Dans la section `scanBookingSection` (lignes ~2147-2158) :

- **Supprimer** l'iframe `<iframe src="https://calendly.com/scantorenov/scan-3d...">`
- **Remplacer** par le composant sélecteur configuré pour `type: scan_3d`
- Pour le scan, les créneaux sont simplifiés : pour chaque jour, afficher seulement 2 boutons — "Matin (8h-12h)" et "Après-midi (14h-18h)"
- Quand un créneau scan est sélectionné et confirmé : remplir `window.__pendingScanSlot`, afficher `scanSlotSelected`, révéler `scanPaymentSection` (comportement actuel conservé)

#### 4d. Supprimer le listener Calendly postMessage

- **Supprimer** tout le bloc `window.addEventListener('message', ...)` qui écoute `calendly.com` (lignes ~5100-5120)
- **Supprimer** la fonction `handleAppointmentConfirmed` qui parse le payload Calendly
- **Conserver** `checkAppointmentStatus()` (polling Supabase) et `hydratePendingScanAppointment()` — ils restent utiles pour le rechargement de page

---

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `netlify/functions/get-available-slots.js` | **Créer** |
| `netlify/functions/book-appointment.js` | **Réécrire** (webhook Calendly → POST direct) |
| `netlify/functions/book-scan.js` | **Modifier** (ajouter vérification conflit, supprimer ref Calendly) |
| `espace-client.html` | **Modifier** (remplacer iframes Calendly par composant natif) |

## Fichiers à NE PAS modifier

- `_client-pipeline.js` — déjà à jour
- `confirm-appointment.js` — pas impacté
- `confirm-scan.js` — pas impacté
- `create-checkout.js` — pas impacté
- `webhook-stripe.js` — pas impacté
- `invite-scan.js` — pas impacté

---

## Dépendances

Aucune nouvelle dépendance npm. Le composant calendrier est en vanilla JS/HTML/CSS.

---

## Plan de test

1. **get-available-slots** :
   - `GET ?type=phone_call&from=2026-03-29&to=2026-04-05` → liste de créneaux 30 min, lun-sam 8h-20h
   - `GET ?type=scan_3d&from=2026-03-30&to=2026-05-28` → 2 créneaux/jour (matin + après-midi)
   - Insérer un faux appointment dans Supabase → vérifier que le créneau correspondant revient `available: false`
   - Appel sans `type` → `400`

2. **book-appointment** (nouvelle version) :
   - POST avec Identity + créneau libre → `200`, appointment créé
   - POST avec créneau déjà pris → `409`
   - POST sans Identity → `401`
   - POST avec mauvais clientId → `404`

3. **book-scan** :
   - POST avec créneau libre → `200`, durée forcée à 240 min
   - POST avec créneau déjà pris → `409`
   - Vérifier que `notes` ne mentionne plus Calendly

4. **Frontend** :
   - Ouvrir espace-client avec un compte `onboarding_completed` → voir le sélecteur de date téléphonique (pas d'iframe Calendly)
   - Cliquer sur une date → créneaux chargés, indisponibles grisés
   - Sélectionner un créneau → bouton "Confirmer" apparaît
   - Confirmer → RDV créé, carte de confirmation affichée
   - Ouvrir espace-client avec un compte `call_done` → voir le sélecteur scan 3D avec créneaux matin/après-midi
   - Aucune trace de `calendly.com` dans le code source chargé

5. **Vérification finale** :
   - `node --check` passe sur toutes les functions modifiées/créées
   - Aucune référence à `calendly.com` restante dans `espace-client.html`
   - Aucune info personnelle (nom, email, client_id) dans la réponse de `get-available-slots`

---

## Hypothèses retenues

- La table `appointments` Supabase a au minimum les colonnes : `id`, `client_id`, `type`, `status`, `scheduled_at`, `duration_minutes`, `location`, `notes`, `created_at`
- Aucune synchronisation Google Calendar dans ce sprint (sera ajoutée dans un sprint ultérieur)
- Les jours fériés ne sont pas bloqués automatiquement (gestion manuelle prévue plus tard)
- Le composant calendrier n'utilise aucune librairie externe (pas de flatpickr, pas de FullCalendar)
- Le fuseau horaire de référence est `Europe/Paris` côté serveur et côté affichage client
