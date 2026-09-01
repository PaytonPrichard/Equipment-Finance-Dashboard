-- ============================================================
-- OPTIONAL -- APPLY SECOND, AND TEST BEFORE YOU TRUST IT
--
-- Closes the database-layer half of AUDIT.md P0-1.
--
-- PROBLEM
-- P0-1 was fixed at the API layer: api/score-deal.js and api/v1.js now
-- discard any client-supplied score and recompute server-side. But the
-- app also writes to Postgres directly from the browser (stage, name,
-- notes, delete -- src/lib/pipeline.ts), and the governing policy is:
--     FOR UPDATE USING (org_id = public.get_user_org_id())
-- Postgres RLS is row-level, not column-level, so one permissive UPDATE
-- policy grants EVERY column. The original attack still works with a
-- different verb:
--     supabase.from('pipeline_deals').update({ score: 100 }).eq('id', N)
-- One line in a browser console, using the anon key that ships in the
-- bundle and the attacker's own valid JWT. No audit row is written.
--
-- FIX
-- Add a WITH CHECK asserting the score is unchanged from the stored
-- value. Same trick as profiles_update_own_no_role in
-- supabase_security_fixes.sql. Server-side writes are unaffected
-- because the service role key bypasses RLS.
--
-- WHY THIS IS FLAGGED OPTIONAL
-- It changes a policy the running app depends on. If any client path
-- updates score directly, that path will start silently failing. Test
-- first (procedure at the bottom).
-- ============================================================

DROP POLICY IF EXISTS "pipeline_deals_update" ON public.pipeline_deals;

CREATE POLICY "pipeline_deals_update" ON public.pipeline_deals
  FOR UPDATE
  USING (org_id = public.get_user_org_id())
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND score IS NOT DISTINCT FROM (
      SELECT d.score FROM public.pipeline_deals d WHERE d.id = pipeline_deals.id
    )
  );

-- IS NOT DISTINCT FROM rather than = so that NULL = NULL compares true.
-- A plain = would reject every update to an unscored deal.

-- ============================================================
-- TEST BEFORE RELYING ON THIS
-- ============================================================
-- 1. Sign in to the app as a normal analyst.
-- 2. Drag a deal between pipeline stages. Rename one. Edit notes.
--    All three must still work -- they do not touch score.
-- 3. Re-score a deal through the UI. Must still work -- that path goes
--    through /api/score-deal, which uses the service role key.
-- 4. In the browser console, confirm the hole is closed:
--       await supabase.from('pipeline_deals').update({ score: 100 }).eq('id', <id>)
--    Expect 0 rows affected or a policy violation. Before this fix it
--    succeeded.
-- 5. If step 2 or 3 breaks, roll back:
--       DROP POLICY IF EXISTS "pipeline_deals_update" ON public.pipeline_deals;
--       CREATE POLICY "pipeline_deals_update" ON public.pipeline_deals
--         FOR UPDATE USING (org_id = public.get_user_org_id());
