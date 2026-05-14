-- ============================================================
-- Discount Code Rate Limiting
-- Mirrors the invite_attempts pattern from supabase_security_fixes.sql.
-- 5 attempts per user per hour. Run in Supabase SQL Editor.
-- ============================================================

-- 1. Attempt tracking table
CREATE TABLE IF NOT EXISTS public.discount_code_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  success       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS discount_code_attempts_user_time_idx
  ON public.discount_code_attempts (user_id, attempted_at DESC);

ALTER TABLE public.discount_code_attempts ENABLE ROW LEVEL SECURITY;

-- Users can insert their own attempts (for tracking via the RPC).
DROP POLICY IF EXISTS "discount_code_attempts_insert_own" ON public.discount_code_attempts;
CREATE POLICY "discount_code_attempts_insert_own" ON public.discount_code_attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- No SELECT / UPDATE / DELETE policies. Only the RPC (SECURITY DEFINER) can read/modify.


-- 2. Redeem function with rate limit guard at the top.
-- Identical logic to the existing version, except:
--   - rate limit check (5/hr per user) before doing any real work
--   - log every attempt (success or fail) to discount_code_attempts
CREATE OR REPLACE FUNCTION public.redeem_discount_code(p_code TEXT, p_org_id UUID)
RETURNS JSON AS $$
DECLARE
  v_code RECORD;
  v_user_id UUID;
  v_recent_attempts INTEGER;
  v_attempt_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Rate limit: max 5 attempts per hour per user.
  SELECT COUNT(*) INTO v_recent_attempts
    FROM public.discount_code_attempts
    WHERE user_id = v_user_id
      AND attempted_at > now() - interval '1 hour';

  -- Always log the attempt (default success=false; we flip it at the end if it worked).
  INSERT INTO public.discount_code_attempts (user_id, success)
    VALUES (v_user_id, false)
    RETURNING id INTO v_attempt_id;

  IF v_recent_attempts >= 5 THEN
    RETURN json_build_object('error', 'Too many attempts. Please try again in an hour.');
  END IF;

  -- Verify user is admin of the org
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND org_id = p_org_id AND role = 'admin'
  ) THEN
    RETURN json_build_object('error', 'Only organization admins can redeem discount codes');
  END IF;

  -- Find and validate the code
  SELECT * INTO v_code FROM public.discount_codes
    WHERE code = p_code
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses_count < max_uses);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid, expired, or fully redeemed discount code');
  END IF;

  -- Apply the plan to the organization
  UPDATE public.organizations
    SET plan = v_code.plan,
        plan_started_at = now(),
        plan_expires_at = now() + (v_code.duration_days || ' days')::interval,
        max_users = CASE v_code.plan WHEN 'pro' THEN 25 WHEN 'pilot' THEN 10 ELSE max_users END
    WHERE id = p_org_id;

  -- Increment usage count
  UPDATE public.discount_codes
    SET uses_count = uses_count + 1
    WHERE id = v_code.id;

  -- Mark the attempt as successful
  UPDATE public.discount_code_attempts
    SET success = true
    WHERE id = v_attempt_id;

  RETURN json_build_object(
    'success', true,
    'plan', v_code.plan,
    'duration_days', v_code.duration_days,
    'expires_at', (now() + (v_code.duration_days || ' days')::interval)::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
