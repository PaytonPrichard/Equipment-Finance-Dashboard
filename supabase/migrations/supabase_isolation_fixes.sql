-- ============================================================
-- Isolation fixes, 2026-10-06
--
-- Found by scripts/isolation-test.js against production, with two
-- throwaway firms attacking each other through the public anon key.
-- Rerun that script after applying this; it must report 0 leaks.
--
--   1. Any signed-in user could change their own profile's org_id and
--      become a member of any firm whose id they knew.
--   2. Any signed-in user could list, download, sign links to and write
--      into every firm's folder in the deal-documents bucket. The folder
--      names are org ids, which fed hole 1.
--   3. Saved deals could be inserted into another firm.
--   4. redeem_signup_invite was callable from the browser and trusted the
--      caller's p_user_id: anyone with an unused code could pull another
--      user out of their firm.
--   5. Analysts could mint API keys and register webhooks, and every
--      member could read webhook secrets.
--   6. Removing a team member was rejected by RLS, so removed members
--      kept access.
--   7. Delete policies checked role without org; plan fields were
--      editable by an org admin; facility and covenant rows could point at
--      another firm's rows; definer functions had no fixed search_path.
--
-- Idempotent. Run the whole file in the Supabase SQL editor. The last
-- statement prints the storage policies that remain, for a visual check.
-- ============================================================


-- ---- 1. Membership and role change only through server paths ----
-- A trigger, not a policy, so it holds whatever policies exist. Database
-- functions (invites, transfer_admin, remove_member) run as their owner
-- and the service role is not 'authenticated', so both pass.

CREATE OR REPLACE FUNCTION public.guard_profile_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.role IS DISTINCT FROM OLD.role THEN
    -- The one browser path left: an admin changing another member's role
    -- inside their own org (TeamManagement).
    IF NEW.org_id IS NOT DISTINCT FROM OLD.org_id
       AND OLD.id <> auth.uid()
       AND EXISTS (
         SELECT 1 FROM public.profiles a
         WHERE a.id = auth.uid() AND a.role = 'admin' AND a.org_id = OLD.org_id
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Organization membership and roles change only through invites and admin actions'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS guard_profile_membership ON public.profiles;
CREATE TRIGGER guard_profile_membership
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_membership();

-- Removing a member, which the browser could not do under RLS.
CREATE OR REPLACE FUNCTION public.remove_member(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT org_id INTO v_org FROM public.profiles WHERE id = auth.uid() AND role = 'admin';
  IF v_org IS NULL THEN
    RETURN json_build_object('error', 'Only admins can remove members');
  END IF;
  IF p_user_id = auth.uid() THEN
    RETURN json_build_object('error', 'Transfer admin rights before leaving');
  END IF;
  UPDATE public.profiles SET org_id = NULL, role = 'analyst'
    WHERE id = p_user_id AND org_id = v_org;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Member not found in your organization');
  END IF;
  DELETE FROM public.active_sessions WHERE user_id = p_user_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.remove_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID) TO authenticated;

-- Profiles: no longer list users who have no org. That clause was also
-- true for anonymous visitors.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR org_id = public.get_user_org_id()
  );


-- ---- 2. Documents: a firm sees only its own folder ----
-- Paths are {org_id}/... for deal and facility documents alike.
--
-- Every storage policy except the four below is dropped, whatever its
-- name or condition. The first version dropped only policies mentioning
-- the bucket, and three dashboard-made ones ("Authenticated users can
-- download fm315j_0" and its upload and delete twins, condition `true`,
-- no bucket check) survived and kept every firm's files open. Policies
-- combine with OR, so one permissive survivor defeats the rest.

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname NOT LIKE 'deal_documents_org_%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "deal_documents_org_select" ON storage.objects;
DROP POLICY IF EXISTS "deal_documents_org_insert" ON storage.objects;
DROP POLICY IF EXISTS "deal_documents_org_update" ON storage.objects;
DROP POLICY IF EXISTS "deal_documents_org_delete" ON storage.objects;

UPDATE storage.buckets SET public = false WHERE id = 'deal-documents';

CREATE POLICY "deal_documents_org_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'deal-documents' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
CREATE POLICY "deal_documents_org_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deal-documents' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
CREATE POLICY "deal_documents_org_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'deal-documents' AND (storage.foldername(name))[1] = public.get_user_org_id()::text)
  WITH CHECK (bucket_id = 'deal-documents' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);
CREATE POLICY "deal_documents_org_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deal-documents' AND (storage.foldername(name))[1] = public.get_user_org_id()::text);


-- ---- 3. Deals are written only into the caller's own org ----

DROP POLICY IF EXISTS "saved_deals_insert" ON public.saved_deals;
CREATE POLICY "saved_deals_insert" ON public.saved_deals
  FOR INSERT WITH CHECK (auth.uid() = user_id AND org_id = public.get_user_org_id());
DROP POLICY IF EXISTS "saved_deals_update" ON public.saved_deals;
CREATE POLICY "saved_deals_update" ON public.saved_deals
  FOR UPDATE USING (auth.uid() = user_id AND org_id = public.get_user_org_id())
  WITH CHECK (auth.uid() = user_id AND org_id = public.get_user_org_id());
DROP POLICY IF EXISTS "saved_deals_delete" ON public.saved_deals;
CREATE POLICY "saved_deals_delete" ON public.saved_deals
  FOR DELETE USING (auth.uid() = user_id AND org_id = public.get_user_org_id());

DROP POLICY IF EXISTS "pipeline_deals_insert" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_insert" ON public.pipeline_deals
  FOR INSERT WITH CHECK (auth.uid() = user_id AND org_id = public.get_user_org_id());
DROP POLICY IF EXISTS "pipeline_deals_update" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_update" ON public.pipeline_deals
  FOR UPDATE USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());
DROP POLICY IF EXISTS "pipeline_deals_delete" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_delete" ON public.pipeline_deals
  FOR DELETE USING (
    org_id = public.get_user_org_id()
    AND (auth.uid() = user_id OR public.get_user_role() IN ('admin', 'credit_committee'))
  );

DROP POLICY IF EXISTS "facilities_delete" ON public.facilities;
CREATE POLICY "facilities_delete" ON public.facilities
  FOR DELETE USING (
    org_id = public.get_user_org_id()
    AND (auth.uid() = user_id OR public.get_user_role() IN ('admin', 'credit_committee'))
  );

DROP POLICY IF EXISTS "Users can delete own attachments" ON public.deal_attachments;
CREATE POLICY "Users can delete own attachments" ON public.deal_attachments
  FOR DELETE USING (
    org_id = public.get_user_org_id()
    AND (uploaded_by = auth.uid() OR public.get_user_role() = 'admin')
  );

DROP POLICY IF EXISTS "facility_attachments_delete" ON public.facility_attachments;
CREATE POLICY "facility_attachments_delete" ON public.facility_attachments
  FOR DELETE USING (
    org_id = public.get_user_org_id()
    AND (uploaded_by = auth.uid() OR public.get_user_role() = 'admin')
  );


-- ---- 4. Server-only functions ----

REVOKE ALL ON FUNCTION public.redeem_signup_invite(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_signup_invite(TEXT, UUID, TEXT, TEXT) TO service_role;

-- create_org is live but not in the repo and the app never calls it.
-- Every overload is closed to browsers.
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_org'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- Every SECURITY DEFINER function in public gets a fixed search_path.
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.sig);
  END LOOP;
END $$;


-- ---- 5. Integrations: admin reads, server writes ----
-- No browser code writes api_keys or webhooks; /api/v1 does, with the
-- service role. Browser writes are removed and reads limited to admins,
-- since webhook rows carry their signing secret.

DROP POLICY IF EXISTS "api_keys_org_insert" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_org_update" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_org_delete" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_org_read" ON public.api_keys;
CREATE POLICY "api_keys_org_read" ON public.api_keys
  FOR SELECT USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "webhooks_org_insert" ON public.webhooks;
DROP POLICY IF EXISTS "webhooks_org_update" ON public.webhooks;
DROP POLICY IF EXISTS "webhooks_org_delete" ON public.webhooks;
DROP POLICY IF EXISTS "webhooks_org_read" ON public.webhooks;
CREATE POLICY "webhooks_org_read" ON public.webhooks
  FOR SELECT USING (org_id = public.get_user_org_id() AND public.get_user_role() = 'admin');


-- ---- 6. Organizations: no browser inserts, no plan edits ----

DROP POLICY IF EXISTS "org_insert" ON public.organizations;

CREATE OR REPLACE FUNCTION public.guard_org_plan()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       NEW.plan IS DISTINCT FROM OLD.plan
    OR NEW.plan_started_at IS DISTINCT FROM OLD.plan_started_at
    OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at
    OR NEW.max_users IS DISTINCT FROM OLD.max_users
  ) THEN
    RAISE EXCEPTION 'Plan changes go through Tranche' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS guard_org_plan ON public.organizations;
CREATE TRIGGER guard_org_plan
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_org_plan();


-- ---- 7. A row may only point at a parent in its own org ----
-- Args: parent table, foreign key column. Runs as owner so it can see
-- the parent whichever org it belongs to.

CREATE OR REPLACE FUNCTION public.guard_same_org_parent()
RETURNS TRIGGER AS $$
DECLARE
  v_ref TEXT := to_jsonb(NEW) ->> TG_ARGV[1];
  v_org UUID;
BEGIN
  IF v_ref IS NULL THEN
    RETURN NEW;
  END IF;
  EXECUTE format('SELECT org_id FROM public.%I WHERE id::text = $1', TG_ARGV[0]) INTO v_org USING v_ref;
  IF v_org IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION '% must belong to the same organization', TG_ARGV[1] USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS same_org_deal ON public.facilities;
CREATE TRIGGER same_org_deal BEFORE INSERT OR UPDATE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION public.guard_same_org_parent('pipeline_deals', 'pipeline_deal_id');
DROP TRIGGER IF EXISTS same_org_facility ON public.covenants;
CREATE TRIGGER same_org_facility BEFORE INSERT OR UPDATE ON public.covenants
  FOR EACH ROW EXECUTE FUNCTION public.guard_same_org_parent('facilities', 'facility_id');
DROP TRIGGER IF EXISTS same_org_facility ON public.covenant_tests;
CREATE TRIGGER same_org_facility BEFORE INSERT OR UPDATE ON public.covenant_tests
  FOR EACH ROW EXECUTE FUNCTION public.guard_same_org_parent('facilities', 'facility_id');
DROP TRIGGER IF EXISTS same_org_covenant ON public.covenant_tests;
CREATE TRIGGER same_org_covenant BEFORE INSERT OR UPDATE ON public.covenant_tests
  FOR EACH ROW EXECUTE FUNCTION public.guard_same_org_parent('covenants', 'covenant_id');
DROP TRIGGER IF EXISTS same_org_facility ON public.facility_attachments;
CREATE TRIGGER same_org_facility BEFORE INSERT OR UPDATE ON public.facility_attachments
  FOR EACH ROW EXECUTE FUNCTION public.guard_same_org_parent('facilities', 'facility_id');
DROP TRIGGER IF EXISTS same_org_deal ON public.deal_memos;
CREATE TRIGGER same_org_deal BEFORE INSERT OR UPDATE ON public.deal_memos
  FOR EACH ROW EXECUTE FUNCTION public.guard_same_org_parent('pipeline_deals', 'deal_id');


-- ---- Check: the storage policies that remain ----
-- Expect exactly the four deal_documents_org_* policies. Anything else
-- here that grants access to deal-documents without an org check is a
-- remaining hole; send it back.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
