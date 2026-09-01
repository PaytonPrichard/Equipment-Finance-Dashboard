-- ============================================================
-- Monitoring Phase 1: Facilities, Covenants, Covenant Tests
-- Run in Supabase SQL Editor AFTER supabase_schema.sql and
-- supabase_module_refactor.sql (adds pipeline_deals.asset_class).
-- Safe to re-run: drops the three tables first (no data yet).
-- See Monitoring_Phase1_Design.md for the annotated design.
-- ============================================================

DROP TABLE IF EXISTS public.covenant_tests CASCADE;
DROP TABLE IF EXISTS public.covenants CASCADE;
DROP TABLE IF EXISTS public.facilities CASCADE;

-- 1. Facilities (a funded deal under monitoring)
CREATE TABLE public.facilities (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_deal_id BIGINT REFERENCES public.pipeline_deals(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  commitment_amount NUMERIC(16,2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'defaulted')),
  funded_at DATE,
  maturity_date DATE,
  underwritten_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facilities_select" ON public.facilities
  FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "facilities_insert" ON public.facilities
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "facilities_update" ON public.facilities
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "facilities_delete" ON public.facilities
  FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'credit_committee')));

CREATE INDEX idx_facilities_org ON public.facilities(org_id);
CREATE INDEX idx_facilities_deal ON public.facilities(pipeline_deal_id);
CREATE INDEX idx_facilities_status ON public.facilities(status);

-- One facility per funded deal (partial: many facilities may have no linked deal).
CREATE UNIQUE INDEX idx_facilities_unique_deal
  ON public.facilities (pipeline_deal_id)
  WHERE pipeline_deal_id IS NOT NULL;

-- 2. Covenants (per facility; financial or reporting)
CREATE TABLE public.covenants (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id BIGINT NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('financial', 'reporting')),
  metric_key TEXT,
  direction TEXT CHECK (direction IN ('min', 'max')),
  flag_value NUMERIC,
  fail_value NUMERIC,
  unit TEXT CHECK (unit IN ('ratio', 'percent', 'currency', 'count')),
  test_frequency TEXT NOT NULL DEFAULT 'quarterly' CHECK (test_frequency IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  cure_days INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('underwritten', 'manual')),
  next_test_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.covenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "covenants_select" ON public.covenants
  FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "covenants_modify" ON public.covenants
  FOR ALL USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_covenants_org ON public.covenants(org_id);
CREATE INDEX idx_covenants_facility ON public.covenants(facility_id);

-- 3. Covenant tests (append-only time series; corrections are new rows)
CREATE TABLE public.covenant_tests (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id BIGINT NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  covenant_id BIGINT NOT NULL REFERENCES public.covenants(id) ON DELETE CASCADE,
  test_date DATE NOT NULL,
  due_date DATE,
  reported_value NUMERIC,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('pass', 'flag', 'fail', 'waived')),
  note TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.covenant_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "covenant_tests_select" ON public.covenant_tests
  FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "covenant_tests_insert" ON public.covenant_tests
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()) AND auth.uid() = created_by);

CREATE INDEX idx_covenant_tests_org ON public.covenant_tests(org_id);
CREATE INDEX idx_covenant_tests_facility ON public.covenant_tests(facility_id);
CREATE INDEX idx_covenant_tests_covenant ON public.covenant_tests(covenant_id, test_date DESC);
