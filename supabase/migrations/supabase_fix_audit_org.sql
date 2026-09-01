-- ============================================================
-- Security fix: scope audit_log INSERT to the caller's own org
--
-- PROBLEM
-- The original policy (supabase_schema.sql:197) was:
--     FOR INSERT WITH CHECK (auth.uid() = user_id)
-- It verified WHO was writing but not WHICH ORG they wrote to. Any
-- authenticated user could insert an audit row carrying an arbitrary
-- org_id -- including a competitor's -- with arbitrary action,
-- entity_type, old_values and new_values. That row then renders in the
-- target org's audit viewer to their admins, senior analysts, and
-- credit committee.
--
-- Cross-tenant log injection into the one table whose entire value is
-- being trustworthy.
--
-- FIX
-- Add the org predicate. get_user_org_id() is SECURITY DEFINER (see
-- supabase_fix_policies.sql) so it reads profiles without re-triggering
-- RLS on profiles.
--
-- SAFETY
-- The app only ever writes audit rows for the caller's own org
-- (src/lib/audit.ts), and server-side writes go through the service
-- role key, which bypasses RLS entirely. So no legitimate write path
-- is affected.
--
-- Apply in the Supabase SQL editor. Idempotent -- safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;

CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND org_id = public.get_user_org_id()
  );

-- Still no UPDATE or DELETE policies. RLS denies by default, so the
-- table remains append-only for every client-side caller.


-- ============================================================
-- Hardening: constrain asset_class to known values
--
-- PROBLEM
-- pipeline_deals.asset_class and saved_deals.asset_class are plain TEXT
-- with DEFAULT 'equipment_finance' and no constraint. getModule() in
-- src/modules/index.js falls back silently:
--     return MODULES[key] || MODULES.equipment_finance;
-- So a typo'd or corrupt asset_class does not error -- it scores an AR
-- or inventory deal under the equipment-finance model and produces a
-- plausible-looking wrong number on a committee memo.
--
-- The database is the right place to stop this.
-- ============================================================

ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_asset_class_check;
ALTER TABLE public.pipeline_deals
  ADD CONSTRAINT pipeline_deals_asset_class_check
  CHECK (asset_class IN ('equipment_finance', 'accounts_receivable', 'inventory_finance'));

ALTER TABLE public.saved_deals
  DROP CONSTRAINT IF EXISTS saved_deals_asset_class_check;
ALTER TABLE public.saved_deals
  ADD CONSTRAINT saved_deals_asset_class_check
  CHECK (asset_class IN ('equipment_finance', 'accounts_receivable', 'inventory_finance'));


-- ============================================================
-- VERIFY (run separately after applying)
-- ============================================================
-- SELECT policyname, cmd, with_check
--   FROM pg_policies
--  WHERE tablename = 'audit_log';
--
-- Expected: audit_log_select (SELECT), audit_log_insert (INSERT with
-- both predicates). No UPDATE or DELETE rows.
