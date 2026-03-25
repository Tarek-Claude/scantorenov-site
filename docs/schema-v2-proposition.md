# Proposition Schema v2 — Architecture relationnelle

> Date: 26/03/2026
> Auteur: Claude (proposition pour validation Tarek)

## Principe

UNE table maitre `clients` (identite + statut) + tables satellites pour les donnees relationnelles (1-to-many).

Le client est UNE entite tout au long de son parcours. Son statut evolue, mais ses donnees s'enrichissent sans se deplacer.

## Pourquoi ne PAS decouper par statut

| Approche | Avantage | Inconvenient |
|----------|----------|--------------|
| 4 tables par statut | Semantique claire | Deplacement de donnees a chaque transition, JOINs complexes, 12 fonctions a reecrire, risque de perte de donnees |
| 1 table unique (actuel) | Simple, toutes les fonctions marchent | Trop de colonnes, pas de 1-to-many, donnees heterogenes melangees |
| **1 table maitre + satellites** | **Evolutif, propre, compatible existant** | **Migration initiale a planifier** |

## Schema propose

### Table `clients` (table maitre — simplifiee)

Conserve UNIQUEMENT l'identite, le statut et les metadonnees projet de base.

```
clients
├── id                  UUID (PK, auto-generated) ← NOUVEAU
├── email               TEXT (UNIQUE, NOT NULL)
├── genre               TEXT
├── prenom              TEXT
├── nom                 TEXT
├── telephone           TEXT
├── indicatif           TEXT DEFAULT '+33'  ← NOUVEAU
├── adresse             TEXT
│
├── status              TEXT DEFAULT 'new_lead'
├── phase               INTEGER
├── qualite             TEXT
│
├── type_bien           TEXT
├── demande             TEXT
├── budget              TEXT
├── echeance            TEXT
├── surface             TEXT
│
├── marcel_system_prompt TEXT
├── marcel_enabled       BOOLEAN DEFAULT false
├── avant_projet_enabled BOOLEAN DEFAULT false
│
├── stripe_customer_id   TEXT  ← NOUVEAU
│
├── created_at          TIMESTAMPTZ DEFAULT now()  ← NOUVEAU
├── updated_at          TIMESTAMPTZ DEFAULT now()
```

**Colonnes SUPPRIMEES de clients** (migrees vers tables satellites) :
- `phone`, `project_type`, `project_details` → doublons supprimes (on garde `telephone`, `type_bien`, `demande`)
- `call_scheduled_at`, `call_notes` → migres vers `appointments` + `call_summaries`
- `scan_date_proposed`, `scan_date_confirmed`, `scan_confirmed_by_client` → migres vers `appointments`
- `matterport_model_id`, `matterport_url`, `matterport_iframe`, `matterport_data` → migres vers `scans`
- `plans_urls`, `photos_urls` → migres vers `documents`
- `last_action_required` → derive du statut, plus besoin de stocker

---

### Table `appointments` (rdv telephoniques + scans)

Un client peut avoir PLUSIEURS rdv (tel phase 1, scan phase 2, tel phase 3...).

```
appointments
├── id                  UUID (PK)
├── client_id           UUID (FK → clients.id)
├── type                TEXT ('phone_call' | 'scan_3d' | 'phone_offer')
├── status              TEXT ('requested' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled')
├── scheduled_at        TIMESTAMPTZ
├── duration_minutes    INTEGER
├── location            TEXT  (pour scan: adresse du bien)
├── notes               TEXT
├── created_at          TIMESTAMPTZ DEFAULT now()
├── updated_at          TIMESTAMPTZ DEFAULT now()
```

**Avantage:** Plus besoin de colonnes separees pour chaque type de rdv. Un prospect peut avoir 3 rdv (tel + scan + tel offre) tous dans la meme table.

---

### Table `call_summaries` (syntheses d'echanges)

Formulaire complete par le chef de projet apres chaque echange.

```
call_summaries
├── id                  UUID (PK)
├── client_id           UUID (FK → clients.id)
├── appointment_id      UUID (FK → appointments.id, nullable)
├── summary             TEXT (resume libre)
├── needs               TEXT[] (besoins identifies)
├── interest_level      TEXT ('low' | 'medium' | 'high')
├── confirmed_budget    TEXT
├── confirmed_surface   TEXT
├── constraints         TEXT
├── technical_points    TEXT[] (observations techniques)
├── internal_notes      TEXT (non visible par le client)
├── created_by          TEXT (email du chef de projet)
├── created_at          TIMESTAMPTZ DEFAULT now()
```

**Avantage:** Historique complet des echanges. Le formulaire de synthese telephonique (C-1) et le formulaire enrichi post-scan (E-1) sont dans la meme table, lies a des rdv differents.

---

### Table `payments` (paiements Stripe)

Un client peut effectuer PLUSIEURS paiements (scan 180€, visite 120€, accompagnement X€).

```
payments
├── id                  UUID (PK)
├── client_id           UUID (FK → clients.id)
├── stripe_session_id   TEXT
├── stripe_payment_intent TEXT
├── type                TEXT ('scan_3d' | 'virtual_tour' | 'accompaniment')
├── amount_cents        INTEGER (18000, 12000, etc.)
├── currency            TEXT DEFAULT 'eur'
├── status              TEXT ('pending' | 'completed' | 'refunded' | 'failed')
├── description         TEXT
├── paid_at             TIMESTAMPTZ
├── created_at          TIMESTAMPTZ DEFAULT now()
```

**Avantage:** Tracabilite financiere complete. Chaque paiement est un enregistrement distinct avec son statut propre.

---

### Table `scans` (donnees Matterport)

Un client pourrait avoir PLUSIEURS scans (bien principal + dependances, ou nouveau scan apres travaux).

```
scans
├── id                  UUID (PK)
├── client_id           UUID (FK → clients.id)
├── matterport_model_id TEXT
├── matterport_url      TEXT
├── matterport_data     JSONB (donnees spatiales structurees)
├── scan_date           TIMESTAMPTZ
├── scanned_by          TEXT (chef de projet)
├── observations        TEXT
├── is_primary          BOOLEAN DEFAULT true
├── created_at          TIMESTAMPTZ DEFAULT now()
```

---

### Table `documents` (fichiers uploades et generes)

Plans, photos, rapports — tout au meme endroit.

```
documents
├── id                  UUID (PK)
├── client_id           UUID (FK → clients.id)
├── scan_id             UUID (FK → scans.id, nullable)
├── type                TEXT ('plan' | 'photo' | 'report' | 'simulation' | 'csv')
├── name                TEXT
├── url                 TEXT
├── storage_path        TEXT (Supabase Storage path)
├── uploaded_by         TEXT ('client' | 'admin' | 'system')
├── created_at          TIMESTAMPTZ DEFAULT now()
```

---

## Diagramme des relations

```
                    ┌─────────────┐
                    │   clients   │
                    │  (maitre)   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐────────────────┐
          │                │                │                │
   ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
   │appointments │  │call_summaries│ │  payments   │  │   scans    │
   │  (1-to-N)  │  │  (1-to-N)  │  │  (1-to-N)  │  │  (1-to-N)  │
   └─────────────┘  └────────────┘  └─────────────┘  └──────┬─────┘
                                                             │
                                                      ┌──────▼──────┐
                                                      │  documents  │
                                                      │  (1-to-N)  │
                                                      └─────────────┘
```

## Statuts pipeline enrichis

```
new_lead                  → Visiteur/Demandeur (formulaire soumis)
account_created           → Visiteur/Demandeur (compte cree)
call_requested            → Visiteur/Demandeur (rdv telephone demande)
call_done                 → Prospect/Interesse (appel realise, synthese faite)
scan_scheduled            → Prospect/Interesse (rdv scan programme)
scan_payment_completed    → Client/Avant-projet (paiement 180€ valide) ← NOUVEAU
scan_completed            → Client/Avant-projet (scan realise)
analysis_ready            → Client/Avant-projet (visite virtuelle + Marcel actifs)
avant_projet_ready        → Client/Avant-projet (rapport genere)
accompaniment_subscribed  → Client/Accompagne (offre souscrite) ← NOUVEAU
```

## Strategie de migration

### Phase 1 : Creer les nouvelles tables (non-cassant)
- Creer appointments, call_summaries, payments, scans, documents
- Ajouter id (UUID), indicatif, stripe_customer_id, created_at a clients
- NE PAS supprimer les anciennes colonnes

### Phase 2 : Migrer les donnees existantes
- Copier call_scheduled_at + call_notes → appointments + call_summaries
- Copier matterport_* → scans
- Copier plans_urls, photos_urls → documents

### Phase 3 : Adapter les fonctions (progressif)
- Modifier les fonctions une par une pour utiliser les nouvelles tables
- Garder la retro-compatibilite (lecture anciennes colonnes si nouvelles tables vides)

### Phase 4 : Nettoyage
- Supprimer les colonnes dupliquees (phone, project_type, project_details, matterport_iframe)
- Supprimer les colonnes migrees une fois toutes les fonctions adaptees

## Impact sur les sprints

Cette refactorisation s'integre au **Sprint 2** (avant de developper les nouvelles fonctionnalites).
Les Sprints 3-7 utilisent directement le nouveau schema.
