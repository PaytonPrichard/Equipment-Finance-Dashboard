-- ============================================================
-- Phase 6 Schema: Invites, Discount Codes, Plan Management
-- Run in Supabase SQL Editor AFTER the initial schema + fix
-- ============================================================

-- 1. Add plan columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free_trial' CHECK (plan IN ('free_trial', 'pilot', 'pro')),
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 3;

-- 2. Invites table
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'analyst' CHECK (role IN ('analyst', 'senior_analyst', 'credit_committee', 'admin')),
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_invites_org_id ON public.invites(org_id);
CREATE INDEX IF NOT EXISTS idx_invites_code ON public.invites(invite_code);

-- 3. Discount codes table
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('pilot', 'pro')),
  duration_days INTEGER NOT NULL DEFAULT 90,
  max_uses INTEGER DEFAULT 1,
  uses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- 4. RLS policies for invites
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's invites
CREATE POLICY "invites_select_org_members" ON public.invites
  FOR SELECT USING (
    org_id = public.get_user_org_id()
  );

-- Only admins can create invites
CREATE POLICY "invites_insert_admins" ON public.invites
  FOR INSERT WITH CHECK (
    org_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update (revoke) invites
CREATE POLICY "invites_update_admins" ON public.invites
  FOR UPDATE USING (
    org_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. RLS policies for discount_codes (read-only for all authenticated users)
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discount_codes_select_authenticated" ON public.discount_codes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 6. Helper function to validate and redeem an invite code
-- (Called from the client via Supabase RPC)
CREATE OR REPLACE FUNCTION public.redeem_invite(p_invite_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_org_member_count INTEGER;
  v_org RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Check if user already has an org
  IF (SELECT org_id FROM public.profiles WHERE id = v_user_id) IS NOT NULL THEN
    RETURN json_build_object('error', 'You are already a member of an organization');
  END IF;

  -- Find the invite
  SELECT * INTO v_invite FROM public.invites
    WHERE invite_code = p_invite_code
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid or expired invite code');
  END IF;

  -- Check org member limit
  SELECT * INTO v_org FROM public.organizations WHERE id = v_invite.org_id;
  SELECT COUNT(*) INTO v_org_member_count FROM public.profiles WHERE org_id = v_invite.org_id;

  IF v_org.max_users IS NOT NULL AND v_org_member_count >= v_org.max_users THEN
    RETURN json_build_object('error', 'Organization has reached its member limit');
  END IF;

  -- If invite has a specific email, verify it matches
  IF v_invite.email IS NOT NULL AND v_invite.email != '' THEN
    IF (SELECT email FROM auth.users WHERE id = v_user_id) != v_invite.email THEN
      RETURN json_build_object('error', 'This invite was sent to a different email address');
    END IF;
  END IF;

  -- Accept the invite: update profile and invite status
  UPDATE public.profiles
    SET org_id = v_invite.org_id, role = v_invite.role
    WHERE id = v_user_id;

  UPDATE public.invites
    SET status = 'accepted', accepted_by = v_user_id
    WHERE id = v_invite.id;

  RETURN json_build_object(
    'success', true,
    'org_id', v_invite.org_id,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Helper function to redeem a discount code
CREATE OR REPLACE FUNCTION public.redeem_discount_code(p_code TEXT, p_org_id UUID)
RETURNS JSON AS $$
DECLARE
  v_code RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
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

  RETURN json_build_object(
    'success', true,
    'plan', v_code.plan,
    'duration_days', v_code.duration_days,
    'expires_at', (now() + (v_code.duration_days || ' days')::interval)::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
