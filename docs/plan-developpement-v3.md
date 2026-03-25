# Plan de Developpement ScantoRenov v3

> Date: 26/03/2026
> Version: 3.0
> Schema: 1 table maitre `clients` + 4 satellites (`appointments`, `project_notes`, `payments`, `scans`)
> Ref schema: `docs/schema-v3.md`

---

## Architecture base de donnees v3

```
clients (maitre)
  ├── appointments      (rdv tel + scan + offre)              1-to-N
  ├── project_notes     (syntheses, observations, rapports)   1-to-N
  ├── payments          (paiements Stripe)                    1-to-N
  └── scans             (Matterport + plans + photos + CSV)   1-to-N
```

**Statuts pipeline:**
```
new_lead → account_created → call_requested → call_done
→ scan_scheduled → scan_payment_completed → scan_completed
→ analysis_ready → avant_projet_ready → accompaniment_subscribed
```

---

# ═══════════════════════════════════════════════════════════════
# SPRINT 0 — Prerequis techniques
# Assignation: CLAUDE CODE sous supervision Claude (Cowork)
# Workflow: Claude Code execute → Tarek valide → commit
# Duree estimee: 1-2 jours
# ═══════════════════════════════════════════════════════════════

## S0-1/ Migration Supabase v3 — Creation des tables satellites

**Fichier a creer:** `supabase/migrations/202603260001_schema_v3.sql`
**Assignation:** Claude Code
**Superviseur:** Claude (Cowork)

**Sous-taches:**

- S0-1a: **Ajouter colonnes manquantes a `clients`**
  ```sql
  ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS indicatif TEXT DEFAULT '+33',
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
  ```
  Note: si `id` ne peut pas etre ajoute comme PK sur table existante (email est deja PK implicite), utiliser `email` comme FK dans les satellites. Adapter selon contrainte Supabase.

- S0-1b: **Creer table `appointments`**
  ```sql
  CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'requested',
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX idx_appointments_client_id ON public.appointments(client_id);
  ```

- S0-1c: **Creer table `project_notes`**
  ```sql
  CREATE TABLE IF NOT EXISTS public.project_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id),
    type TEXT NOT NULL,
    summary TEXT,
    needs TEXT[],
    interest_level TEXT,
    confirmed_budget TEXT,
    confirmed_surface TEXT,
    constraints TEXT,
    technical_points TEXT[],
    internal_notes TEXT,
    report_url TEXT,
    report_storage_path TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX idx_project_notes_client_id ON public.project_notes(client_id);
  ```

- S0-1d: **Creer table `payments`**
  ```sql
  CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    stripe_session_id TEXT,
    stripe_payment_intent TEXT,
    type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'eur',
    status TEXT DEFAULT 'pending',
    description TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX idx_payments_client_id ON public.payments(client_id);
  ```

- S0-1e: **Creer table `scans`**
  ```sql
  CREATE TABLE IF NOT EXISTS public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    matterport_model_id TEXT,
    matterport_url TEXT,
    matterport_data JSONB,
    scan_date TIMESTAMPTZ,
    scanned_by TEXT,
    observations TEXT,
    plans_urls TEXT[] DEFAULT '{}',
    photos_urls TEXT[] DEFAULT '{}',
    csv_url TEXT,
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX idx_scans_client_id ON public.scans(client_id);
  ```

- S0-1f: **Trigger updated_at sur appointments**
  ```sql
  CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

  CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  ```

- S0-1g: **Migrer les donnees existantes**
  ```sql
  -- Migrer matterport vers scans
  INSERT INTO public.scans (client_id, matterport_model_id, matterport_url, matterport_data, plans_urls, photos_urls)
  SELECT id, matterport_model_id, COALESCE(matterport_url, matterport_iframe), matterport_data, plans_urls, photos_urls
  FROM public.clients
  WHERE matterport_model_id IS NOT NULL OR matterport_iframe IS NOT NULL;

  -- Migrer call_notes vers project_notes
  INSERT INTO public.project_notes (client_id, type, summary, created_by)
  SELECT id, 'phone_summary', call_notes, 'migration'
  FROM public.clients
  WHERE call_notes IS NOT NULL AND call_notes != '';

  -- Migrer call_scheduled_at vers appointments
  INSERT INTO public.appointments (client_id, type, status, scheduled_at)
  SELECT id, 'phone_call', 'completed', call_scheduled_at
  FROM public.clients
  WHERE call_scheduled_at IS NOT NULL;
  ```

**Criteres d'acceptation:**
- Les 4 tables satellites existent avec FK vers clients
- Les donnees existantes sont migrees
- Les anciennes colonnes restent en place (suppression dans S0-3)

---

## S0-2/ Adapter les fonctions backend au schema v3

**Assignation:** Claude Code
**Superviseur:** Claude (Cowork)
**Dependances:** S0-1

**Sous-taches:**

- S0-2a: **Adapter `_client-pipeline.js`**
  - Ajouter les nouveaux statuts: `scan_payment_completed`, `accompaniment_subscribed`
  - Adapter la logique d'inference de statut pour lire depuis `appointments`, `scans`, `project_notes`
  - Garder la retro-compatibilite: si les anciennes colonnes existent encore, les lire en fallback

- S0-2b: **Adapter `contact.js`**
  - Supprimer l'ecriture des doublons (`phone`, `project_type`, `project_details`)
  - Ecrire `telephone` au lieu de `phone`, `type_bien` au lieu de `project_type`, `demande` au lieu de `project_details`

- S0-2c: **Adapter `identity-signup.js`**
  - Meme nettoyage des doublons
  - Ecrire directement les bons noms de colonnes

- S0-2d: **Adapter `sync-client.js`**
  - Supprimer la logique de sync bidirectionnelle des doublons
  - Quand des donnees de scan arrivent → INSERT/UPDATE dans `scans` au lieu de `clients`
  - Quand des notes d'appel arrivent → INSERT dans `project_notes`
  - Garder la compatibilite : accepter les anciens noms de champs en entree, ecrire dans les bonnes tables

- S0-2e: **Adapter `marcel-prompt.js`**
  - READ: joindre `project_notes` (type='phone_summary') + `scans` pour enrichir le prompt
  - Le prompt systeme est toujours stocke dans `clients.marcel_system_prompt`
  - WRITE: inchangee (toujours dans `clients`)

- S0-2f: **Adapter `notify-virtual-tour.js`**
  - Ecrire dans `scans` au lieu de mettre a jour les metadonnees matterport dans `clients`
  - Lire depuis `scans` pour verifier l'existence du modele

- S0-2g: **Adapter `submit-avantprojet.js`**
  - Lire les infos client depuis `clients` JOIN `scans` JOIN `project_notes`

- S0-2h: **Adapter `admin-update-client.js`**
  - Les mises a jour matterport_id → ecrire dans `scans`
  - Les mises a jour scan_date, scan_confirmed → ecrire dans `appointments` (type='scan_3d')

**Criteres d'acceptation:**
- Aucune fonction n'ecrit plus dans les colonnes doublons
- Les donnees relationnelles sont ecrites dans les bonnes tables satellites
- Les lectures joignent les tables satellites quand necessaire

---

## S0-3/ Adapter le frontend et nettoyer les doublons

**Assignation:** Claude Code
**Superviseur:** Claude (Cowork)
**Dependances:** S0-2

**Sous-taches:**

- S0-3a: **Adapter `espace-client.html`**
  - Remplacer les lectures `.select('*')` par des requetes ciblees:
    - Infos client: `clients` (colonnes identite + statut)
    - Donnees scan: `scans` (WHERE client_id = X AND is_primary = true)
    - Notes projet: `project_notes` (WHERE client_id = X ORDER BY created_at)
  - Afficher les donnees Matterport depuis `scans` au lieu de `clients`

- S0-3b: **Adapter `connexion.html`**
  - Aucun changement necessaire (ne lit pas la BDD)

- S0-3c: **Adapter `index.html`**
  - Aucun changement necessaire (le formulaire poste vers `contact.js` qui est deja adapte)

- S0-3d: **Mettre a jour `docs/pipeline-v2.md` → `docs/pipeline-v3.md`**
  - Documenter les nouveaux statuts
  - Documenter les tables satellites
  - Documenter les FK et les types

- S0-3e: **Test complet du parcours existant**
  - Formulaire de contact → mail recu
  - Inscription → espace client accessible
  - Donnees affichees correctement dans l'espace client
  - Marcel repond avec le bon contexte
  - Visite virtuelle s'affiche (si matterport_id present)

**Criteres d'acceptation:**
- Le parcours utilisateur existant fonctionne identiquement
- Les donnees s'affichent correctement dans l'espace client
- Les tests passent sur un client existant (Guillaume OLMO)

---

## S0-4/ Nettoyage des colonnes obsoletes (optionnel, apres validation)

**Assignation:** Claude Code
**Superviseur:** Claude (Cowork)
**Dependances:** S0-3 valide par Tarek

**Sous-taches:**

- S0-4a: Creer migration `202603260002_cleanup_legacy_columns.sql`:
  ```sql
  ALTER TABLE public.clients
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS project_type,
    DROP COLUMN IF EXISTS project_details,
    DROP COLUMN IF EXISTS matterport_iframe,
    DROP COLUMN IF EXISTS matterport_model_id,
    DROP COLUMN IF EXISTS matterport_url,
    DROP COLUMN IF EXISTS matterport_data,
    DROP COLUMN IF EXISTS plans_urls,
    DROP COLUMN IF EXISTS photos_urls,
    DROP COLUMN IF EXISTS call_scheduled_at,
    DROP COLUMN IF EXISTS call_notes,
    DROP COLUMN IF EXISTS scan_date_proposed,
    DROP COLUMN IF EXISTS scan_date_confirmed,
    DROP COLUMN IF EXISTS scan_confirmed_by_client,
    DROP COLUMN IF EXISTS last_action_required;
  ```

**Criteres d'acceptation:** Table `clients` allegee, aucune regression fonctionnelle.

---

# ═══════════════════════════════════════════════════════════════
# SPRINT 1 — Corrections immediates + UX inscription
# Assignation: CODEX sous supervision ChatGPT
# Workflow: Codex execute → Tarek valide → commit
# Duree estimee: 1-2 jours
# ═══════════════════════════════════════════════════════════════

## A-1/ Corriger erreurs de caracteres dans les objets des emails

**Fichier:** `netlify/functions/contact.js`
**Assignation:** Codex / ChatGPT

**Sous-taches:**
- A-1a: Identifier et corriger les caracteres corrompus UTF-8 dans le sujet du mail admin (ligne 78) — remplacer `\u00e2\u20ac\u201c` par `\u2013`
- A-1b: Differencier l'objet du mail selon le type de demande:
  - Mail formulaire: `Nouvelle demande : {Prenom Nom} \u2013 {type_bien}`
  - Mail rappel: `Demande de rappel : {Prenom Nom} \u2013 {type_bien}`
- A-1c: Verifier l'encodage UTF-8 sur les 3 occurrences (lignes 78, 88, 148 de contact.js)

**Criteres d'acceptation:** Les 2 types de mails ont des objets distincts et lisibles, sans caracteres corrompus.

---

## A-2/ Ajouter indicatif du numero de telephone

**Fichiers:** `index.html`, `netlify/functions/contact.js`, `espace-client.html`
**Assignation:** Codex / ChatGPT

**Sous-taches:**
- A-2a: Ajouter un selecteur d'indicatif telephonique dans le formulaire de contact (`index.html`). Par defaut: `+33` (France). Options: +33, +590 (Guadeloupe), +596 (Martinique), +594 (Guyane), +262 (Reunion), +377 (Monaco), +32 (Belgique), +41 (Suisse), +352 (Luxembourg)
- A-2b: Transmettre l'indicatif dans les donnees du formulaire (champ `indicatif`)
- A-2c: Afficher le numero complet avec indicatif dans les emails admin et client
- A-2d: Stocker l'indicatif dans Supabase (`clients.indicatif` — colonne deja creee par Sprint 0)

**Criteres d'acceptation:** Le numero de telephone affiche dans les emails et dans l'espace client inclut l'indicatif pays.

---

## A-3/ Toggle visibilite mot de passe lors de la creation de compte

**Fichier:** `connexion.html`
**Assignation:** Codex / ChatGPT

**Sous-taches:**
- A-3a: Ajouter une icone oeil (toggle show/hide) sur les 3 champs mot de passe:
  - `#loginPass` (formulaire connexion)
  - `#signupPass` (formulaire inscription)
  - `#signupPassConfirm` (confirmation mot de passe)
- A-3b: Implementer le toggle en JS vanilla:
  - Clic sur l'icone → bascule `type="password"` / `type="text"`
  - Icone change entre oeil ouvert (voir) et oeil barre (masquer)
- A-3c: CSS : positionner l'icone a droite du champ (position absolute dans un conteneur relatif), style coherent avec le design existant (couleurs `--green`, `--muted`)
- A-3d: Ajouter un indicateur de force du mot de passe sous `#signupPass`:
  - Barre de progression coloree (rouge → orange → vert)
  - Criteres: min 8 caracteres, 1 majuscule, 1 chiffre, 1 caractere special
  - Texte indicatif: "Faible" / "Moyen" / "Fort"

**Criteres d'acceptation:** L'utilisateur peut afficher/masquer son mot de passe et voit un indicateur de force lors de l'inscription.

---

## A-4/ Captcha pour valider l'ouverture du compte

**Fichier:** `connexion.html`, optionnel `netlify/functions/verify-captcha.js`
**Assignation:** Codex / ChatGPT

**Sous-taches:**
- A-4a: **Integrer Cloudflare Turnstile** (gratuit, invisible, RGPD compatible):
  - Ajouter le script: `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
  - Ajouter le widget dans `#signupForm` avant le bouton submit:
    `<div class="cf-turnstile" data-sitekey="VOTRE_SITE_KEY" data-theme="light"></div>`
- A-4b: Bloquer la soumission dans `handleSignup()` tant que le token Turnstile n'est pas present:
  ```javascript
  var turnstileToken = document.querySelector('[name="cf-turnstile-response"]');
  if (!turnstileToken || !turnstileToken.value) {
    errEl.textContent = 'Veuillez completer la verification de securite.';
    errEl.style.display = 'block';
    btn.textContent = 'Creer mon compte →'; btn.disabled = false;
    return;
  }
  ```
- A-4c: **Verification serveur (recommande)** — Creer `netlify/functions/verify-captcha.js`:
  - Recevoir le token Turnstile
  - Appeler `https://challenges.cloudflare.com/turnstile/v0/siteverify` avec le secret_key
  - Retourner success/failure
- A-4d: Modifier `handleSignup()` pour verifier le captcha cote serveur AVANT d'appeler `/signup`
- A-4e: Variables d'environnement: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`

**Prerequis:** Creer un compte Cloudflare Turnstile (https://dash.cloudflare.com/turnstile)

**Criteres d'acceptation:** Un captcha invisible protege la creation de compte. Les bots sont bloques, l'experience utilisateur reste fluide.

---

# ═══════════════════════════════════════════════════════════════
# SPRINT 2 — Parcours visiteur/demandeur (3-5 jours)
# Assignation: a definir par Tarek
# ═══════════════════════════════════════════════════════════════

### B-1/ Mail de confirmation de creation d'espace personnel

**Fichier:** `netlify/functions/contact.js`
**Complexite:** Faible

**Sous-taches:**
- B-1a: Revoir le contenu du mail client pour clarifier qu'il s'agit d'une confirmation de creation d'espace personnel
- B-1b: Ajouter la mention explicite du statut "visiteur/demandeur"
- B-1c: Verifier le lien de creation de compte (`signupUrl`)
- B-1d: Ajouter un recapitulatif de la demande (type de bien, adresse, echeance)

---

### B-2/ Mail de confirmation de reception de demande de rdv telephonique

**Fichiers:** `netlify/functions/contact.js`, `index.html`
**Complexite:** Moyenne

**Sous-taches:**
- B-2a: Distinguer "demande de renseignement" vs "demande de rappel" dans le formulaire
- B-2b: Template email specifique pour la demande de rappel
- B-2c: Adapter la logique de `contact.js` pour envoyer le bon template
- B-2d: Mettre a jour le statut pipeline a `call_requested`

---

### B-3/ Module de prise de rdv telephonique dans l'espace utilisateur

**Fichiers:** `espace-client.html`, nouveau `netlify/functions/book-appointment.js`
**Complexite:** Elevee

**Sous-taches:**
- B-3a: Integration calendrier (Calendly / Cal.com en iframe pour MVP)
- B-3b: Section agenda dans `espace-client.html` visible pour statuts `new_lead` et `account_created`
- B-3c: Fonction `book-appointment.js`: INSERT dans `appointments` (type='phone_call')
- B-3d: Affichage conditionnel selon le statut du rdv

---

### B-4/ Mail et procedure de confirmation du rdv telephonique

**Fichiers:** nouveau `netlify/functions/confirm-appointment.js`
**Complexite:** Faible

**Sous-taches:**
- B-4a: Template email de confirmation de rdv
- B-4b: Fonction `confirm-appointment.js` (webhook Calendly/Cal.com)
- B-4c: UPDATE `appointments.status` a `confirmed`

---

# ═══════════════════════════════════════════════════════════════
# SPRINT 3 — Qualification prospect (3-5 jours)
# Assignation: a definir par Tarek
# ═══════════════════════════════════════════════════════════════

### C-1/ Formulaire de synthese de l'echange telephonique

**Fichiers:** nouveau `admin-call-summary.html`, nouveau `netlify/functions/save-project-note.js`
**Complexite:** Elevee

**Sous-taches:**
- C-1a: Formulaire admin protege (identification client, resume, besoins, budget, interet, notes internes, contraintes)
- C-1b: Fonction `save-project-note.js`: INSERT dans `project_notes` (type='phone_summary'), UPDATE `appointments.status` → 'completed', UPDATE `clients.status` → 'call_done'
- C-1c: Integration Marcel: enrichir le prompt systeme avec les donnees de `project_notes`

---

### C-2/ Afficher la synthese sur l'espace personnel du prospect

**Fichier:** `espace-client.html`
**Complexite:** Moyenne

**Sous-taches:**
- C-2a: Section "Synthese de votre echange" visible a partir du statut `call_done`
- C-2b: Lire depuis `project_notes` (WHERE type='phone_summary')
- C-2c: Masquer `internal_notes`

---

# ═══════════════════════════════════════════════════════════════
# SPRINT 4 — Parcours scan + paiement (5-7 jours)
# Assignation: a definir par Tarek
# ═══════════════════════════════════════════════════════════════

### D-1/ Mail d'invitation pour prise de rdv scan 3D

**Complexite:** Faible
- D-1a: Template email (expediteur: `avant-projet@scantorenov.com`)
- D-1b: Fonction `invite-scan.js` (protegee admin)
- D-1c: Configurer domaine Resend

---

### D-2/ Reutilisation de l'agenda pour rdv scan 3D

**Complexite:** Moyenne
- D-2a: Adapter module agenda pour type "Scan 3D Matterport"
- D-2b: Affichage conditionnel selon statut
- D-2c: INSERT `appointments` (type='scan_3d'), UPDATE `clients.status` → 'scan_scheduled'

---

### D-3/ Paiement en ligne pour validation du rdv scan (180€ TTC)

**Complexite:** Elevee
- D-3a: Integration Stripe Checkout (produit "Scan 3D" 180€)
- D-3b: Fonction `create-checkout.js`
- D-3c: Bouton de paiement dans `espace-client.html`
- D-3d: Webhook Stripe `webhook-stripe.js`: INSERT `payments` (type='scan_3d', amount_cents=18000)
- D-3e: Pages succes/echec
- D-3f: Variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`

---

### D-4/ Mail de confirmation de rdv scan apres paiement

**Complexite:** Faible
- D-4a: Template email (expediteur: `avant-projet@scantorenov.com`)
- D-4b: Fonction `confirm-scan.js` declenchee par webhook Stripe

---

# ═══════════════════════════════════════════════════════════════
# SPRINT 5 — Enrichissement et visite virtuelle (5-7 jours)
# Assignation: a definir par Tarek
# ═══════════════════════════════════════════════════════════════

### E-1/ Enrichissement du formulaire de synthese post-scan

**Complexite:** Moyenne
- E-1a: Section "Observations scan" dans `admin-call-summary.html`
- E-1b: INSERT `project_notes` (type='scan_observation') + upload vers `scans` (plans_urls, photos_urls)
- E-1c: UPDATE `clients.status` → 'scan_completed'

---

### E-2/ Transmission des donnees a Marcel et integration visite virtuelle

**Complexite:** Elevee
- E-2a: Enrichir `marcel-prompt.js` avec `project_notes` + `scans`
- E-2b: Iframe Matterport depuis `scans`
- E-2c: UPDATE `clients.status` → 'analysis_ready'

---

### E-3/ Paiement acces visite virtuelle + Marcel (120€)

**Complexite:** Elevee
- E-3a: Expediteur `avant-projet@scantorenov.com`
- E-3b: Adapter `create-checkout.js` (produit 120€)
- E-3c: Webhook: INSERT `payments` (type='virtual_tour'), UPDATE `marcel_enabled = true`
- E-3d: Affichage conditionnel dans `espace-client.html`

---

# ═══════════════════════════════════════════════════════════════
# SPRINT 6 — Rapport et accompagnement (5-7 jours)
# Assignation: a definir par Tarek
# ═══════════════════════════════════════════════════════════════

### F-1/ Rapport d'avant-projet telechargeable

**Complexite:** Elevee
- F-1a: Generation PDF (`generate-report.js`)
- F-1b: Bouton telechargement dans `espace-client.html`
- F-1c: Filigrane conditionnel
- F-1d: INSERT `project_notes` (type='avant_projet_report', report_url=...) + Supabase Storage
- F-1e: UPDATE `clients.status` → 'avant_projet_ready'

---

### G-1/ Passage au statut "client/accompagne"

**Complexite:** Elevee
- G-1a: Page choix d'offre d'accompagnement
- G-1b: Integration Stripe
- G-1c: INSERT `payments` (type='accompaniment'), UPDATE `clients.status` → 'accompaniment_subscribed'
- G-1d: Redonner acces agenda pour rdv tel gratuit

---

### G-2/ Mails de confirmation rdv et souscription

**Complexite:** Faible
- G-2a: Template confirmation rdv offre
- G-2b: Template confirmation souscription
- G-2c: Fonction d'envoi

---

### G-3/ A definir

---

# ═══════════════════════════════════════════════════════════════
# SPRINT 7 — Phase MOE (a planifier)
# ═══════════════════════════════════════════════════════════════

### H/ Maitrise d'Oeuvre d'Execution

*En attente de specifications.*

---

## Resume des assignations

| Sprint | Bloc | Tache | Outil | Superviseur | Complexite | Dependances |
|--------|------|-------|-------|-------------|------------|-------------|
| **0** | S0-1 | Migration schema v3 (4 tables) | **Claude Code** | **Claude (Cowork)** | Elevee | Aucune |
| **0** | S0-2 | Adapter fonctions backend | **Claude Code** | **Claude (Cowork)** | Elevee | S0-1 |
| **0** | S0-3 | Adapter frontend + tests | **Claude Code** | **Claude (Cowork)** | Moyenne | S0-2 |
| **0** | S0-4 | Nettoyage colonnes obsoletes | **Claude Code** | **Claude (Cowork)** | Faible | S0-3 valide |
| **1** | A-1 | Corriger caracteres emails | **Codex** | **ChatGPT** | Faible | S0-2 |
| **1** | A-2 | Indicatif telephone | **Codex** | **ChatGPT** | Faible | S0-1 |
| **1** | A-3 | Toggle visibilite mdp | **Codex** | **ChatGPT** | Faible | Aucune |
| **1** | A-4 | Captcha inscription | **Codex** | **ChatGPT** | Moyenne | Aucune |
| 2 | B-1 | Mail confirmation espace | A definir | A definir | Faible | S0-2 |
| 2 | B-2 | Mail confirmation rdv tel | A definir | A definir | Moyenne | B-1 |
| 2 | B-3 | Module agenda rdv tel | A definir | A definir | Elevee | B-2 |
| 2 | B-4 | Confirmation rdv tel | A definir | A definir | Faible | B-3 |
| 3 | C-1 | Formulaire synthese appel | A definir | A definir | Elevee | B-4 |
| 3 | C-2 | Affichage synthese client | A definir | A definir | Moyenne | C-1 |
| 4 | D-1 | Mail invitation scan | A definir | A definir | Faible | C-1 |
| 4 | D-2 | Agenda rdv scan | A definir | A definir | Moyenne | B-3, D-1 |
| 4 | D-3 | Paiement Stripe 180€ | A definir | A definir | Elevee | D-2 |
| 4 | D-4 | Mail confirmation scan | A definir | A definir | Faible | D-3 |
| 5 | E-1 | Enrichissement formulaire | A definir | A definir | Moyenne | C-1 |
| 5 | E-2 | Integration Marcel + visite | A definir | A definir | Elevee | E-1 |
| 5 | E-3 | Paiement 120€ + acces | A definir | A definir | Elevee | D-3, E-2 |
| 6 | F-1 | Rapport avant-projet PDF | A definir | A definir | Elevee | E-3 |
| 6 | G-1 | Statut client/accompagne | A definir | A definir | Elevee | F-1 |
| 6 | G-2 | Mails confirmation offre | A definir | A definir | Faible | G-1 |

---

## Services externes a provisionner

| Service | Usage | Sprint | Action requise |
|---------|-------|--------|---------------|
| **Cloudflare Turnstile** | Captcha inscription | Sprint 1 | Creer compte + obtenir site_key + secret_key |
| **Calendly ou Cal.com** | Prise de rdv | Sprint 2 | Creer compte + configurer creneaux |
| **Stripe** | Paiements en ligne | Sprint 4 | Creer compte + configurer 2 produits (180€, 120€) |
| **Resend** | Email avant-projet@ | Sprint 4 | Ajouter domaine `avant-projet@scantorenov.com` |

---

## Contexte pour Codex/ChatGPT (Sprint 1)

> A copier-coller dans le prompt Codex pour le Sprint 1.

**Stack technique:**
- Frontend: HTML/CSS/JS vanilla (pas de framework)
- Backend: Netlify Functions (Node 18)
- BDD: Supabase (PostgreSQL)
- Auth: Netlify Identity
- Email: Resend (contact@scantorenov.com)
- Pas de bundler, pas de TypeScript

**Fichiers a modifier (Sprint 1):**
- `netlify/functions/contact.js` — emails (A-1)
- `index.html` — formulaire de contact (A-2)
- `espace-client.html` — affichage (A-2)
- `connexion.html` — toggle mdp + captcha (A-3, A-4)
- Nouveau: `netlify/functions/verify-captcha.js` (A-4)

**Conventions:**
- Pas de `const`/`let`, utiliser `var` dans le HTML inline (compatibilite)
- Les fonctions Netlify utilisent `const`/`let` (Node 18)
- Emails envoyes via Resend (`new Resend(process.env.RESEND_API_KEY)`)
- Supabase client: `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)`
