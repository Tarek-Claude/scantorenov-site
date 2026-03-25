# Prompt Codex — Sprint 2 B-1: Mail de confirmation de création d'espace personnel

**Destinataire:** Codex / ChatGPT
**Contexte:** ScantoRenov application, Sprint 2 mails de confirmation
**Statut:** Sprint 1 finalisé avec succès
**Durée estimée:** 1 jour
**Dépendances:** A-1, A-2, A-3, A-4 finalisés

---

## Stack technique

**Frontend:** HTML/CSS/JS vanilla (pas de framework, pas de bundler)
**Backend:** Netlify Functions (Node 18)
**Base de données:** Supabase PostgreSQL
**Auth:** Netlify Identity
**Email:** Resend API (contact@scantorenov.com pour Sprint 1, avant-projet@scantorenov.com pour Sprint 2+)
**Captcha:** Cloudflare Turnstile (RGPD)

**Convention de code:**
- Netlify Functions: utiliser `const`/`let` (Node 18)
- Emails via Resend: `new Resend(process.env.RESEND_API_KEY)`
- Supabase client: `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`

---

## B-1 | Mail de confirmation de création d'espace personnel

**Fichier:** `netlify/functions/contact.js`
**Complexité:** Faible

### Context

Actuellement, après soumission du formulaire de contact, le client reçoit un mail de confirmation générique. Ce mail doit être amélioré pour clarifier explicitement qu'il s'agit d'une **création d'espace personnel** dans la plateforme ScantoRenov, avec mention du statut "visiteur/demandeur" et un récapitulatif des informations fournies.

### Sous-tâches

**B-1a:** Revoir le contenu du template email client dans `contact.js`

Localiser le template email envoyer au client après contact form submission. Ce template doit:
- Clarifier que l'email confirme la création d'un **espace personnel** (pas juste "réception de demande")
- Expliquer que le statut initial est "visiteur" ou "demandeur" selon le contexte
- Inclure un lien de création de compte avec la mention explicite "Créer mon espace ScantoRenov →"
- Afficher un récapitulatif de la demande (type de bien, adresse, numéro de téléphone avec indicatif, budget estimé si fourni)

Structure proposée du mail client:
```
Objet: Bienvenue — Créez votre espace ScantoRenov

Bonjour {{prenom}},

Merci de votre contact ! Votre demande a bien été reçue.

Vous êtes maintenant **visiteur** sur la plateforme ScantoRenov.
Pour accéder à votre espace personnel et gérer vos projets,
créez un compte en cliquant ici : {{signupUrl}}

--- RÉCAPITULATIF DE VOTRE DEMANDE ---
Type de bien : {{type_bien}}
Adresse : {{address}}
Téléphone : {{indicatif}} {{telephone}}
Budget estimé : {{budget}} (si fourni)
Demande détaillée : {{demande}}

Notre équipe examinera votre demande et vous contactera
sous peu pour discuter de vos besoins spécifiques.

À bientôt !
L'équipe ScantoRenov
```

**B-1b:** Vérifier le lien de création de compte (`signupUrl`)

- S'assurer que le lien pointe vers `connexion.html` avec une préfecture ou paramètre `?action=signup`
- Ajouter le paramètre email du client si possible: `connexion.html?action=signup&email={{email}}`
- Tester que le lien fonctionne et que le formulaire d'inscription s'affiche correctement

**B-1c:** Ajouter les variables manquantes au template

Dans `contact.js`, s'assurer que les variables suivantes sont disponibles et passées au template:
- `{{prenom}}` - prénom du client
- `{{type_bien}}` - type de bien (maison, appartement, etc.)
- `{{address}}` - adresse fournie dans le formulaire
- `{{indicatif}}` - indicatif téléphonique (via request.body.indicatif ajouté en A-2)
- `{{telephone}}` - numéro de téléphone
- `{{budget}}` - budget estimé (optionnel)
- `{{demande}}` - détails de la demande
- `{{signupUrl}}` - lien vers formulaire d'inscription

**B-1d:** Adapter l'envoi d'email pour utiliser `avant-projet@scantorenov.com`

Modifier l'adresse `from` dans le template de mail client:
- Avant: `from: "contact@scantorenov.com"`
- Après: `from: "avant-projet@scantorenov.com"`

Note: `contact@scantorenov.com` reste l'adresse de réception des mails admin.

**B-1e:** Test

- Remplir le formulaire de contact avec:
  - Prénom, Nom, Email
  - Téléphone + indicatif (par ex. +590)
  - Type de bien: "Maison"
  - Adresse: "123 Rue de la Paix, Paris"
  - Budget estimé: "50 000€"
  - Demande détaillée: "Travaux de rénovation complète"
- Vérifier que le client reçoit un mail:
  - De l'adresse `avant-projet@scantorenov.com`
  - Avec le récapitulatif complet et lisible
  - Avec le lien d'inscription cliquable
- Cliquer sur le lien d'inscription → vérifier que `connexion.html` s'affiche avec le formulaire d'inscription

### Critères d'acceptation

- ✅ Le mail client mentionne explicitement "espace personnel" ou "création de compte"
- ✅ Le statut "visiteur" ou "demandeur" est mentionné
- ✅ Le récapitulatif inclut: type de bien, adresse, téléphone avec indicatif, budget, demande
- ✅ Le lien d'inscription fonctionne et pointe vers `connexion.html?action=signup&email={{email}}`
- ✅ L'adresse `from` est `avant-projet@scantorenov.com`
- ✅ Pas de caractères corrompus, tous les champs s'affichent correctement

---

## Validation B-1

Parcours complet:
1. Depuis `index.html`, remplir le formulaire de contact avec tous les champs
2. Soumettre → recevoir mail de confirmation client
3. Cliquer sur le lien d'inscription dans le mail
4. Vérifier que `connexion.html` affiche le formulaire d'inscription avec l'email pré-rempli
5. Créer un compte → accès à `espace-client.html`
6. Vérifier que le statut initial est "visiteur" ou "demandeur"

**Critères finaux:**
- ✅ Pipeline de création de compte fluide du formulaire au mail au signup
- ✅ Mail client informatif et transparent sur la création d'espace personnel
- ✅ Toutes les données fournis sont récapitulées correctement
- ✅ Pas d'erreurs d'encodage ou de variables manquantes

---

## Notes pour Codex

- Rester stricte sur le scope B-1: améliorer le template du mail client, pas refactorer contact.js entièrement
- Préserver la structure existante du formulaire et des mails admin (A-1, A-2 finalisés)
- Tester sur Chrome et Firefox
- Si des variables manquent (budget, address non stockés), créer des fallbacks appropriés (ex: "Non spécifié")
- Vérifier l'encodage UTF-8 du fichier contact.js avant de modifier

Bon courage! 🚀
