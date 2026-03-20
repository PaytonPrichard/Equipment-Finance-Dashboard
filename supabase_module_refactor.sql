-- ============================================================
-- Module Refactor: Add asset_class support to deals tables
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add asset_class column to saved_deals
ALTER TABLE public.saved_deals
  ADD COLUMN IF NOT EXISTS asset_class TEXT DEFAULT 'equipment_finance';

-- 2. Add asset_class column to pipeline_deals
ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS asset_class TEXT DEFAULT 'equipment_finance';

-- 3. Org modules table — tracks which modules each org has enabled
CREATE TABLE IF NOT EXISTS public.org_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  module_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, module_key)
);

ALTER TABLE public.org_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_modules_select_org_members" ON public.org_modules
  FOR SELECT USING (org_id = public.get_user_org_id());

CREATE POLICY "org_modules_manage_admins" ON public.org_modules
  FOR ALL USING (
    org_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Seed default module for all existing orgs
INSERT INTO public.org_modules (org_id, module_key, enabled)
SELECT id, 'equipment_finance', true
FROM public.organizations
ON CONFLICT (org_id, module_key) DO NOTHING;
