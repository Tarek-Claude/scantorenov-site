# Prompt Codex — Sprint 1 Finalization (A-1, A-2, A-3, A-4)

**Destinataire:** Codex / ChatGPT
**Contexte:** ScantoRenov application, Sprint 1 corrections + UX inscription
**Statut:** Sprint 0 (schema v3) deployé avec succès
**Durée estimée:** 1-2 jours

---

## Stack technique

**Frontend:** HTML/CSS/JS vanilla (pas de framework, pas de bundler)
**Backend:** Netlify Functions (Node 18)
**Base de données:** Supabase PostgreSQL
**Auth:** Netlify Identity
**Email:** Resend API (contact@scantorenov.com)
**Captcha:** Cloudflare Turnstile (RGPD)

**Convention de code:**
- Fichiers HTML: utiliser `var` dans les `<script>` inline (compatibilité)
- Netlify Functions: utiliser `const`/`let` (Node 18)
- Emails via Resend: `new Resend(process.env.RESEND_API_KEY)`
- Supabase client: `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`

---

## A-1 | Corriger erreurs de caracteres dans les objets des emails

**Fichier:** `netlify/functions/contact.js`

### Sous-tâches

**A-1a:** Identifier et corriger les caracteres corrompus UTF-8
- Ligne 78: remplacer `\u00e2\u20ac\u201c` par `\u2013` (tiret correct)
- Verifier aussi lignes 88 et 148 pour le meme probleme
- Verifie l'encodage UTF-8 du fichier entier

**A-1b:** Differencier l'objet du mail selon le type de demande
- Si formulaire: `Nouvelle demande : {Prenom Nom} – {type_bien}`
- Si demande de rappel: `Demande de rappel : {Prenom Nom} – {type_bien}`
- Envoyer vers `contact@scantorenov.com` pour l'admin dans les deux cas

**A-1c:** Test
- Envoyer un formulaire test → verifier l'objet dans le mail admin
- L'objet doit etre lisible sans caracteres etranges

### Criteres d'acceptation
- ✅ Les 2 types de mails ont des sujets distincts et lisibles
- ✅ Aucun caractere corrompu (pas de `â€` ou `ï¿`)
- ✅ Les tirets s'affichent correctement

---

## A-2 | Ajouter indicatif du numero de telephone

**Fichiers:**
- `index.html` (formulaire)
- `netlify/functions/contact.js` (envoi email)
- `espace-client.html` (affichage)

### Sous-tâches

**A-2a:** Ajouter selecteur d'indicatif dans le formulaire de contact (`index.html`)
```
Dans le formulaire contactForm, avant le champ telephone:
- Ajouter <select id="countryCode">
- Options: +33 (France, defaut), +590 (Guadeloupe), +596 (Martinique), +594 (Guyane), +262 (Reunion), +377 (Monaco), +32 (Belgique), +41 (Suisse), +352 (Luxembourg)
- Stocker la valeur dans une variable `var indicatif = document.getElementById('countryCode').value`
```

**A-2b:** Transmettre l'indicatif dans les donnees du formulaire
- Ajouter `indicatif: indicatif` aux donnees du formulaire JSON envoyes vers `contact.js`
- Exemple: `{ email: '...', telephone: '...', indicatif: '+33', ... }`

**A-2c:** Afficher le numero complet avec indicatif dans les emails
- Dans `contact.js`, construire le numero complet: `const fullPhone = request.body.indicatif + request.body.telephone`
- Afficher `fullPhone` dans les templates email admin ET client au lieu de juste `telephone`

**A-2d:** Stocker l'indicatif dans Supabase
- Ajouter l'indicatif aux donnees INSERT vers `supabase` dans `contact.js`
- Colonne deja creee par Sprint 0: `clients.indicatif`

**A-2e:** Test
- Remplir le formulaire avec indicatif = "+590" et numero "123456789"
- Verifier que les emails affichent "+590 123456789"
- Verifier dans l'espace client que le numero inclut l'indicatif

### Criteres d'acceptation
- ✅ Le selecteur d'indicatif s'affiche dans `index.html`
- ✅ Le numero affiche dans les emails = indicatif + telephone
- ✅ L'indicatif est stocke dans `clients.indicatif`
- ✅ L'espace client affiche le numero complet

---

## A-3 | Toggle visibilite mot de passe lors de la creation de compte

**Fichier:** `connexion.html`

### Sous-tâches

**A-3a:** Ajouter icone oeil (toggle) sur les 3 champs mot de passe
- `#loginPass` (formulaire connexion)
- `#signupPass` (formulaire inscription)
- `#signupPassConfirm` (confirmation mot de passe)

Structure HTML a ajouter pour chaque input password:
```html
<div style="position: relative;">
  <input type="password" id="signupPass" ... />
  <span class="password-toggle" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer;">👁</span>
</div>
```

**A-3b:** Implementer le toggle en JS vanilla
```javascript
var toggles = document.querySelectorAll('.password-toggle');
toggles.forEach(function(toggle) {
  toggle.addEventListener('click', function() {
    var input = this.previousElementSibling;
    if (input.type === 'password') {
      input.type = 'text';
      this.textContent = '👁‍🗨'; // oeil barre
    } else {
      input.type = 'password';
      this.textContent = '👁'; // oeil ouvert
    }
  });
});
```

**A-3c:** CSS pour positionner l'icone
- Position absolute dans un conteneur relatif
- Couleur: utiliser variables CSS existantes (`--green` pour hover, `--muted` pour defaut)
- Font-size: 18px
- Padding: 8px

**A-3d:** Ajouter indicateur de force du mot de passe sous `#signupPass`
```
Ajouter apres #signupPass:
- <div id="passwordStrength" style="margin-top: 5px;">
  - Barre de progression: <div style="height: 4px; background: #ccc; width: 100%;"></div>
  - Indicateur couleur: rouge (faible) → orange (moyen) → vert (fort)
  - Texte: "Faible" / "Moyen" / "Fort"

Criteres de force:
- Min 8 caracteres: +1 point
- 1 majuscule: +1 point
- 1 chiffre: +1 point
- 1 caractere special (!@#$%^&*): +1 point

Forte = 4 points, Moyen = 2-3 points, Faible < 2 points
```

Implémenter la verification a chaque keystroke:
```javascript
var passwordInput = document.getElementById('signupPass');
passwordInput.addEventListener('keyup', function() {
  var strength = 0;
  if (this.value.length >= 8) strength++;
  if (/[A-Z]/.test(this.value)) strength++;
  if (/\d/.test(this.value)) strength++;
  if (/[!@#$%^&*]/.test(this.value)) strength++;

  var level = strength < 2 ? 'Faible' : strength < 4 ? 'Moyen' : 'Fort';
  var color = strength < 2 ? '#d32f2f' : strength < 4 ? '#ff9800' : '#4caf50';

  var bar = document.querySelector('#passwordStrength div:first-child');
  bar.style.background = color;
  bar.style.width = (strength * 25) + '%';
  document.getElementById('passwordStrengthText').textContent = level;
});
```

### Criteres d'acceptation
- ✅ Icone oeil toggle show/hide sur les 3 champs password
- ✅ Icone change visuellement (oeil ouvert ↔ oeil barre)
- ✅ Indicateur de force s'affiche et change couleur en temps reel
- ✅ CSS coherent avec design existant (couleurs, spacing)

---

## A-4 | Captcha pour valider l'ouverture du compte

**Fichiers:**
- `connexion.html` (frontend)
- `netlify/functions/verify-captcha.js` (nouveau, backend)

### Prerequisites
- Creer un compte Cloudflare Turnstile: https://dash.cloudflare.com/turnstile
- Obtenir: `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY`
- Ajouter a Netlify environment variables

### Sous-tâches

**A-4a:** Integrer Cloudflare Turnstile dans `connexion.html`
```
1. Ajouter dans le <head>:
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

2. Dans le #signupForm, avant le bouton submit:
   <div class="cf-turnstile"
        data-sitekey="VOTRE_SITE_KEY"
        data-theme="light"
        style="margin: 15px 0;"></div>

Note: VOTRE_SITE_KEY sera remplacee par process.env.TURNSTILE_SITE_KEY au runtime
```

**A-4b:** Bloquer la soumission tant que le token n'est pas present
```javascript
var handleSignup = function() {
  // ... autres validations ...

  var turnstileToken = document.querySelector('[name="cf-turnstile-response"]');
  if (!turnstileToken || !turnstileToken.value) {
    errEl.textContent = 'Veuillez completer la verification de securite.';
    errEl.style.display = 'block';
    btn.textContent = 'Creer mon compte →';
    btn.disabled = false;
    return;
  }

  // Continuer avec la creation de compte
  // Passer le token au serveur
  var formData = {
    email: emailVal,
    password: passwordVal,
    // ...
    turnstileToken: turnstileToken.value
  };
};
```

**A-4c:** Creer nouvelle fonction Netlify: `netlify/functions/verify-captcha.js`
```javascript
const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { token } = JSON.parse(event.body);
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: JSON.stringify({ response: token, secret: secretKey })
    });

    const data = await response.json();

    if (data.success) {
      return { statusCode: 200, body: JSON.stringify({ verified: true }) };
    } else {
      return { statusCode: 400, body: JSON.stringify({ verified: false, error: 'Captcha verification failed' }) };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
```

**A-4d:** Modifier `handleSignup()` pour verifier le captcha cote serveur AVANT signup
```javascript
// 1. Verifier captcha d'abord
var response = await fetch('/.netlify/functions/verify-captcha', {
  method: 'POST',
  body: JSON.stringify({ token: turnstileToken.value })
});

var captchaResult = await response.json();
if (!captchaResult.verified) {
  errEl.textContent = 'Verification de securite echouee. Veuillez reessayer.';
  errEl.style.display = 'block';
  btn.textContent = 'Creer mon compte →';
  btn.disabled = false;
  return;
}

// 2. Captcha OK, appeler signup
var signupResponse = await fetch('/.netlify/functions/identity-signup', {
  method: 'POST',
  // ... credentials ...
});
```

**A-4e:** Variables d'environnement Netlify
Ajouter a `.env.local` et dans la config Netlify:
```
TURNSTILE_SITE_KEY=<la cle publique>
TURNSTILE_SECRET_KEY=<la cle secrete>
```

### Criteres d'acceptation
- ✅ Captcha invisible s'affiche dans le formulaire d'inscription
- ✅ Soumission bloquee sans verification reussie
- ✅ Les vrais utilisateurs voient le captcha mais n'ont pas a resoudre de puzzle
- ✅ Les bots sont rejetes
- ✅ Experience utilisateur fluide (pas de trop de friction)

---

## Validation globale Sprint 1

Une fois A-1, A-2, A-3, A-4 termines:

**Test complet du parcours:**
1. Remplir le formulaire de contact avec:
   - Email, prenom, nom
   - Telephone + indicatif different
   - Type de bien, details
2. Verifier que le mail admin arrive avec:
   - Sujet correct et sans caracteres corrompus
   - Numero complet avec indicatif
3. Cliquer sur le lien d'inscription
4. Dans le formulaire d'inscription:
   - Voir le selecteur d'indicatif
   - Tester le toggle du mot de passe (3 fois)
   - Voir l'indicateur de force
   - Voir le captcha Turnstile
5. Remplir et soumettre → verification captcha → creation de compte
6. Login → acces a l'espace client
7. Verifier que le numero affiche dans l'espace client inclut l'indicatif

**Criteres finaux:**
- ✅ Tous les mails s'affichent correctement (sans encoding issues)
- ✅ Formulaire d'inscription fluide et intuitive
- ✅ Captcha ne bloque pas les vrais utilisateurs
- ✅ Pipeline de creation de compte fonctionne de bout en bout

---

## Notes pour Codex

- Pas de refactoring au-dela du scope. On reste strict sur ces 4 taches.
- Garder la structure HTML/CSS existante, ajouter juste ce qui est necessaire.
- Tous les fichiers doivent rester en UTF-8 avec encoding correct.
- Tester sur Chrome + Firefox si possible.
- Si des variables d'environnement manquent, signaler a Claude/Tarek avant de continuer.

Bon courage! 🚀
