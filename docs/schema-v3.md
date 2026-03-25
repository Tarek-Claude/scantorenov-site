# Schema v3 — Architecture relationnelle 4 tables

> Date: 26/03/2026
> Valide par: Tarek BECHAR

## Principe

1 table maitre `clients` + 4 tables satellites.
La table `documents` du v2 est supprimee : les fichiers visuels/spatiaux vont dans `scans`, les ecrits/rapports vont dans `project_notes`.

```
clients (maitre)
  ├── appointments      (rdv tel + scan + offre)              1-to-N
  ├── project_notes     (syntheses, observations, rapports)   1-to-N
  ├── payments          (paiements Stripe)                    1-to-N
  └── scans             (Matterport + plans + photos)         1-to-N
```

## Table `clients` (maitre)

```sql
CREATE TABLE IF NOT EXISTS public.clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT UNIQUE NOT NULL,
  genre                 TEXT,
  prenom                TEXT,
  nom                   TEXT,
  telephone             TEXT,
  indicatif             TEXT DEFAULT '+33',
  adresse               TEXT,

  status                TEXT DEFAULT 'new_lead',
  phase                 INTEGER,
  qualite               TEXT,

  type_bien             TEXT,
  demande               TEXT,
  budget                TEXT,
  echeance              TEXT,
  surface               TEXT,

  marcel_system_prompt  TEXT,
  marcel_enabled        BOOLEAN DEFAULT false,
  avant_projet_enabled  BOOLEAN DEFAULT false,

  stripe_customer_id    TEXT,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
```

**Colonnes supprimees** (migrees vers satellites ou doublons) :
- `phone` → doublon de `telephone`
- `project_type` → doublon de `type_bien`
- `project_details` → doublon de `demande`
- `matterport_iframe` → doublon de `matterport_url`
- `call_scheduled_at`, `call_notes` → `appointments` + `project_notes`
- `scan_date_proposed`, `scan_date_confirmed`, `scan_confirmed_by_client` → `appointments`
- `matterport_model_id`, `matterport_url`, `matterport_data` → `scans`
- `plans_urls`, `photos_urls` → `scans`
- `last_action_required` → derive du statut

---

## Table `appointments`

Tous les rdv du parcours : telephonique, scan 3D, discussion offre.

```sql
CREATE TABLE IF NOT EXISTS public.appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,       -- 'phone_call' | 'scan_3d' | 'phone_offer'
  status            TEXT DEFAULT 'requested',  -- 'requested' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  scheduled_at      TIMESTAMPTZ,
  duration_minutes  INTEGER,
  location          TEXT,                -- adresse du bien pour scan
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_appointments_client_id ON public.appointments(client_id);
```

---

## Table `project_notes`

> Anciennement `call_summaries` dans v2. Renommee pour refleter le contenu elargi.

Tous les ecrits structures du parcours : synthese d'appel, observations de scan, rapport d'avant-projet.

```sql
CREATE TABLE IF NOT EXISTS public.project_notes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id           UUID REFERENCES public.appointments(id),  -- nullable, lie a un rdv si pertinent
  type                    TEXT NOT NULL,   -- 'phone_summary' | 'scan_observation' | 'avant_projet_report'
  summary                 TEXT,            -- resume libre
  needs                   TEXT[],          -- besoins identifies
  interest_level          TEXT,            -- 'low' | 'medium' | 'high'
  confirmed_budget        TEXT,
  confirmed_surface       TEXT,
  constraints             TEXT,
  technical_points        TEXT[],          -- observations techniques (scan)
  internal_notes          TEXT,            -- non visible par le client
  report_url              TEXT,            -- URL du PDF genere (pour type 'avant_projet_report')
  report_storage_path     TEXT,            -- chemin Supabase Storage
  created_by              TEXT,            -- email du chef de projet ou 'system'
  created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_notes_client_id ON public.project_notes(client_id);
```

**Cas d'usage par type :**
| Type | Quand | Champs principaux |
|------|-------|-------------------|
| `phone_summary` | Apres appel tel (C-1) | summary, needs, interest_level, confirmed_budget, confirmed_surface, constraints, internal_notes |
| `scan_observation` | Apres scan 3D (E-1) | summary, technical_points, constraints, internal_notes |
| `avant_projet_report` | Generation rapport (F-1) | summary, report_url, report_storage_path |

---

## Table `payments`

Tous les paiements Stripe du parcours.

```sql
CREATE TABLE IF NOT EXISTS public.payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_session_id       TEXT,
  stripe_payment_intent   TEXT,
  type                    TEXT NOT NULL,    -- 'scan_3d' | 'virtual_tour' | 'accompaniment'
  amount_cents            INTEGER NOT NULL, -- 18000, 12000, etc.
  currency                TEXT DEFAULT 'eur',
  status                  TEXT DEFAULT 'pending',  -- 'pending' | 'completed' | 'refunded' | 'failed'
  description             TEXT,
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_client_id ON public.payments(client_id);
```

---

## Table `scans`

Donnees Matterport + tous les fichiers visuels/spatiaux associes (plans, photos).

```sql
CREATE TABLE IF NOT EXISTS public.scans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  matterport_model_id TEXT,
  matterport_url      TEXT,
  matterport_data     JSONB,              -- donnees spatiales structurees
  scan_date           TIMESTAMPTZ,
  scanned_by          TEXT,               -- chef de projet
  observations        TEXT,
  plans_urls          TEXT[] DEFAULT '{}', -- URLs des plans (Supabase Storage)
  photos_urls         TEXT[] DEFAULT '{}', -- URLs des photos
  csv_url             TEXT,               -- fichier CSV Matterport
  is_primary          BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scans_client_id ON public.scans(client_id);
```

---

## Statuts pipeline v3

```
new_lead                  → Visiteur/Demandeur (formulaire soumis)
account_created           → Visiteur/Demandeur (compte cree)
call_requested            → Visiteur/Demandeur (rdv telephone demande)
call_done                 → Prospect/Interesse (appel realise)
scan_scheduled            → Prospect/Interesse (rdv scan programme)
scan_payment_completed    → Client/Avant-projet (180€ paye)
scan_completed            → Client/Avant-projet (scan realise)
analysis_ready            → Client/Avant-projet (visite virtuelle + Marcel actifs)
avant_projet_ready        → Client/Avant-projet (rapport genere)
accompaniment_subscribed  → Client/Accompagne (offre souscrite)
```

---

## Diagramme

```
                    ┌─────────────────┐
                    │     clients     │
                    │    (maitre)     │
                    │  id, email,     │
                    │  status, ...    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐────────────────┐
        │                    │                    │                │
 ┌──────▼───────┐   ┌───────▼────────┐   ┌──────▼───────┐  ┌─────▼──────┐
 │ appointments │   │ project_notes  │   │   payments   │  │   scans    │
 │              │   │                │   │              │  │            │
 │ type:        │   │ type:          │   │ type:        │  │ matterport │
 │  phone_call  │   │  phone_summary │   │  scan_3d     │  │ plans[]    │
 │  scan_3d     │   │  scan_observ.  │   │  virtual_tour│  │ photos[]   │
 │  phone_offer │   │  avant_projet  │   │  accompanim. │  │ csv        │
 └──────────────┘   └────────────────┘   └──────────────┘  └────────────┘
```
