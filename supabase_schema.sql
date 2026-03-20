-- ============================================================
-- Equipment Finance Dashboard — Production Database Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Organizations (multi-tenant)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. User profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'analyst'
    CHECK (role IN ('analyst', 'senior_analyst', 'credit_committee', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read profiles within their org
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    org_id IS NULL OR org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. Organization permissions (customizable per org, per role)
-- Default permissions are defined in the app; these are overrides.
CREATE TABLE public.org_permissions (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('analyst', 'senior_analyst', 'credit_committee', 'admin')),
  permission_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, role, permission_key)
);

ALTER TABLE public.org_permissions ENABLE ROW LEVEL SECURITY;

-- All org members can read their org's permissions
CREATE POLICY "org_permissions_select" ON public.org_permissions
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
-- Only admins can modify permissions
CREATE POLICY "org_permissions_modify" ON public.org_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND org_id = org_permissions.org_id AND role = 'admin'
    )
  );


-- 4. Saved deals
CREATE TABLE public.saved_deals (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  inputs JSONB NOT NULL,
  score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_deals_select" ON public.saved_deals
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "saved_deals_insert" ON public.saved_deals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_deals_update" ON public.saved_deals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "saved_deals_delete" ON public.saved_deals
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_saved_deals_org ON public.saved_deals(org_id);


-- 5. Pipeline deals
CREATE TABLE public.pipeline_deals (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'Screening'
    CHECK (stage IN ('Screening', 'Under Review', 'Approved', 'Funded', 'Declined')),
  inputs JSONB NOT NULL DEFAULT '{}',
  score NUMERIC(5,2),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_deals_select" ON public.pipeline_deals
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "pipeline_deals_insert" ON public.pipeline_deals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pipeline_deals_update" ON public.pipeline_deals
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "pipeline_deals_delete" ON public.pipeline_deals
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'credit_committee')
    )
  );

CREATE INDEX idx_pipeline_deals_org ON public.pipeline_deals(org_id);
CREATE INDEX idx_pipeline_deals_stage ON public.pipeline_deals(stage);


-- 6. User preferences (per-user, private)
CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  scoring_weights JSONB,
  draft_inputs JSONB,
  draft_active_deal TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_all" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id);


-- 7. Audit log (append-only, immutable)
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Senior analysts, credit committee, and admins can view audit logs for their org
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND org_id = audit_log.org_id
        AND role IN ('admin', 'credit_committee', 'senior_analyst')
    )
  );
-- All authenticated users can insert their own audit entries
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE or DELETE policies = denied by RLS

CREATE INDEX idx_audit_log_org ON public.audit_log(org_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);


-- 8. Organizations RLS (must be after profiles table exists)
CREATE POLICY "org_select" ON public.organizations
  FOR SELECT USING (
    id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "org_update" ON public.organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND org_id = organizations.id AND role = 'admin'
    )
  );
