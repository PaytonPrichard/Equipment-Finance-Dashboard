-- ============================================================
-- Extraction quota
-- Caps how many documents one user can send to the extraction model in a
-- rolling window. Cost scales per document (one model call each), so the
-- unit is documents, not requests.
--
-- The in-memory limiter in server-lib/rateLimit.js is per instance and
-- resets on cold start. It stops a burst. It cannot cap a day.
--
-- Only the server calls claim_extraction_quota, with the service role. The
-- function takes the limit as an argument, so letting a browser call it
-- would let the browser pick its own limit. Execute is revoked from
-- everyone else for that reason.
--
-- Idempotent. Run in Supabase SQL Editor.
-- ============================================================

-- 1. Usage ledger. One row per accepted extraction request.
CREATE TABLE IF NOT EXISTS public.extraction_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  documents   INTEGER NOT NULL CHECK (documents > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS extraction_usage_user_time_idx
  ON public.extraction_usage (user_id, created_at DESC);

ALTER TABLE public.extraction_usage ENABLE ROW LEVEL SECURITY;
-- No policies. Clients cannot read or write it; the service role bypasses RLS.


-- 2. Check and record in one step. The advisory lock serialises concurrent
-- requests from the same user, so two parallel uploads cannot both read
-- "39 used" and both pass.
CREATE OR REPLACE FUNCTION public.claim_extraction_quota(
  p_user_id   UUID,
  p_documents INTEGER,
  p_limit     INTEGER,
  p_window    INTERVAL DEFAULT interval '24 hours'
)
RETURNS JSON AS $$
DECLARE
  v_used INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('extraction_quota:' || p_user_id::text));

  SELECT COALESCE(SUM(documents), 0) INTO v_used
    FROM public.extraction_usage
    WHERE user_id = p_user_id
      AND created_at > now() - p_window;

  IF v_used + p_documents > p_limit THEN
    RETURN json_build_object('allowed', false, 'used', v_used, 'limit', p_limit);
  END IF;

  INSERT INTO public.extraction_usage (user_id, documents) VALUES (p_user_id, p_documents);

  RETURN json_build_object('allowed', true, 'used', v_used + p_documents, 'limit', p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_extraction_quota(UUID, INTEGER, INTEGER, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_extraction_quota(UUID, INTEGER, INTEGER, INTERVAL) TO service_role;
