-- ============================================================
-- Monitoring: enforce one facility per funded pipeline deal.
-- Partial unique index — allows many facilities with no linked deal
-- (imported book), but at most one per pipeline_deal_id.
-- Safe to run on its own; idempotent.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_facilities_unique_deal
  ON public.facilities (pipeline_deal_id)
  WHERE pipeline_deal_id IS NOT NULL;
