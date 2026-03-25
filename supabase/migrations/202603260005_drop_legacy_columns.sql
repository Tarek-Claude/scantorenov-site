-- Sprint 0: S0-4 DROP LEGACY COLUMNS
-- Phase 4: Remove legacy columns after data has been migrated to satellite tables
-- This completes the schema cleanup
-- =====================================================================

BEGIN;

-- Drop legacy columns from clients table
-- These columns have been migrated to satellite tables in S0-2
ALTER TABLE public.clients
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS project_type,
DROP COLUMN IF EXISTS project_details,
DROP COLUMN IF EXISTS call_scheduled_at,
DROP COLUMN IF EXISTS call_notes,
DROP COLUMN IF EXISTS scan_date_proposed,
DROP COLUMN IF EXISTS scan_date_confirmed,
DROP COLUMN IF EXISTS scan_confirmed_by_client,
DROP COLUMN IF EXISTS matterport_url,
DROP COLUMN IF EXISTS matterport_model_id,
DROP COLUMN IF EXISTS plans_urls,
DROP COLUMN IF EXISTS photos_urls,
DROP COLUMN IF EXISTS last_action_required;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'S0-4 Complete: Legacy columns removed from clients table';
  RAISE NOTICE '  - phone';
  RAISE NOTICE '  - project_type';
  RAISE NOTICE '  - project_details';
  RAISE NOTICE '  - call_scheduled_at';
  RAISE NOTICE '  - call_notes';
  RAISE NOTICE '  - scan_date_proposed';
  RAISE NOTICE '  - scan_date_confirmed';
  RAISE NOTICE '  - scan_confirmed_by_client';
  RAISE NOTICE '  - matterport_url';
  RAISE NOTICE '  - matterport_model_id';
  RAISE NOTICE '  - plans_urls';
  RAISE NOTICE '  - photos_urls';
  RAISE NOTICE '  - last_action_required';
END $$;

COMMIT;
