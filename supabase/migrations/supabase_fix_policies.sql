-- ============================================================
-- FIX: Recursive RLS policy on profiles
-- Run this in Supabase SQL Editor AFTER the initial schema
-- ============================================================

-- Step 1: Create a SECURITY DEFINER function to get org_id without hitting RLS
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: Create a helper for user role too
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 3: Fix profiles policies (drop the recursive one, replace with safe version)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    -- Users can always see their own profile
    id = auth.uid()
    -- Users can see profiles in their org (uses the SECURITY DEFINER function)
    OR org_id = public.get_user_org_id()
    -- Users with no org can see other profiles without orgs (for onboarding)
    OR (org_id IS NULL AND public.get_user_org_id() IS NULL)
  );

-- Step 4: Fix organizations policies
DROP POLICY IF EXISTS "org_select" ON public.organizations;
CREATE POLICY "org_select" ON public.organizations
  FOR SELECT USING (id = public.get_user_org_id());

DROP POLICY IF EXISTS "org_update" ON public.organizations;
CREATE POLICY "org_update" ON public.organizations
  FOR UPDATE USING (
    id = public.get_user_org_id() AND public.get_user_role() = 'admin'
  );

-- Step 5: Fix org_permissions policies
DROP POLICY IF EXISTS "org_permissions_select" ON public.org_permissions;
CREATE POLICY "org_permissions_select" ON public.org_permissions
  FOR SELECT USING (org_id = public.get_user_org_id());

DROP POLICY IF EXISTS "org_permissions_modify" ON public.org_permissions;
CREATE POLICY "org_permissions_modify" ON public.org_permissions
  FOR ALL USING (
    org_id = public.get_user_org_id() AND public.get_user_role() = 'admin'
  );

-- Step 6: Fix saved_deals policies
DROP POLICY IF EXISTS "saved_deals_select" ON public.saved_deals;
CREATE POLICY "saved_deals_select" ON public.saved_deals
  FOR SELECT USING (org_id = public.get_user_org_id());

-- Step 7: Fix pipeline_deals policies
DROP POLICY IF EXISTS "pipeline_deals_select" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_select" ON public.pipeline_deals
  FOR SELECT USING (org_id = public.get_user_org_id());

DROP POLICY IF EXISTS "pipeline_deals_update" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_update" ON public.pipeline_deals
  FOR UPDATE USING (org_id = public.get_user_org_id());

DROP POLICY IF EXISTS "pipeline_deals_delete" ON public.pipeline_deals;
CREATE POLICY "pipeline_deals_delete" ON public.pipeline_deals
  FOR DELETE USING (
    auth.uid() = user_id
    OR public.get_user_role() IN ('admin', 'credit_committee')
  );

-- Step 8: Fix audit_log policies
DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT USING (
    org_id = public.get_user_org_id()
    AND public.get_user_role() IN ('admin', 'credit_committee', 'senior_analyst')
  );

-- Step 9: Allow org insert for onboarding (users need to create their first org)
CREATE POLICY "org_insert" ON public.organizations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
