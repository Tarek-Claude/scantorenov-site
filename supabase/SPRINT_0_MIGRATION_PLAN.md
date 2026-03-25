# Sprint 0: Database Schema Migration v2 → v3
## Non-Breaking, Phased Migration Approach
**Date**: 2026-03-26
**Status**: Migrations generated and ready for execution

---

## Overview
Sprint 0 executes a 4-phase non-breaking migration to reorganize the clients table into a normalized schema with satellite tables. This approach preserves all data while enabling the new architecture.

### Migration Strategy
- **Phase 1 (S0-1)**: Create new satellite tables ✅ (File exists)
- **Phase 2 (S0-2)**: Migrate data from legacy columns ✅ (Generated)
- **Phase 3 (S0-3)**: Add new column `indicatif` ✅ (Generated)
- **Phase 4 (S0-4)**: Drop legacy columns ✅ (Generated)

---

## Files Created

### S0-1: CREATE SATELLITE TABLES
**File**: `supabase/migrations/202603260002_v3_schema.sql`
**Status**: ✅ Pre-created and validated

**Tables created:**
1. `appointments` - Phone calls, 3D scans, offers
2. `project_notes` - Project summaries, observations, reports
3. `payments` - Stripe transactions
4. `scans` - Matterport models, plans, photos
5. `assignment` - User assignments to resources

**Indexes**: All foreign key columns indexed for performance

---

### S0-2: DATA MIGRATION
**File**: `supabase/migrations/202603260003_migrate_data.sql`
**Status**: ✅ Generated

**Data flows:**
- `clients.matterport_*` + `plans_urls` + `photos_urls` → `scans`
- `clients.call_*` → `appointments`
- `clients.project_*` + `last_action_required` → `project_notes`

**Key features:**
- Preserves all existing data
- Uses `updated_at` timestamps for created_at
- Conditional inserts (only where legacy data exists)
- Includes count verification logging

---

### S0-3: ADD INDICATIF COLUMN
**File**: `supabase/migrations/202603260004_add_indicatif.sql`
**Status**: ✅ Generated

```sql
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS indicatif VARCHAR(5) DEFAULT '+33' NOT NULL;
```

**Purpose**: Phone country code field for internationalization

---

### S0-4: DROP LEGACY COLUMNS
**File**: `supabase/migrations/202603260005_drop_legacy_columns.sql`
**Status**: ✅ Generated

**Columns dropped:**
- Phone: `phone`
- Project: `project_type`, `project_details`, `last_action_required`
- Calls: `call_scheduled_at`, `call_notes`
- Scans: `scan_date_proposed`, `scan_date_confirmed`, `scan_confirmed_by_client`, `matterport_url`, `matterport_model_id`
- Files: `plans_urls`, `photos_urls`

---

## Execution Sequence

Execute migrations in order via Supabase:

```bash
# Check current migration status
supabase migration list

# Push all migrations
supabase db push

# Or manually execute in Supabase dashboard:
# 1. S0-1: 202603260002_v3_schema.sql
# 2. S0-2: 202603260003_migrate_data.sql
# 3. S0-3: 202603260004_add_indicatif.sql
# 4. S0-4: 202603260005_drop_legacy_columns.sql
```

---

## Validation Checklist

After each migration, verify:

### S0-1 Validation
- [ ] Run: `SELECT COUNT(*) FROM public.appointments;`
- [ ] Run: `SELECT COUNT(*) FROM public.project_notes;`
- [ ] Run: `SELECT COUNT(*) FROM public.payments;`
- [ ] Run: `SELECT COUNT(*) FROM public.scans;`
- [ ] Run: `SELECT COUNT(*) FROM public.assignment;`
- [ ] Verify all indexes exist

### S0-2 Validation
- [ ] `SELECT COUNT(*) FROM public.scans;` should show migrated scans
- [ ] `SELECT COUNT(*) FROM public.appointments;` should show migrated calls
- [ ] `SELECT COUNT(*) FROM public.project_notes;` should show migrated projects
- [ ] Spot-check sample data: `SELECT * FROM scans LIMIT 1;`
- [ ] Verify timestamps preserved

### S0-3 Validation
- [ ] `SELECT COUNT(*) FROM public.clients WHERE indicatif IS NULL;` should return 0
- [ ] `SELECT DISTINCT indicatif FROM public.clients;` should show '+33'

### S0-4 Validation
- [ ] Verify columns removed: Run query and ensure columns don't exist
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name='clients' AND column_name IN ('phone', 'matterport_url', 'call_scheduled_at');
  ```
- [ ] Should return empty result set

---

## Rollback Plan

If any phase fails:

1. **Supabase Dashboard**: View migration logs
2. **Revert last migration**: Supabase can revert to previous state
3. **Contact Support**: If manual intervention needed

Each migration uses `IF NOT EXISTS` and `IF EXISTS` to be idempotent.

---

## Next Steps

After Sprint 0 completion:
1. Update API layer to use new satellite tables
2. Update frontend to call new endpoints
3. Plan deprecation of legacy schema (if needed)
4. Begin Sprint A development

---

## Notes

- All migrations wrapped in `BEGIN; ... COMMIT;` for atomicity
- Uses `COALESCE` to handle NULL values safely
- Indexes created on all foreign keys for query performance
- Default timezone: UTC (PostgreSQL `timestamptz`)
