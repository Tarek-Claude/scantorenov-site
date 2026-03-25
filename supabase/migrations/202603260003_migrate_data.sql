-- Sprint 0: S0-2 DATA MIGRATION
-- Phase 2: Migrate legacy data from clients table to satellite tables
-- Non-breaking: All existing data is preserved with proper timestamps
-- =====================================================================

BEGIN;

-- ============================================================
-- 1. MIGRATE MATTERPORT DATA → scans table
-- ============================================================
INSERT INTO public.scans (
  client_id,
  matterport_model_id,
  matterport_url,
  matterport_data,
  scan_date,
  scanned_by,
  observations,
  plans_urls,
  photos_urls,
  is_primary,
  created_at
)
SELECT
  c.id as client_id,
  c.matterport_model_id,
  c.matterport_url,
  NULL::jsonb as matterport_data,
  c.scan_date_confirmed as scan_date,
  NULL::text as scanned_by,
  NULL::text as observations,
  COALESCE(c.plans_urls, '{}') as plans_urls,
  COALESCE(c.photos_urls, '{}') as photos_urls,
  true as is_primary,
  COALESCE(c.updated_at, now()) as created_at
FROM public.clients c
WHERE c.matterport_model_id IS NOT NULL
  OR c.matterport_url IS NOT NULL
  OR c.plans_urls IS NOT NULL
  OR c.photos_urls IS NOT NULL;

-- ============================================================
-- 2. MIGRATE CALL/APPOINTMENT DATA → appointments table
-- ============================================================
INSERT INTO public.appointments (
  client_id,
  type,
  status,
  scheduled_at,
  duration_minutes,
  location,
  notes,
  created_at,
  updated_at
)
SELECT
  c.id as client_id,
  'phone_call'::text as type,
  CASE
    WHEN c.call_scheduled_at IS NOT NULL THEN 'scheduled'
    ELSE 'requested'
  END as status,
  c.call_scheduled_at as scheduled_at,
  NULL::integer as duration_minutes,
  NULL::text as location,
  c.call_notes as notes,
  COALESCE(c.updated_at, now()) as created_at,
  COALESCE(c.updated_at, now()) as updated_at
FROM public.clients c
WHERE c.call_scheduled_at IS NOT NULL
  OR c.call_notes IS NOT NULL;

-- ============================================================
-- 3. MIGRATE PROJECT/PHASE DATA → project_notes table
-- ============================================================
INSERT INTO public.project_notes (
  client_id,
  appointment_id,
  type,
  summary,
  needs,
  interest_level,
  confirmed_budget,
  confirmed_surface,
  constraints,
  technical_points,
  internal_notes,
  report_url,
  report_storage_path,
  created_by,
  created_at
)
SELECT
  c.id as client_id,
  NULL::uuid as appointment_id,
  'phone_summary'::text as type,
  c.project_details as summary,
  NULL::text[] as needs,
  NULL::text as interest_level,
  NULL::text as confirmed_budget,
  NULL::text as confirmed_surface,
  NULL::text as constraints,
  NULL::text[] as technical_points,
  c.last_action_required as internal_notes,
  NULL::text as report_url,
  NULL::text as report_storage_path,
  NULL::text as created_by,
  COALESCE(c.updated_at, now()) as created_at
FROM public.clients c
WHERE c.project_details IS NOT NULL
  OR c.last_action_required IS NOT NULL;

-- ============================================================
-- Log migration statistics
-- ============================================================
DO $$
DECLARE
  scans_count INT;
  appointments_count INT;
  project_notes_count INT;
BEGIN
  SELECT COUNT(*) INTO scans_count FROM public.scans;
  SELECT COUNT(*) INTO appointments_count FROM public.appointments;
  SELECT COUNT(*) INTO project_notes_count FROM public.project_notes;

  RAISE NOTICE 'S0-2 Data Migration Complete:';
  RAISE NOTICE '  - Scans migrated: %', scans_count;
  RAISE NOTICE '  - Appointments created: %', appointments_count;
  RAISE NOTICE '  - Project notes created: %', project_notes_count;
END $$;

COMMIT;
