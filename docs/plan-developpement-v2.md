# Plan de Developpement ScantoRenov v2 - Decoupage en sous-taches

> Date: 26/03/2026
> Version: 2.0 (incluant schema relationnel + ameliorations UX)

## Architecture base de donnees

> Voir `docs/schema-v2-proposition.md` pour le detail complet.

**Principe:** 1 table maitre `clients` (identite + statut) + 5 tables satellites relationnelles.

```
clients (maitre)
  ├── appointments    (rdv tel + scan + offre)     1-to-N
  ├── call_summaries  (syntheses d'echanges)       1-to-N
  ├── payments        (paiements Stripe)           1-to-N
  ├── scans           (donnees Matterport)         1-to-N
  └── documents       (plans, photos, rapports)    1-to-N
```

**Statuts pipeline enrichis:**
```
new_lead → account_created → call_requested → call_done
→ scan_scheduled → scan_payment_completed → scan_completed
→ analysis_ready → avant_projet_ready → accompaniment_subscribed
```

---

## Sprint 0 — Prerequis techniques (1-2 jours)

### S0-1/ Migration Supabase v2 — Schema relationnel

**Assignation:** Claude Code
**Dependances:** Aucune (premier a executer)

**Sous-taches:**
- S0-1a: Creer fichier de migration `supabase/migrations/202603260001_schema_v2.sql`:
  - Ajouter `id UUID` (PK) + `indicatif` + `stripe_customer_id` + `created_at` a `clients`
  - Supprimer les colonnes doublons (`phone`, `project_type`, `project_details`, `matterport_iframe`)
  - Creer table `appointments` (id, client_id FK, type, status, scheduled_at, duration_minutes, location, notes, created_at, updated_at)
  - Creer table `call_summaries` (id, client_id FK, appointment_id FK, summary, needs[], interest_level, confirmed_budget, confirmed_surface, constraints, technical_points[], internal_notes, created_by, created_at)
  - Creer table `payments` (id, client_id FK, stripe_session_id, stripe_payment_intent, type, amount_cents, currency, status, description, paid_at, created_at)
  - Creer table `scans` (id, client_id FK, matterport_model_id, matterport_url, matterport_data JSONB, scan_date, scanned_by, observations, is_primary, created_at)
  - Creer table `documents` (id, client_id FK, scan_id FK, type, name, url, storage_path, uploaded_by, created_at)
  - Ajouter triggers `updated_at` sur appointments
  - Creer index sur les FK (client_id)
- S0-1b: Migrer les donnees existantes:
  - `call_scheduled_at` + `call_notes` → `appointments` + `call_summaries`
  - `matterport_*` → `scans`
  - `plans_urls`, `photos_urls` → `documents`
- S0-1c: Mettre a jour `docs/pipeline-v1.md` → `docs/pipeline-v2.md` avec les nouveaux statuts
- S0-1d: Mettre a jour `_client-pipeline.js` pour supporter les nouveaux statuts et les nouvelles tables

**Criteres d'acceptation:** Toutes les tables creees, donnees migrees, fonctions existantes toujours operationnelles.

---

### S0-2/ Adapter les fonctions existantes au schema v2

**Assignation:** Claude Code
**Dependances:** S0-1

**Sous-taches:**
- S0-2a: Adapter `contact.js` pour utiliser le nouveau schema (plus de doublons phone/project_type/project_details)
- S0-2b: Adapter `identity-signup.js` idem
- S0-2c: Adapter `sync-client.js` pour ecrire dans les tables satellites quand pertinent
- S0-2d: Adapter `marcel-prompt.js` pour lire depuis `call_summaries` et `scans` en plus de `clients`
- S0-2e: Adapter `notify-virtual-tour.js` pour lire/ecrire dans `scans`
- S0-2f: Adapter `espace-client.html` pour faire les JOINs necessaires (ou requetes multiples)
- S0-2g: Adapter `submit-avantprojet.js` pour lire depuis les nouvelles tables
- S0-2h: Test complet du parcours existant (formulaire → mail → inscription → espace client)

**Criteres d'acceptation:** Toutes les fonctionnalites existantes marchent identiquement avec le nouveau schema.

---

## Sprint 1 — Corrections immediates + UX inscription (1-2 jours)

### A-1/ Corriger erreurs de caracteres dans les objets des emails

**Contexte:** 2 emails recus apres test formulaire. Erreurs d'encodage UTF-8 dans les sujets.
**Fichier:** `netlify/functions/contact.js`
**Assignation:** Claude Code

**Sous-taches:**
- A-1a: Identifier et corriger les caracteres corrompus dans le sujet du mail admin (ligne 78) — verifier que le tiret cadratin `–` s'affiche correctement
- A-1b: Differencier l'objet du mail 1 (formulaire de contact classique) et du mail 2 (demande de rappel telephonique). Actuellement les 2 mails ont le meme format de sujet. Proposer:
  - Mail formulaire: `Nouvelle demande : {Prenom Nom} – {type_bien}`
  - Mail rappel: `Demande de rappel : {Prenom Nom} – {type_bien}`
- A-1c: Verifier l'encodage UTF-8 sur les 3 occurrences identifiees (lignes 78, 88, 148 de contact.js)

**Criteres d'acceptation:** Les 2 types de mails ont des objets distincts et lisibles, sans caracteres corrompus.

---

### A-2/ Ajouter indicatif du numero de telephone

**Fichiers:** `index.html` (formulaire), `netlify/functions/contact.js` (emails), `espace-client.html` (affichage)
**Assignation:** Claude Code

**Sous-taches:**
- A-2a: Ajouter un selecteur d'indicatif telephonique dans le formulaire de contact (`index.html`). Par defaut: `+33` (France). Options: +33, +590 (Guadeloupe), +596 (Martinique), +594 (Guyane), +262 (Reunion), +377 (Monaco), +32 (Belgique), +41 (Suisse), +352 (Luxembourg)
- A-2b: Transmettre l'indicatif dans les donnees du formulaire (champ `indicatif`)
- A-2c: Afficher le numero complet avec indicatif dans les emails admin et client
- A-2d: Stocker l'indicatif dans Supabase (`clients.indicatif`)

**Criteres d'acceptation:** Le numero de telephone affiche dans les emails et dans l'espace client inclut l'indicatif pays.

---

### A-3/ Toggle visibilite mot de passe lors de la creation de compte

**Contexte:** L'utilisateur ne peut pas verifier sa saisie de mot de passe. En cas d'erreur, il est bloque.
**Fichier:** `connexion.html`
**Assignation:** Claude Code

**Sous-taches:**
- A-3a: Ajouter une icone oeil (toggle show/hide) sur les 3 champs mot de passe:
  - `#loginPass` (formulaire connexion)
  - `#signupPass` (formulaire inscription)
  - `#signupPassConfirm` (confirmation mot de passe)
- A-3b: Implementer le toggle en JS vanilla:
  - Clic sur l'icone → bascule `type="password"` / `type="text"`
  - Icone change entre oeil ouvert et oeil barre
- A-3c: Ajouter le CSS pour positionner l'icone a droite du champ (position absolute dans un conteneur relatif)
- A-3d: Ajouter un indicateur de force du mot de passe sous le champ `#signupPass`:
  - Barre de progression coloree (rouge/orange/vert)
  - Criteres: min 8 caracteres, 1 majuscule, 1 chiffre, 1 caractere special

**Criteres d'acceptation:** L'utilisateur peut afficher/masquer son mot de passe et voit un indicateur de force lors de l'inscription.

---

### A-4/ Captcha pour valider l'ouverture du compte

**Contexte:** Proteger la creation de compte contre les bots.
**Fichier:** `connexion.html`
**Assignation:** Claude Code

**Sous-taches:**
- A-4a: **Choix de la solution captcha:**
  - Option 1: **hCaptcha** (gratuit, RGPD-friendly, recommande pour la conformite europeenne)
  - Option 2: **reCAPTCHA v3** (Google, invisible, score-based)
  - Option 3: **Cloudflare Turnstile** (gratuit, invisible, respectueux de la vie privee)
  - **Recommandation: Cloudflare Turnstile** (gratuit, invisible, pas de friction UX, RGPD compatible)
- A-4b: Creer un compte Cloudflare Turnstile et obtenir les cles (site_key + secret_key)
- A-4c: Integrer le widget Turnstile dans le formulaire d'inscription (`#signupForm`):
  - Ajouter le script `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
  - Ajouter le div `<div class="cf-turnstile" data-sitekey="VOTRE_SITE_KEY"></div>` avant le bouton submit
- A-4d: Bloquer la soumission tant que le captcha n'est pas valide:
  - Verifier la presence du token `cf-turnstile-response` dans `handleSignup()`
  - Afficher un message d'erreur si le captcha n'est pas complete
- A-4e: **Verification cote serveur (optionnel mais recommande):**
  - Creer `netlify/functions/verify-captcha.js` ou integrer la verification dans le flux signup
  - Appeler l'API Turnstile avec le token + secret_key pour valider
- A-4f: Ajouter `TURNSTILE_SECRET_KEY` dans `.env` et Netlify si verification serveur

**Criteres d'acceptation:** Un captcha invisible protege la creation de compte. Les bots sont bloques, l'experience utilisateur reste fluide.

---

## Sprint 2 — Parcours visiteur/demandeur (3-5 jours)

### B-1/ Mail de confirmation de creation d'espace personnel

**Contexte:** Quand un visiteur remplit le formulaire, il recoit un mail l'invitant a creer son compte. Le statut est `new_lead` (visiteur/demandeur).
**Fichier:** `netlify/functions/contact.js` (mail client, lignes 97-153)
**Assignation:** Claude Code

**Sous-taches:**
- B-1a: Revoir le contenu du mail client existant pour clarifier qu'il s'agit d'une confirmation de demande de creation d'espace personnel
- B-1b: Ajouter dans le mail la mention explicite du statut "visiteur/demandeur"
- B-1c: Verifier que le lien de creation de compte (`signupUrl`) fonctionne et pre-remplit les champs correctement
- B-1d: Ajouter un recapitulatif de la demande dans le mail client (type de bien, adresse, echeance)

**Criteres d'acceptation:** Le visiteur recoit un mail clair avec son statut, un recapitulatif de sa demande, et un lien fonctionnel de creation de compte.

---

### B-2/ Mail de confirmation de reception de demande de rdv telephonique

**Contexte:** Differencier le parcours "formulaire de contact" du parcours "demande de rappel".
**Fichiers:** `netlify/functions/contact.js`, `index.html`
**Assignation:** Claude Code

**Sous-taches:**
- B-2a: Creer un nouveau champ dans le formulaire pour distinguer "demande de renseignement" vs "demande de rappel telephonique" (ou detecter via le champ `demande`)
- B-2b: Creer le template email specifique pour la demande de rappel, invitant le visiteur a:
  1. Creer son compte (si pas encore fait)
  2. Se connecter a son espace
  3. Acceder a l'agenda de prise de rdv telephonique
- B-2c: Adapter la logique de `contact.js` pour envoyer le bon template selon le type de demande
- B-2d: Mettre a jour le statut pipeline a `call_requested` quand c'est une demande de rappel

**Criteres d'acceptation:** Le visiteur qui demande un rappel recoit un mail specifique l'invitant a prendre rdv via son espace personnel.

---

### B-3/ Module de prise de rdv telephonique dans l'espace utilisateur

**Contexte:** Le visiteur/demandeur connecte doit pouvoir choisir un creneau pour un appel telephonique.
**Fichiers:** `espace-client.html`, nouveau `netlify/functions/book-appointment.js`
**Assignation:** Codex (complexe, UI + backend)

**Sous-taches:**
- B-3a: **Integration calendrier** — Choisir et integrer une solution de prise de rdv:
  - Option 1: Calendly embed (rapide, heberge)
  - Option 2: Cal.com embed (open-source)
  - Option 3: Module custom avec Google Calendar API
  - **Recommandation: Calendly ou Cal.com en iframe pour MVP**
- B-3b: **Section agenda dans espace-client.html** — Ajouter une section "Prendre rendez-vous telephonique" visible uniquement pour les statuts `new_lead` et `account_created`
- B-3c: **Fonction backend `book-appointment.js`** — Endpoint pour enregistrer la reservation:
  - INSERT dans `appointments` (type='phone_call', status='scheduled')
  - Mettre a jour `clients.status` a `call_requested`
  - Envoyer notification admin
- B-3d: **Affichage conditionnel** — Masquer le module agenda une fois le rdv confirme, afficher un recapitulatif du rdv programme

**Criteres d'acceptation:** Le visiteur connecte peut choisir un creneau de rdv telephonique depuis son espace, le rdv est enregistre dans `appointments`, l'admin est notifie.

---

### B-4/ Mail et procedure de confirmation du rdv telephonique programme

**Fichiers:** nouveau `netlify/functions/confirm-appointment.js`, templates email
**Assignation:** Claude Code

**Sous-taches:**
- B-4a: Creer le template email de confirmation de rdv telephonique avec:
  - Date et heure du rdv
  - Numero de telephone du client (avec indicatif)
  - Rappel du contexte de la demande
  - Lien vers l'espace personnel
- B-4b: Creer la fonction `confirm-appointment.js`:
  - Declenchee apres reservation du creneau (webhook Calendly/Cal.com ou appel direct)
  - Envoie le mail de confirmation au client
  - Envoie un rappel a l'admin (scantorenov@gmail.com)
  - Met a jour `appointments.status` a `confirmed`

**Criteres d'acceptation:** Client et admin recoivent un mail de confirmation avec les details du rdv.

---

## Sprint 3 — Qualification prospect (3-5 jours)

### C-1/ Formulaire de synthese de l'echange telephonique

**Contexte:** Le chef de projet ScantoRenov complete un formulaire apres l'appel. Ce formulaire nourrit le contexte de Marcel (IA).
**Fichiers:** nouveau `admin-call-summary.html`, nouveau `netlify/functions/save-call-summary.js`
**Assignation:** Codex

**Sous-taches:**
- C-1a: **Formulaire de synthese** — Creer un formulaire admin (protege par ADMIN_SECRET ou role admin) avec:
  - Identification client (pre-rempli)
  - Resume de l'echange (textarea libre)
  - Besoins exprimes (checkboxes: renovation complete, piece specifique, extension, amenagement exterieur, etc.)
  - Budget confirme (input numerique)
  - Echeance confirmee (date picker)
  - Niveau d'interet (faible/moyen/fort)
  - Notes internes (textarea)
  - Type de bien precise
  - Surface confirmee
  - Contraintes identifiees (textarea)
- C-1b: **Fonction backend `save-call-summary.js`** — Endpoint protege admin:
  - INSERT dans `call_summaries`
  - Met a jour `appointments.status` a `completed`
  - Met a jour `clients.status` a `call_done`
  - Declenche la mise a jour du prompt Marcel via `marcel-prompt.js`
- C-1c: **Integration Marcel** — Enrichir le prompt systeme de Marcel avec les donnees de la synthese d'appel

**Criteres d'acceptation:** Le chef de projet peut saisir la synthese de l'appel, les donnees sont stockees dans `call_summaries` et injectees dans le contexte de Marcel.

---

### C-2/ Afficher la synthese sur l'espace personnel du prospect

**Fichier:** `espace-client.html`
**Assignation:** Claude Code

**Sous-taches:**
- C-2a: Ajouter une section "Synthese de votre echange" dans l'espace client, visible a partir du statut `call_done`
- C-2b: Lire depuis `call_summaries` (JOIN avec `clients`) et afficher:
  - Date de l'echange
  - Resume des besoins identifies
  - Budget et echeance convenus
  - Prochaines etapes proposees
- C-2c: Masquer les notes internes (`internal_notes` non affichees cote client)

**Criteres d'acceptation:** Le prospect voit un resume clair de l'echange telephonique dans son espace, sans les notes internes.

---

## Sprint 4 — Parcours scan + paiement (5-7 jours)

### D-1/ Mail d'invitation pour prise de rdv scan 3D

**Fichiers:** nouveau `netlify/functions/invite-scan.js`
**Assignation:** Claude Code

**Sous-taches:**
- D-1a: Creer le template email d'invitation au scan 3D:
  - Expediteur: `avant-projet@scantorenov.com` (nouveau domaine Resend a configurer)
  - Contenu: invitation a se connecter pour prendre rdv de scan
  - Duree estimee du scan (recuperee de la synthese telephonique)
  - Lien direct vers la section agenda de l'espace client
- D-1b: Creer la fonction `invite-scan.js` (protegee admin)
- D-1c: **Configurer le domaine Resend** — Ajouter `avant-projet@scantorenov.com` comme expediteur verifie

**Criteres d'acceptation:** Le prospect recoit un mail depuis avant-projet@scantorenov.com l'invitant a prendre rdv pour le scan.

---

### D-2/ Reutilisation de l'agenda pour rdv scan 3D

**Fichier:** `espace-client.html`
**Assignation:** Claude Code

**Sous-taches:**
- D-2a: Adapter le module agenda (B-3) pour supporter un second type de rdv: "Scan 3D Matterport"
- D-2b: Afficher le bon type de rdv selon le statut:
  - `account_created` / `call_requested`: agenda telephonique
  - `call_done`: agenda scan 3D
- D-2c: Backend: INSERT dans `appointments` (type='scan_3d'), mettre a jour `clients.status` a `scan_scheduled`

**Criteres d'acceptation:** Le prospect peut prendre rdv pour un scan 3D via le meme module agenda.

---

### D-3/ Paiement en ligne pour validation du rdv scan (180 euros TTC)

**Fichiers:** `espace-client.html`, nouveau `netlify/functions/create-checkout.js`, nouveau `netlify/functions/webhook-stripe.js`
**Assignation:** Codex (integration Stripe complexe)

**Sous-taches:**
- D-3a: **Integration Stripe Checkout:**
  - Creer un compte Stripe
  - Configurer un produit "Scan 3D Matterport" a 180 euros TTC
  - Obtenir les cles API (pk_live, sk_live)
- D-3b: **Fonction `create-checkout.js`** — Creer une session Stripe Checkout:
  - Recevoir l'email client et le type de produit
  - Creer une session de paiement avec success_url et cancel_url
  - Retourner l'URL de paiement
- D-3c: **Bouton de paiement dans espace-client.html** — "Valider et payer (180 euros TTC)"
- D-3d: **Webhook Stripe `webhook-stripe.js`** — Recevoir la confirmation de paiement:
  - Verifier la signature du webhook
  - INSERT dans `payments` (type='scan_3d', amount_cents=18000, status='completed')
  - Mettre a jour `clients.status` a `scan_payment_completed`
  - Confirmer le rdv scan dans `appointments`
  - Declencher l'envoi du mail de confirmation (D-4)
- D-3e: Pages de succes/echec post-paiement
- D-3f: Variables d'environnement: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`

**Criteres d'acceptation:** Le prospect doit payer 180 euros via Stripe. Le paiement est trace dans `payments`, le rdv est confirme.

---

### D-4/ Mail de confirmation de rdv scan apres paiement

**Fichier:** nouveau `netlify/functions/confirm-scan.js`
**Assignation:** Claude Code

**Sous-taches:**
- D-4a: Creer le template email de confirmation (expediteur: `avant-projet@scantorenov.com`)
- D-4b: Creer la fonction `confirm-scan.js` declenchee par le webhook Stripe

**Criteres d'acceptation:** Apres paiement, le client recoit un mail de confirmation de rdv scan.

---

## Sprint 5 — Enrichissement et visite virtuelle (5-7 jours)

### E-1/ Enrichissement du formulaire de synthese post-scan

**Fichiers:** `admin-call-summary.html`, `netlify/functions/save-call-summary.js`
**Assignation:** Codex

**Sous-taches:**
- E-1a: Ajouter une section "Observations scan" au formulaire admin (C-1)
- E-1b: Adapter `save-call-summary.js` pour creer un second `call_summaries` lie au rdv scan
- E-1c: Upload fichiers vers Supabase Storage → INSERT dans `documents`
- E-1d: Mettre a jour `clients.status` a `scan_completed`

**Criteres d'acceptation:** Le chef de projet peut completer les observations du scan avec photos et plans.

---

### E-2/ Transmission des donnees a Marcel et integration visite virtuelle

**Fichiers:** `marcel-prompt.js`, `notify-virtual-tour.js`, `espace-client.html`
**Assignation:** Codex

**Sous-taches:**
- E-2a: Enrichir `marcel-prompt.js` avec les donnees de `call_summaries`, `scans`, `documents`
- E-2b: Integrer l'iframe Matterport dans l'espace client depuis `scans`
- E-2c: Mettre a jour `clients.status` a `analysis_ready`

**Criteres d'acceptation:** Marcel a acces a tout le contexte enrichi, la visite virtuelle est accessible.

---

### E-3/ Paiement acces visite virtuelle + Marcel (120 euros)

**Fichiers:** `notify-virtual-tour.js`, `create-checkout.js`, `webhook-stripe.js`
**Assignation:** Claude Code + Codex

**Sous-taches:**
- E-3a: Modifier `notify-virtual-tour.js` (expediteur: `avant-projet@scantorenov.com`)
- E-3b: Adapter `create-checkout.js` pour supporter un second produit (120 euros)
- E-3c: Dans `webhook-stripe.js`: INSERT dans `payments` (type='virtual_tour'), activer `marcel_enabled = true`
- E-3d: Affichage conditionnel dans `espace-client.html`: visite virtuelle et Marcel verrouilles avant paiement

**Criteres d'acceptation:** Le client doit payer 120 euros pour debloquer la visite virtuelle et Marcel.

---

## Sprint 6 — Rapport et accompagnement (5-7 jours)

### F-1/ Rapport d'avant-projet telechargeable

**Fichiers:** nouveau `netlify/functions/generate-report.js`, `espace-client.html`
**Assignation:** Codex

**Sous-taches:**
- F-1a: Generation du rapport PDF (synthese, plans, simulations, recommandations Marcel, estimatif)
- F-1b: Bouton de telechargement dans `espace-client.html`
- F-1c: Conditions de transfert (filigrane si non-paye phase 3)
- F-1d: Stockage dans `documents` + Supabase Storage
- F-1e: Mettre a jour `clients.status` a `avant_projet_ready`

**Criteres d'acceptation:** Le client peut generer et telecharger un rapport PDF complet.

---

### G-1/ Passage au statut "client/accompagne"

**Fichiers:** `espace-client.html`, `create-checkout.js`, `webhook-stripe.js`
**Assignation:** Codex

**Sous-taches:**
- G-1a: Page de choix d'offre d'accompagnement (tarifs a definir)
- G-1b: Integration Stripe pour le paiement de l'offre choisie
- G-1c: Apres paiement: INSERT dans `payments`, mettre a jour `clients.status` a `accompaniment_subscribed`
- G-1d: Redonner acces a l'agenda pour un rdv telephonique gratuit

**Criteres d'acceptation:** Le client peut souscrire une offre d'accompagnement et acceder au statut client/accompagne.

---

### G-2/ Mails de confirmation rdv et souscription

**Assignation:** Claude Code

**Sous-taches:**
- G-2a: Template email de confirmation de rdv telephonique de choix d'offre (gratuit)
- G-2b: Template email de confirmation de souscription a l'offre
- G-2c: Creer/adapter la fonction d'envoi pour ces templates

**Criteres d'acceptation:** Le client recoit les mails de confirmation a chaque etape.

---

### G-3/ A definir

*En attente de specifications detaillees.*

---

## Sprint 7 — Phase MOE (a planifier)

### H/ Maitrise d'Oeuvre d'Execution

*En attente de specifications detaillees.*

---

## Resume des assignations

| Sprint | Bloc | Tache | Assignation | Complexite | Dependances |
|--------|------|-------|-------------|------------|-------------|
| 0 | S0-1 | Migration schema v2 | Claude Code | Elevee | Aucune |
| 0 | S0-2 | Adapter fonctions existantes | Claude Code | Elevee | S0-1 |
| 1 | A-1 | Corriger caracteres emails | Claude Code | Faible | Aucune |
| 1 | A-2 | Indicatif telephone | Claude Code | Faible | S0-1 |
| 1 | A-3 | Toggle visibilite mdp | Claude Code | Faible | Aucune |
| 1 | A-4 | Captcha inscription | Claude Code | Moyenne | Aucune |
| 2 | B-1 | Mail confirmation espace | Claude Code | Faible | S0-2 |
| 2 | B-2 | Mail confirmation rdv tel | Claude Code | Moyenne | B-1 |
| 2 | B-3 | Module agenda rdv tel | Codex | Elevee | B-2, S0-1 |
| 2 | B-4 | Confirmation rdv tel | Claude Code | Faible | B-3 |
| 3 | C-1 | Formulaire synthese appel | Codex | Elevee | B-4, S0-1 |
| 3 | C-2 | Affichage synthese client | Claude Code | Moyenne | C-1 |
| 4 | D-1 | Mail invitation scan | Claude Code | Faible | C-1 |
| 4 | D-2 | Agenda rdv scan | Claude Code | Moyenne | B-3, D-1 |
| 4 | D-3 | Paiement Stripe 180 euros | Codex | Elevee | D-2 |
| 4 | D-4 | Mail confirmation scan | Claude Code | Faible | D-3 |
| 5 | E-1 | Enrichissement formulaire | Codex | Moyenne | C-1, S0-1 |
| 5 | E-2 | Integration Marcel + visite | Codex | Elevee | E-1 |
| 5 | E-3 | Paiement 120 euros + acces | Codex | Elevee | D-3, E-2 |
| 6 | F-1 | Rapport avant-projet PDF | Codex | Elevee | E-3 |
| 6 | G-1 | Statut client/accompagne | Codex | Elevee | F-1 |
| 6 | G-2 | Mails confirmation offre | Claude Code | Faible | G-1 |

---

## Ordre de developpement

### Sprint 0 — Prerequis techniques (1-2 jours)
S0-1, S0-2

### Sprint 1 — Corrections immediates + UX (1-2 jours)
A-1, A-2, A-3, A-4

### Sprint 2 — Parcours visiteur/demandeur (3-5 jours)
B-1, B-2, B-3, B-4

### Sprint 3 — Qualification prospect (3-5 jours)
C-1, C-2

### Sprint 4 — Parcours scan + paiement (5-7 jours)
D-1, D-2, D-3, D-4

### Sprint 5 — Enrichissement et visite virtuelle (5-7 jours)
E-1, E-2, E-3

### Sprint 6 — Rapport et accompagnement (5-7 jours)
F-1, G-1, G-2

### Sprint 7 — Phase MOE (a planifier)
H-*

---

## Services externes a provisionner

| Service | Usage | Sprint | Action requise |
|---------|-------|--------|---------------|
| Cloudflare Turnstile | Captcha inscription | Sprint 1 | Creer compte + obtenir cles |
| Calendly ou Cal.com | Prise de rdv | Sprint 2 | Creer compte + configurer creneaux |
| Stripe | Paiements en ligne | Sprint 4 | Creer compte + configurer produits |
| Resend | Email avant-projet@ | Sprint 4 | Ajouter domaine expediteur |
