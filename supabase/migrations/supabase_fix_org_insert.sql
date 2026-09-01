-- Fix: Organization insert policy
-- The auth.role() = 'authenticated' check may not work in newer Supabase versions.
-- Use auth.uid() IS NOT NULL instead, which reliably checks for a logged-in user.

DROP POLICY IF EXISTS "org_insert" ON public.organizations;

CREATE POLICY "org_insert" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
