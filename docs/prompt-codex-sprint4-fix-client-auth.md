# Sprint 4 Fix: Ajouter l'authentification client avant SlotPicker

## Problème
Le formulaire de réservation affiche "Identifiant client manquant" car le `SlotPicker` n'a pas accès à l'ID du client. Il faut d'abord **identifier le client** avant de lui permettre de choisir un créneau.

## Solution
Intégrer **Netlify Identity** pour identifier le client au chargement de la page espace-client, puis passer son ID au SlotPicker.

## Travail à faire

### 1. Charger et vérifier l'authentification au démarrage
- Au chargement de `espace-client.html`, appeler `netlify-identity` pour récupérer l'utilisateur connecté
- Si pas d'utilisateur connecté → afficher un **formulaire de login simple** (email + password)
- Si utilisateur connecté → récupérer son ID dans `user.id` (Netlify Identity user ID)
- Chercher/créer le `client` correspondant dans Supabase via `user.email`

### 2. Modifier le SlotPicker
- Ajouter un paramètre `clientId` au `createSlotPicker()`
- Passer le `clientId` Supabase dans chaque appel API (`book-appointment`, `book-scan`)
- Utiliser cet ID au lieu de le laisser vide

### 3. Intégration Netlify Identity
```javascript
// Au démarrage
netlifyIdentity.init();
netlifyIdentity.open('login'); // ou 'signup'

netlifyIdentity.on('login', (user) => {
  // user.email, user.id, user.user_metadata
  // Chercher le client par email dans Supabase
  // Passer clientId au SlotPicker
});
```

### 4. Rechercher/créer le client
- Query Supabase : `SELECT id FROM clients WHERE email = user.email`
- Si pas trouvé → créer un nouveau client avec `INSERT`
- Passer le `client.id` au SlotPicker et aux fonctions de booking

## Résultat attendu
- Page charge avec un formulaire de login si pas d'utilisateur
- Une fois connecté, le SlotPicker s'affiche avec l'ID client valide
- Les réservations s'enregistrent sans erreur "Identifiant client manquant"

## Fichiers à modifier
- `espace-client.html` : ajouter la logique d'auth + passer clientId au SlotPicker
