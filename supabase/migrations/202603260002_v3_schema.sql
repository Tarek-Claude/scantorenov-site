-- Sprint 0: Database Schema Migration V2 → V3
-- Four-phase non-breaking migration approach
-- =====================================================

-- S0-1: CREATE SATELLITE TABLES
-- Phase 1: Create all new satellite tables and assignment table
-- This phase introduces the new structure without touching existing data

CREATE TABLE IF NOT EXISTS public.appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,       -- 'phone_call' | 'scan_3d' | 'phone_offer'
  status            TEXT DEFAULT 'requested',
  scheduled_at      TIMESTAMPTZ,
  duration_minutes  INTEGER,
  location          TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);


CREATE TABLE IF NOT EXISTS public.project_notes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id          UUID REFERENCES public.appointments(id),
  type                    TEXT NOT NULL,   -- 'phone_summary' | 'scan_observation' | 'avant_projet_report'
  summary                 TEXT,
  needs                   TEXT[],
  interest_level          TEXT,
  confirmed_budget        TEXT,
  confirmed_surface       TEXT,
  constraints             TEXT,
  technical_points        TEXT[],
  internal_notes          TEXT,
  report_url              TEXT,
  report_storage_path     TEXT,
  created_by              TEXT,
  created_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_notes_client_id ON public.project_notes(client_id);


CREATE TABLE IF NOT EXISTS public.payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_session_id       TEXT,
  stripe_payment_intent   TEXT,
  type                    TEXT NOT NULL,    -- 'scan_3d' | 'virtual_tour' | 'accompaniment'
  amount_cents            INTEGER NOT NULL,
  currency                TEXT DEFAULT 'eur',
  status                  TEXT DEFAULT 'pending',
  description             TEXT,
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);


CREATE TABLE IF NOT EXISTS public.scans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  matterport_model_id TEXT,
  matterport_url      TEXT,
  matterport_data     JSONB,
  scan_date           TIMESTAMPTZ,
  scanned_by          TEXT,
  observations        TEXT,
  plans_urls          TEXT[] DEFAULT '{}',
  photos_urls         TEXT[] DEFAULT '{}',
  csv_url             TEXT,
  is_primary          BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scans_client_id ON public.scans(client_id);


CREATE TABLE IF NOT EXISTS public.assignment (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  assignable_id       UUID NOT NULL,
  assignable_type     TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignment_user_id ON public.assignment(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_assignable ON public.assignment(assignable_id, assignable_type);
