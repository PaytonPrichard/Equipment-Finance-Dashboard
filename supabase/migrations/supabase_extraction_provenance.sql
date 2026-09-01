-- ============================================================
-- pipeline_deals.extraction_provenance
--
-- Which document supplied each field, kept with the deal.
--
-- Field-level provenance lived only in React state, so it survived
-- exactly as long as the screening session. Reopening a saved deal
-- lost it, which also silently emptied the Source Documents section
-- of the committee memo: the memo said "entered manually" for a deal
-- that had in fact been built from four documents.
--
-- Shape (see MergeResult in src/lib/extractionMerge.ts):
--   {
--     "fieldSources": {
--       "ebitda": { "value": 7400000,
--                   "fileName": "02_financial-statements.pdf",
--                   "documentType": "financial_statement" }
--     },
--     "conflicts": [ { "field": "ebitda", "chosen": {...},
--                      "alternatives": [ {...} ] } ],
--     "documents": [ { "fileName": "...", "documentType": "...",
--                      "fieldCount": 11 } ],
--     "capturedAt": "2026-09-01T14:22:00.000Z"
--   }
--
-- Nullable on purpose. A deal typed in by hand has no provenance, and
-- that is a meaningful state rather than a missing one: the audit view
-- and the memo both say the inputs were entered manually.
-- ============================================================

ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS extraction_provenance JSONB;

COMMENT ON COLUMN public.pipeline_deals.extraction_provenance IS
  'Per-field document provenance from the multi-document merge. Null when inputs were entered manually.';
