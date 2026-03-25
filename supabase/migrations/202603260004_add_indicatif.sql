-- Sprint 0: S0-3 ADD INDICATIF COLUMN
-- Phase 3: Add phone country code column
-- This supports normalized phone number handling for international support
-- =====================================================================

BEGIN;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS indicatif VARCHAR(5) DEFAULT '+33' NOT NULL;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'S0-3 Complete: indicatif column added to clients table with default +33';
END $$;

COMMIT;
