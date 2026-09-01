-- ============================================================
-- pipeline_deals.stage_entered_at
--
-- The kanban card shows "days in stage", but it was reading
-- updated_at, which any write touches. Editing a note reset a
-- deal's aging clock, so a deal that had sat in Under Review for
-- three weeks read as "Today". Aging is the whole point of that
-- number, so it needs its own column.
--
-- Backfill uses updated_at: it is wrong for deals whose last write
-- was not a stage change, but it is the best available estimate and
-- it self-corrects on the next stage move.
--
-- Also: deal_attachments.source, so the committee memo can tell
-- documents that produced the deal's numbers apart from documents
-- attached afterward.
-- ============================================================

ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ;

UPDATE public.pipeline_deals
  SET stage_entered_at = COALESCE(updated_at, created_at)
  WHERE stage_entered_at IS NULL;

ALTER TABLE public.pipeline_deals
  ALTER COLUMN stage_entered_at SET DEFAULT now();

ALTER TABLE public.deal_attachments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.deal_attachments
  DROP CONSTRAINT IF EXISTS deal_attachments_source_check;

ALTER TABLE public.deal_attachments
  ADD CONSTRAINT deal_attachments_source_check
  CHECK (source IN ('manual', 'extraction'));
