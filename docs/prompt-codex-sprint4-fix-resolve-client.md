# Prompt Codex — Sprint 4 Fix : Résolution client via Netlify Function

## Contexte
L'espace client affiche "Identifiant client manquant" car `findOrCreateClientRecord()` tente
de lire/créer un enregistrement dans Supabase directement depuis le navigateur avec la clé
anon publique. La table `clients` a RLS activé → les requêtes échouent → `currentClientId`
reste null → la réservation ne peut pas se faire.

## 3 bugs à corriger

### Bug 1 (critique) — Résolution client via navigateur
`findOrCreateClientRecord()` dans `espace-client.html` appelle `supabaseClient` avec la clé
anon, ce qui est bloqué par RLS.

### Bug 2 (sérieux) — `initSlotPickers()` jamais appelée
La fonction est définie à la ligne ~5800 mais n'est appelée nulle part. Le registry
`slotPickers` reste vide. `setSlotPickerClientContext()` met à jour `currentClientId` mais
n'arrive pas à appeler `picker.setClientContext()` car aucun picker n'est enregistré.

### Bug 3 (mineur) — Code mort dans `showDashboard`
Un `return;` à la ligne ~3120 rend le bloc 3122–3162 inaccessible.

---

## Travail à faire

### 1. Créer `netlify/functions/resolve-client.js`

Nouvelle Netlify Function qui :
- Requiert un JWT Netlify Identity valide (`context.clientContext.user`)
- Utilise `SUPABASE_SERVICE_KEY` pour accéder à Supabase sans restriction RLS
- Cherche le client par email (`SELECT * FROM clients WHERE email = $1`)
- Si pas trouvé, crée un nouveau client minimal avec l'email
- Retourne `{ clientId: uuid, nom: string, status: string }`

```js
// netlify/functions/resolve-client.js
const { createClient } = require('@supabase/supabase-js');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const identityUser = context?.clientContext?.user;
  if (!identityUser) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const email = identityUser.email;
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email manquant' }) };

  try {
    // Chercher le client existant
    const { data: existing, error: selectError } = await supabase
      .from('clients')
      .select('id, nom, prenom, status, phase')
      .eq('email', email)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
      return { statusCode: 200, headers, body: JSON.stringify({ clientId: existing.id, nom: existing.nom, status: existing.status }) };
    }

    // Créer un nouveau client minimal
    const { data: created, error: insertError } = await supabase
      .from('clients')
      .insert([{ email, status: 'account_created', nom: email }])
      .select('id, nom, status')
      .single();

    if (insertError) throw insertError;

    return { statusCode: 200, headers, body: JSON.stringify({ clientId: created.id, nom: created.nom, status: created.status }) };

  } catch (err) {
    console.error('resolve-client error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Erreur serveur' }) };
  }
};
```

### 2. Modifier `espace-client.html` — remplacer `findOrCreateClientRecord`

Remplacer le corps de `findOrCreateClientRecord` pour appeler `/.netlify/functions/resolve-client` :

```js
async function findOrCreateClientRecord(user, meta, appMeta) {
  var token = getIdentityAccessToken();
  if (!token) return null;

  var response = await fetch('/.netlify/functions/resolve-client', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  });

  if (!response.ok) {
    var err = await response.json().catch(function() { return {}; });
    throw new Error(err.error || 'Impossible de résoudre le dossier client');
  }

  var data = await response.json();
  if (!data.clientId) throw new Error('clientId manquant dans la réponse');

  // Simuler la forme attendue par applySupabaseClientRecord
  return { id: data.clientId, nom: data.nom, status: data.status };
}
```

### 3. Corriger `requestCallback()` — appeler `initSlotPickers` au besoin

Dans la fonction `requestCallback()` (ligne ~4463), ajouter l'appel à `initSlotPickers()` :

```js
function requestCallback() {
  var btn = document.getElementById('callbackBtn');
  var planning = document.getElementById('phone-rdv-planning');
  if (!btn || !planning) return;

  btn.style.display = 'none';
  planning.style.display = 'block';
  initSlotPickers(); // ← AJOUTER : initialiser les pickers si pas encore fait
  planning.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

### 4. Appeler `initSlotPickers()` dès que le dashboard est visible

Dans `showDashboard()`, après `applyDashboardData()` (ligne ~3107), ajouter :

```js
initSlotPickers(); // initialiser les pickers avec clientId null pour l'instant
```

Puis, dans `setSlotPickerClientContext()`, s'assurer que les pickers sont initialisés avant de leur transmettre le contexte :

```js
function setSlotPickerClientContext(clientId, message) {
  if (!slotPickers) slotPickers = {};
  currentClientId = clientId || null;
  bookingClientMessage = message || '';
  initSlotPickers(); // s'assure que les pickers existent
  var pickerIds = ['phonePrimary', 'phoneSecondary', 'scan'];
  for (var i = 0; i < pickerIds.length; i++) {
    var picker = slotPickers[pickerIds[i]];
    if (picker && typeof picker.setClientContext === 'function') {
      picker.setClientContext(currentClientId, bookingClientMessage);
    }
  }
}
```

### 5. Supprimer le code mort dans `showDashboard`

Supprimer les lignes inaccessibles après le `return;` (l'ancien bloc de sync Supabase,
lignes ~3122–3162 avec les commentaires "D'abord afficher avec les données locales").

---

## Fichiers à modifier
- `netlify/functions/resolve-client.js` — CRÉER
- `espace-client.html` — MODIFIER (4 points ci-dessus)

## Test attendu
1. Login sur `espace-client.html`
2. Aucune erreur console sur la résolution client
3. Sélectionner un créneau → cliquer Confirmer → pas d'erreur "Identifiant client manquant"
4. Vérifier dans Supabase (table `appointments`) qu'un enregistrement est créé
