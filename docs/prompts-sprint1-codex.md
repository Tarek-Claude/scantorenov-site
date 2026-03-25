# Prompts Sprint 1 — Codex / ChatGPT

> Projet: ScantoRenov
> Sprint 1: Corrections immediates + UX inscription
> Workflow: copier-coller chaque prompt dans Codex. Valider le code genere avant de commiter.

---

## PROMPT SYSTEME (a utiliser pour toutes les taches du Sprint 1)

```
Tu es un developpeur frontend/backend senior travaillant sur le projet ScantoRenov, une plateforme de renovation immobiliere.

STACK TECHNIQUE:
- Frontend: HTML/CSS/JS vanilla (PAS de framework, PAS de bundler, PAS de TypeScript)
- Backend: Netlify Functions (Node 18, CommonJS avec require/exports)
- BDD: Supabase (PostgreSQL), client JS via @supabase/supabase-js
- Auth: Netlify Identity (widget + API directe)
- Email: Resend (@resend/resend, expediteur contact@scantorenov.com)
- Deploiement: Netlify (auto-deploy sur git push)

CONVENTIONS DE CODE:
- Dans les fichiers HTML inline <script>: utiliser var (PAS const/let) pour compatibilite navigateur
- Dans les Netlify Functions (.js): utiliser const/let (Node 18)
- Encodage: UTF-8 partout. Les caracteres francais (e accent, c cedille, tiret cadratin) doivent etre en UTF-8 natif, PAS en entites HTML dans le JS
- Emails Resend: HTML inline dans les template literals, style inline (pas de CSS externe)
- Design: palette verte (#2D5F3E principal, #3A7A50 hover, #F5F2ED fond, #2A2A2A texte)
- Police: Inter pour le corps, Cormorant Garamond pour les titres, Space Grotesk pour le logo

STRUCTURE DU PROJET:
/
├── index.html              (landing page + formulaire de contact)
├── connexion.html          (page login/signup)
├── espace-client.html      (dashboard client)
├── netlify/functions/
│   ├── contact.js          (envoi emails via Resend apres formulaire)
│   ├── _client-pipeline.js (gestion statuts pipeline Supabase)
│   ├── identity-signup.js  (webhook creation compte)
│   └── ...
├── netlify.toml
└── .env

REGLES IMPORTANTES:
- Ne jamais modifier la structure globale des fichiers
- Ne jamais ajouter de dependances npm sans demander
- Toujours garder le style visuel coherent avec l'existant
- Les textes visibles par l'utilisateur sont en francais
- Ne jamais hardcoder de cles API dans le code source
```

---

## TACHE A-1 — Corriger erreurs de caracteres dans les emails

```
CONTEXTE:
Le fichier netlify/functions/contact.js envoie 2 emails via Resend apres soumission du formulaire de contact:
1. Un email admin (vers scantorenov@gmail.com) — notification de nouvelle demande
2. Un email client — bienvenue + lien creation espace

PROBLEME:
Les caracteres speciaux (tirets cadratins, accents) dans les sujets et corps des emails presentent parfois des erreurs d'encodage UTF-8 (caracteres corrompus type "â€"" au lieu de "–").

De plus, il n'y a actuellement qu'un seul format de sujet pour le mail admin, quelle que soit la nature de la demande (contact classique ou demande de rappel telephonique).

FICHIER A MODIFIER: netlify/functions/contact.js

TACHE:
1. Verifier et corriger l'encodage UTF-8 sur ces 3 zones:
   - Ligne 78: sujet du mail admin → doit etre: `Nouvelle demande : ${fullName} – ${data.type_bien}`
   - Ligne 88: dans le tableau HTML → `${data.type_bien} – ${data.precision}`
   - Ligne 148: footer → `Scantorenov – Précision d'intérieur`
   S'assurer que le tiret cadratin est bien le caractere Unicode U+2013 (–) et PAS une sequence corrompue.

2. Differencier le sujet du mail admin selon le type de demande:
   - Le champ `data.demande` contient le texte de la demande.
   - Si le champ `data.demande` contient les mots "rappel" ou "rendez-vous" ou "rdv" ou "téléphone" (insensible a la casse), utiliser le sujet:
     `Demande de rappel : ${fullName} – ${data.type_bien}`
   - Sinon, garder le sujet actuel:
     `Nouvelle demande : ${fullName} – ${data.type_bien}`

3. NE PAS modifier le reste de la logique (upsertClientPipeline, signupUrl, structure HTML des emails).

VOICI LE CODE ACTUEL COMPLET DE contact.js:

const { Resend } = require('resend');
const { upsertClientPipeline } = require('./_client-pipeline');

const resend = new Resend(process.env.RESEND_API_KEY);

const SITE_URL = process.env.DEPLOY_URL || 'https://scantorenov.com';

function getSignupUrl(data) {
  const params = [
    'email=' + encodeURIComponent(data.email),
    'full_name=' + encodeURIComponent([data.genre, data.prenom, data.nom].filter(Boolean).join(' ').trim()),
    'telephone=' + encodeURIComponent(data.telephone),
    'adresse=' + encodeURIComponent(data.adresse),
    'type_bien=' + encodeURIComponent(data.type_bien),
    'demande=' + encodeURIComponent(data.demande || ''),
    'qualite=' + encodeURIComponent(data.qualite),
    'budget=' + encodeURIComponent(data.budget),
    'surface=' + encodeURIComponent(data.surface),
    'echeance=' + encodeURIComponent(data.echeance),
    'precision=' + encodeURIComponent(data.precision)
  ];

  return `${SITE_URL}/connexion.html#inscription&${params.join('&')}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const params = new URLSearchParams(event.body);
    const data = {
      genre: params.get('genre') || '',
      prenom: (params.get('prenom') || '').trim(),
      nom: (params.get('nom') || '').trim(),
      email: (params.get('email') || '').trim(),
      telephone: (params.get('telephone') || '').trim(),
      adresse: (params.get('adresse') || '').trim(),
      qualite: params.get('qualite') || '',
      type_bien: params.get('type_bien') || params.get('typeBien') || '',
      precision: params.get('precision') || '',
      surface: params.get('surface') || '',
      echeance: params.get('echeance') || '',
      budget: params.get('budget') || '',
      demande: params.get('demande') || params.get('message') || '',
      message: params.get('message') || ''
    };

    const fullName = [data.genre, data.prenom, data.nom].filter(Boolean).join(' ').trim();

    try {
      await upsertClientPipeline({
        email: data.email,
        status: 'new_lead',
        fields: {
          genre: data.genre || null,
          prenom: data.prenom || null,
          nom: data.nom || null,
          telephone: data.telephone || null,
          phone: data.telephone || null,
          adresse: data.adresse || null,
          type_bien: data.type_bien || null,
          project_type: data.type_bien || null,
          demande: data.demande || null,
          project_details: data.demande || null,
          budget: data.budget || null,
          echeance: data.echeance || null
        }
      });
    } catch (pipelineError) {
      console.error('[PIPELINE] Contact sync error:', pipelineError.message);
    }

    // ... (suite: envoi des 2 emails)
  } catch (error) {
    // ...
  }
};

LIVRABLE: le fichier contact.js complet modifie, pret a commiter.
```

---

## TACHE A-2 — Ajouter indicatif du numero de telephone dans les emails

```
CONTEXTE:
Le formulaire de contact dans index.html contient DEJA un selecteur d'indicatif telephonique:
- Champ select: name="indicatif", id="indicatif", class="phone-prefix"
- Options: +33 (defaut), +32, +41, +352, +377, +590, +596, +594, +262, +225, +221
- Champ tel: name="telephone"

L'indicatif est DEJA transmis dans les donnees du formulaire (FormData → URLSearchParams).

PROBLEME:
Le fichier netlify/functions/contact.js ne recupere PAS l'indicatif et ne l'affiche PAS dans les emails.
Le fichier espace-client.html n'affiche pas non plus l'indicatif.

FICHIER A MODIFIER: netlify/functions/contact.js

TACHE:
1. Dans contact.js, ajouter la recuperation de l'indicatif:
   Dans l'objet `data` (vers ligne 33-48), ajouter:
   indicatif: params.get('indicatif') || '+33',

2. Dans le mail admin (vers ligne 85), afficher le numero complet avec indicatif:
   Remplacer: ${data.telephone}
   Par: ${data.indicatif} ${data.telephone}

3. Dans le mail client, le numero n'est pas affiche actuellement — pas de changement necessaire.

4. Dans le bloc upsertClientPipeline (vers ligne 52-69), ajouter l'indicatif dans les fields:
   indicatif: data.indicatif || '+33',

   Note: la colonne `indicatif` existe deja dans Supabase (ajoutee par Sprint 0).

5. Dans la fonction getSignupUrl (vers ligne 8-24), ajouter l'indicatif aux params:
   'indicatif=' + encodeURIComponent(data.indicatif),

NE PAS MODIFIER index.html (l'indicatif est deja present dans le formulaire).

LIVRABLE: le fichier contact.js complet modifie, pret a commiter.
```

---

## TACHE A-3 — Toggle visibilite mot de passe + indicateur de force

```
CONTEXTE:
Le fichier connexion.html contient 2 formulaires:
1. Login (#loginForm) avec 1 champ password: #loginPass
2. Signup (#signupForm) avec 2 champs password: #signupPass et #signupPassConfirm

L'utilisateur ne peut pas verifier sa saisie de mot de passe.

FICHIER A MODIFIER: connexion.html

TACHE:

1. AJOUTER UNE ICONE OEIL (toggle show/hide) sur les 3 champs mot de passe.

   Pour chaque champ password, wrapper le champ dans un conteneur relatif et ajouter un bouton oeil:

   HTML pour chaque champ (remplacer le <input> existant):
   <div class="pw-wrapper">
     <input type="password" class="f-input" id="loginPass" placeholder="••••••••" required />
     <button type="button" class="pw-toggle" onclick="togglePw(this)" aria-label="Afficher le mot de passe">
       <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
         <circle cx="12" cy="12" r="3"/>
       </svg>
       <svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:none;">
         <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
         <line x1="1" y1="1" x2="23" y2="23"/>
       </svg>
     </button>
   </div>

   Appliquer la meme structure aux 3 champs: #loginPass, #signupPass, #signupPassConfirm.

2. AJOUTER LE CSS (dans le bloc <style> existant):

   .pw-wrapper {
     position: relative;
   }
   .pw-wrapper .f-input {
     padding-right: 44px;
   }
   .pw-toggle {
     position: absolute;
     right: 12px;
     top: 50%;
     transform: translateY(-50%);
     background: none;
     border: none;
     cursor: pointer;
     color: var(--muted);
     padding: 4px;
     display: flex;
     align-items: center;
   }
   .pw-toggle:hover {
     color: var(--green);
   }

   /* Indicateur de force */
   .pw-strength {
     height: 4px;
     border-radius: 2px;
     background: var(--border);
     margin-top: 8px;
     overflow: hidden;
   }
   .pw-strength-bar {
     height: 100%;
     width: 0%;
     border-radius: 2px;
     transition: width 0.3s, background 0.3s;
   }
   .pw-strength-text {
     font-size: 0.7rem;
     margin-top: 4px;
     color: var(--muted);
   }

3. AJOUTER L'INDICATEUR DE FORCE sous le champ #signupPass (PAS sous les autres champs).

   Apres le div.pw-wrapper du champ #signupPass, ajouter:
   <div class="pw-strength"><div class="pw-strength-bar" id="pwStrengthBar"></div></div>
   <div class="pw-strength-text" id="pwStrengthText"></div>

4. AJOUTER LE JAVASCRIPT (dans le bloc <script> existant, AVANT la fonction handleLogin):

   /* Toggle password visibility */
   function togglePw(btn) {
     var input = btn.parentElement.querySelector('input');
     var openIcon = btn.querySelector('.eye-open');
     var closedIcon = btn.querySelector('.eye-closed');
     if (input.type === 'password') {
       input.type = 'text';
       openIcon.style.display = 'none';
       closedIcon.style.display = 'block';
     } else {
       input.type = 'password';
       openIcon.style.display = 'block';
       closedIcon.style.display = 'none';
     }
   }

   /* Password strength indicator */
   var signupPassEl = document.getElementById('signupPass');
   if (signupPassEl) {
     signupPassEl.addEventListener('input', function() {
       var val = this.value;
       var score = 0;
       if (val.length >= 8) score++;
       if (/[A-Z]/.test(val)) score++;
       if (/[0-9]/.test(val)) score++;
       if (/[^A-Za-z0-9]/.test(val)) score++;

       var bar = document.getElementById('pwStrengthBar');
       var text = document.getElementById('pwStrengthText');
       var levels = [
         { width: '0%', color: 'transparent', label: '' },
         { width: '25%', color: '#e74c3c', label: 'Faible' },
         { width: '50%', color: '#f39c12', label: 'Moyen' },
         { width: '75%', color: '#27ae60', label: 'Bon' },
         { width: '100%', color: '#2D5F3E', label: 'Fort' }
       ];
       var level = val.length === 0 ? levels[0] : levels[score] || levels[1];
       bar.style.width = level.width;
       bar.style.background = level.color;
       text.textContent = level.label;
       text.style.color = level.color;
     });
   }

IMPORTANT:
- Utiliser var (pas const/let) dans le JS inline
- Les SVG doivent etre inline (pas de fichier externe)
- Ne pas modifier la logique de handleLogin, handleSignup, ou showLogin
- Garder le style coherent avec le design existant

LIVRABLE: le fichier connexion.html complet modifie, pret a commiter.
```

---

## TACHE A-4 — Captcha Cloudflare Turnstile pour l'inscription

```
CONTEXTE:
Le fichier connexion.html contient un formulaire d'inscription (#signupForm) qui appelle handleSignup().
La creation de compte n'est pas protegee contre les bots.

PREREQUIS:
- Creer un site Cloudflare Turnstile sur https://dash.cloudflare.com/turnstile
- Obtenir: TURNSTILE_SITE_KEY et TURNSTILE_SECRET_KEY
- Ajouter TURNSTILE_SECRET_KEY dans .env et dans les variables d'environnement Netlify

FICHIERS A MODIFIER:
1. connexion.html (widget frontend + validation)
2. Nouveau fichier: netlify/functions/verify-captcha.js (verification serveur)

TACHE PARTIE 1 — connexion.html:

1. Ajouter le script Turnstile dans le <head>:
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

2. Dans le formulaire #signupForm, AVANT le bouton submit, ajouter:
   <div class="cf-turnstile" data-sitekey="0x4AAAAAACwcr3yjgnalefD8" data-theme="light" data-language="fr" style="margin-bottom:12px;"></div>

3. Dans la fonction handleSignup(), APRES la verification que les mots de passe correspondent (ligne ~338) et AVANT l'appel fetch signup (ligne ~347), ajouter la verification du captcha:

   // Verification captcha Turnstile
   var turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
   if (!turnstileResponse || !turnstileResponse.value) {
     errEl.textContent = 'Veuillez completer la verification de securite.';
     errEl.style.display = 'block';
     btn.textContent = 'Cr\u00e9er mon compte \u2192'; btn.disabled = false;
     return;
   }

   // Verifier le captcha cote serveur
   var captchaValid = false;
   try {
     var captchaRes = await fetch('/.netlify/functions/verify-captcha', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ token: turnstileResponse.value })
     });
     var captchaData = await captchaRes.json();
     captchaValid = captchaData.success;
   } catch (captchaErr) {
     console.warn('Captcha verification failed:', captchaErr);
   }

   if (!captchaValid) {
     errEl.textContent = 'La verification de securite a echoue. Veuillez reessayer.';
     errEl.style.display = 'block';
     btn.textContent = 'Cr\u00e9er mon compte \u2192'; btn.disabled = false;
     if (typeof turnstile !== 'undefined') turnstile.reset();
     return;
   }

   ATTENTION: handleSignup utilise actuellement des callbacks .then()/.catch(), PAS async/await.
   Il faut donc convertir handleSignup en fonction async:
   Changer: function handleSignup(e) {
   En: async function handleSignup(e) {

   Le reste de la fonction reste identique (les .then() fonctionnent aussi dans une fonction async).

TACHE PARTIE 2 — netlify/functions/verify-captcha.js (NOUVEAU FICHIER):

Creer ce fichier:

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { token } = JSON.parse(event.body);

    if (!token) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Token manquant' })
      };
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token
      }).toString()
    });

    const result = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: result.success })
    };
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Erreur interne' })
    };
  }
};

VARIABLES D'ENVIRONNEMENT A AJOUTER:
- TURNSTILE_SECRET_KEY (dans .env local et Netlify UI)
- TURNSTILE_SITE_KEY (hardcode dans le HTML, pas secret)

LIVRABLES:
1. connexion.html modifie
2. netlify/functions/verify-captcha.js (nouveau fichier)
```

---

## ORDRE D'EXECUTION RECOMMANDE

1. **A-3** (toggle mdp) — pas de dependances, modification isolee de connexion.html
2. **A-4** (captcha) — modifie aussi connexion.html, a faire apres A-3
3. **A-1** (caracteres emails) — modification isolee de contact.js
4. **A-2** (indicatif) — modifie aussi contact.js, a faire apres A-1

## CHECKLIST DE VALIDATION (pour Tarek)

Apres chaque tache, verifier:
- [ ] Le code ne contient pas de const/let dans le HTML inline
- [ ] Les caracteres francais s'affichent correctement
- [ ] Aucune cle API n'est hardcodee (sauf TURNSTILE_SITE_KEY qui est publique)
- [ ] Le style visuel est coherent avec le design existant
- [ ] Le formulaire de contact fonctionne toujours normalement
- [ ] Le formulaire d'inscription fonctionne toujours normalement
