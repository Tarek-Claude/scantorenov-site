-- Sprint 0 Migration Validation Queries
-- Run these after each migration phase to verify correctness
-- ================================================================

-- ================================================================
-- POST S0-1: Validate satellite tables created
-- ================================================================
-- Run this after applying migration 202603260002_v3_schema.sql

-- Verify tables exist
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('appointments', 'project_notes', 'payments', 'scans', 'assignment')
ORDER BY table_name;

-- Verify indexes exist
SELECT
  indexname,
  tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('appointments', 'project_notes', 'payments', 'scans', 'assignment')
ORDER BY tablename, indexname;

-- Verify row counts (should be 0 after creation)
SELECT
  'appointments' as table_name,
  COUNT(*) as row_count
FROM public.appointments
UNION ALL
SELECT 'project_notes', COUNT(*) FROM public.project_notes
UNION ALL
SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL
SELECT 'scans', COUNT(*) FROM public.scans
UNION ALL
SELECT 'assignment', COUNT(*) FROM public.assignment
ORDER BY table_name;

-- ================================================================
-- POST S0-2: Validate data migration
-- ================================================================
-- Run this after applying migration 202603260003_migrate_data.sql

-- Count migrated data
SELECT
  'scans' as table_name,
  COUNT(*) as row_count
FROM public.scans
UNION ALL
SELECT 'appointments', COUNT(*) FROM public.appointments
UNION ALL
SELECT 'project_notes', COUNT(*) FROM public.project_notes
ORDER BY table_name;

-- Verify data integrity - sample matterport migrations
SELECT
  id,
  client_id,
  matterport_model_id,
  matterport_url,
  created_at
FROM public.scans
LIMIT 5;

-- Verify data integrity - sample appointments
SELECT
  id,
  client_id,
  type,
  status,
  scheduled_at,
  notes
FROM public.appointments
LIMIT 5;

-- Verify data integrity - sample project notes
SELECT
  id,
  client_id,
  type,
  summary,
  internal_notes,
  created_at
FROM public.project_notes
LIMIT 5;

-- Check for NULL violations in foreign keys
SELECT
  'scans with NULL client_id' as issue,
  COUNT(*) as count
FROM public.scans
WHERE client_id IS NULL
UNION ALL
SELECT 'appointments with NULL client_id', COUNT(*)
FROM public.appointments
WHERE client_id IS NULL
UNION ALL
SELECT 'project_notes with NULL client_id', COUNT(*)
FROM public.project_notes
WHERE client_id IS NULL;

-- ================================================================
-- POST S0-3: Validate indicatif column
-- ================================================================
-- Run this after applying migration 202603260004_add_indicatif.sql

-- Verify column exists and has correct values
SELECT
  COUNT(*) as total_clients,
  COUNT(DISTINCT indicatif) as distinct_indicatifs,
  COUNT(*) FILTER (WHERE indicatif IS NULL) as null_count,
  COUNT(*) FILTER (WHERE indicatif = '+33') as default_count
FROM public.clients;

-- Check all distinct values
SELECT DISTINCT indicatif
FROM public.clients
ORDER BY indicatif;

-- ================================================================
-- POST S0-4: Validate legacy column removal
-- ================================================================
-- Run this after applying migration 202603260005_drop_legacy_columns.sql

-- Verify legacy columns are removed
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
  AND column_name IN (
    'phone',
    'project_type',
    'project_details',
    'call_scheduled_at',
    'call_notes',
    'scan_date_proposed',
    'scan_date_confirmed',
    'scan_confirmed_by_client',
    'matterport_url',
    'matterport_model_id',
    'plans_urls',
    'photos_urls',
    'last_action_required'
  )
ORDER BY column_name;

-- Should return empty result if all columns deleted successfully

-- Verify new column exists
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
  AND column_name = 'indicatif';

-- List all remaining columns in clients table
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
ORDER BY ordinal_position;

-- ================================================================
-- OVERALL INTEGRITY CHECK
-- ================================================================
-- Run this at the end to verify complete migration

-- 1. Verify no orphaned appointments/project_notes (FK integrity)
SELECT
  'orphaned scans' as issue,
  COUNT(*) as count
FROM public.scans
WHERE client_id NOT IN (SELECT id FROM public.clients)
UNION ALL
SELECT 'orphaned appointments', COUNT(*)
FROM public.appointments
WHERE client_id NOT IN (SELECT id FROM public.clients)
UNION ALL
SELECT 'orphaned project_notes', COUNT(*)
FROM public.project_notes
WHERE client_id NOT IN (SELECT id FROM public.clients)
UNION ALL
SELECT 'orphaned payments', COUNT(*)
FROM public.payments
WHERE client_id NOT IN (SELECT id FROM public.clients);

-- Should return 0 for all rows

-- 2. Summary statistics
SELECT
  (SELECT COUNT(*) FROM public.clients) as total_clients,
  (SELECT COUNT(*) FROM public.scans) as total_scans,
  (SELECT COUNT(*) FROM public.appointments) as total_appointments,
  (SELECT COUNT(*) FROM public.project_notes) as total_project_notes,
  (SELECT COUNT(*) FROM public.payments) as total_payments,
  (SELECT COUNT(*) FROM public.assignment) as total_assignments;

-- 3. Verify CASCADE DELETE works (test with one client deletion, then rollback)
-- DO NOT RUN IN PRODUCTION - for testing only
-- BEGIN;
-- DELETE FROM public.clients WHERE id = 'test-client-id';
-- SELECT COUNT(*) FROM public.scans WHERE client_id = 'test-client-id'; -- should be 0
-- ROLLBACK;
