-- ============================================================
-- Deal Memos — Schema Migration
--
-- A committee memo is the artifact a credit decision was made on.
-- Before this table nothing was stored, so reopening a deal
-- recomputed it against the current SOFR and the current screening
-- criteria, and the memo you could regenerate was not necessarily
-- the memo that went to committee.
--
-- A row here is append-only. There is no UPDATE policy and no
-- DELETE policy, so RLS denies both: a memo can be superseded by a
-- newer one but never edited or removed while the deal exists.
--
-- Run this in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deal_memos (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id BIGINT NOT NULL REFERENCES public.pipeline_deals(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  asset_class TEXT NOT NULL,

  -- Everything generateBrandedPdfHtml() needs to render this memo again,
  -- plus the ambient values it used to read from live state: the SOFR
  -- rate and its vintage, the screening criteria in force, and the date
  -- printed on the page.
  model JSONB NOT NULL,

  -- The rendered memo exactly as it was produced. The model can be
  -- re-rendered by a newer template; this cannot change.
  html TEXT NOT NULL,
  html_sha256 TEXT,

  -- Denormalised so a memo list can show the verdict without parsing
  -- the model, and so drift against the live deal is a cheap compare.
  score NUMERIC(5,2),
  verdict TEXT,
  sofr NUMERIC(6,4),

  app_version TEXT
);

ALTER TABLE public.deal_memos ENABLE ROW LEVEL SECURITY;

-- Read: anyone in the org that owns the memo.
CREATE POLICY "deal_memos_select" ON public.deal_memos
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- Write: only as yourself, only into your own org.
CREATE POLICY "deal_memos_insert" ON public.deal_memos
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- No UPDATE or DELETE policy on purpose. See the header.

CREATE INDEX IF NOT EXISTS idx_deal_memos_deal ON public.deal_memos(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_memos_org ON public.deal_memos(org_id);
