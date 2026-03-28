# Sprint 4 — Fix : Simplifier le sélecteur de RDV (date + créneaux + bouton)

## Contexte

Le calendrier grille mensuel installé au Sprint 4 affiche "Aucun créneau" sur le mois courant (créneaux passés) et "Failed to load appointments" (erreur réseau ou Supabase). L'UX est confuse. On simplifie.

## Objectif

Remplacer le composant `createNativeBookingCalendar` par un sélecteur en 3 étapes simples :

1. **Champ date** (`<input type="date">`) — le client choisit un jour
2. **Créneaux disponibles** — affichés automatiquement après sélection de la date
3. **Bouton "Confirmer ce créneau"** — crée le RDV dans Supabase

Le backend (`get-available-slots.js`, `book-appointment.js`, `book-scan.js`, `_appointment-utils.js`) reste **inchangé**. Seul le frontend `espace-client.html` est modifié.

---

## Spécifications frontend

### Composant réutilisable `SlotPicker`

Créer une fonction JS `createSlotPicker(containerId, options)` qui génère dans le conteneur ciblé :

#### Étape 1 : sélection de date

```html
<label>Choisissez une date</label>
<input type="date" min="..." max="..." />
```

- `min` = aujourd'hui (pour phone_call) ou demain (pour scan_3d)
- `max` = aujourd'hui + 30 jours (phone_call) ou + 60 jours (scan_3d)
- Désactiver les dimanches via JS (listener `change` qui refuse les dimanches et affiche un message "Les dimanches ne sont pas disponibles")

#### Étape 2 : affichage des créneaux

Quand le client sélectionne une date valide, appeler :
```
GET /.netlify/functions/get-available-slots?type={type}&from={date}&to={date}
```

Puis afficher les créneaux du jour sous forme de **boutons en ligne** :

- **Pour `phone_call`** : boutons "08:00", "08:30", "09:00"... "19:30"
  - Vert (`background: #2D5F3E; color: #fff`) = disponible
  - Gris (`background: #E8E8E8; color: #999; cursor: not-allowed`) = indisponible
  - Tooltip sur indisponible : `title="Ce créneau est déjà réservé"`

- **Pour `scan_3d`** : seulement 2 boutons
  - "Matin (8h - 12h)"
  - "Après-midi (14h - 18h)"
  - Même style vert/gris

Quand le client clique sur un créneau disponible :
- Le bouton passe en surbrillance (`background: #1A3D28; outline: 2px solid #2D5F3E`)
- Un **résumé** apparaît en dessous : "Créneau sélectionné : [date] à [heure]"
- Un **bouton de confirmation** apparaît : "✓ Confirmer ce rendez-vous"

#### Étape 3 : confirmation

Au clic sur "Confirmer ce rendez-vous" :
1. Désactiver le bouton (éviter double-clic), afficher un spinner/texte "Réservation en cours..."
2. Appeler `POST /.netlify/functions/book-appointment` (téléphone) ou `POST /.netlify/functions/book-scan` (scan) avec le token Netlify Identity
3. **Si `200`** : afficher une carte de confirmation verte "✓ Votre rendez-vous est confirmé — [date] à [heure]". Masquer le sélecteur.
4. **Si `409`** : afficher un message "Ce créneau vient d'être réservé. Veuillez en choisir un autre." et recharger les créneaux du jour
5. **Si autre erreur** : afficher un message rouge avec le texte d'erreur

#### Gestion d'erreur réseau

Si l'appel à `get-available-slots` échoue :
- Afficher un message clair : "Impossible de charger les créneaux. Veuillez réessayer." avec un bouton "Réessayer"
- Ne PAS afficher "Failed to load appointments" — c'est un message technique, pas un message client

### Options du composant

```js
createSlotPicker('phoneBookingContainer', {
  type: 'phone_call',
  onBooked: function(appointment) {
    // callback après confirmation réussie
    // mettre à jour l'UI (ex : afficher appointmentStatusCard, recharger les RDV)
  }
});

createSlotPicker('scanBookingContainer', {
  type: 'scan_3d',
  onBooked: function(appointment) {
    // callback pour révéler scanPaymentSection, remplir __pendingScanSlot, etc.
  }
});
```

### Intégration dans `espace-client.html`

#### Section RDV téléphonique (`appointmentBookingSection` et `phone-rdv-planning`)

- Supprimer le composant `createNativeBookingCalendar` des deux zones
- Remplacer par `createSlotPicker('phoneBookingCalendarPrimary', { type: 'phone_call', onBooked: ... })`
- Le callback `onBooked` doit :
  - Afficher `appointmentStatusCard` avec date/heure
  - Appeler `checkAppointmentStatus()` pour rafraîchir la vue

#### Section RDV scan 3D (`scanBookingSection`)

- Supprimer le composant `createNativeBookingCalendar` de la zone scan
- Remplacer par `createSlotPicker('scanBookingCalendar', { type: 'scan_3d', onBooked: ... })`
- Le callback `onBooked` doit :
  - Remplir `window.__pendingScanSlot` et `window.__pendingScanAppointmentId`
  - Afficher `scanSlotSelected` avec les détails du créneau
  - Révéler `scanPaymentSection`

### CSS

Garder la palette existante :
- Vert principal : `#2D5F3E`
- Fond clair : `#FBFAF7`
- Texte doux : `#5A5A5A`
- Bordures : `#E8E8E8`
- Erreur : `#C62828`

Le `<input type="date">` doit avoir :
```css
width: 100%;
max-width: 300px;
padding: 12px 16px;
border: 1px solid #E8E8E8;
border-radius: 6px;
font-size: 1rem;
```

Les boutons créneaux :
```css
display: inline-flex;
padding: 10px 18px;
border-radius: 6px;
margin: 4px;
font-size: 0.9rem;
border: none;
cursor: pointer;
```

Le bouton "Confirmer" :
```css
width: 100%;
background: #2D5F3E;
color: #fff;
border: none;
padding: 16px 24px;
border-radius: 6px;
font-size: 0.95rem;
font-weight: 600;
cursor: pointer;
margin-top: 16px;
```

---

## Nettoyage

- **Supprimer** la fonction `createNativeBookingCalendar` et tout son code associé (rendering grille, navigation mois, etc.)
- **Supprimer** le CSS `.native-slot-grid`, `.native-slot-btn`, etc.
- **Supprimer** `initNativeBookingCalendars()` et son appel
- **Conserver** : `checkAppointmentStatus()`, `hydratePendingScanAppointment()`, `applyScanSlotDisplay()`, `revealScanPaymentSection()`, `initiateScanPayment()`

---

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `espace-client.html` | **Modifier** (remplacer calendrier grille par SlotPicker) |

## Fichiers à NE PAS modifier

Toutes les Netlify Functions restent inchangées.

---

## Plan de test

1. Ouvrir espace-client avec un compte en `onboarding_completed`
2. Voir le champ date dans la section RDV téléphonique
3. Sélectionner une date dans le futur (lun-sam) → créneaux 30 min affichés
4. Sélectionner un dimanche → message "Les dimanches ne sont pas disponibles"
5. Cliquer sur un créneau disponible → résumé + bouton "Confirmer"
6. Confirmer → RDV créé, carte de confirmation affichée
7. Tester avec un compte en `call_done` → voir le SlotPicker scan avec 2 créneaux (matin/après-midi)
8. Confirmer un scan → `__pendingScanSlot` rempli, section paiement affichée
9. Tester une erreur réseau (couper le WiFi) → message "Impossible de charger les créneaux" + bouton Réessayer
10. `node --check` n'est pas applicable ici (HTML), mais vérifier qu'il n'y a pas d'erreur dans la console du navigateur
