-- ============================================================
-- Security Fixes: Role self-update prevention + discount code lockdown
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. FIX: Prevent users from updating their own role
-- Drop the permissive update policy
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Create a restricted update policy that prevents role changes
-- Users can update their own profile EXCEPT the role field
CREATE POLICY "profiles_update_own_no_role" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- 2. FIX: Only admins can update other users' profiles (for role changes)
-- This is used by TeamManagement when admin changes a member's role
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.org_id = profiles.org_id
        AND admin_profile.role = 'admin'
    )
  );

-- 3. FIX: Remove public read access to discount codes
-- Only the RPC function (SECURITY DEFINER) should access this table
DROP POLICY IF EXISTS "discount_codes_select_authenticated" ON public.discount_codes;

-- No SELECT policy = nobody can query the table directly
-- The redeem_discount_code RPC uses SECURITY DEFINER to bypass RLS

-- 4. Add rate limiting to invite redemption via a tracking table
CREATE TABLE IF NOT EXISTS public.invite_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT false
);

-- Allow users to insert their own attempts (for tracking)
ALTER TABLE public.invite_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite_attempts_insert_own" ON public.invite_attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 5. Update redeem_invite to check attempt rate
CREATE OR REPLACE FUNCTION public.redeem_invite(p_invite_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_org_member_count INTEGER;
  v_org RECORD;
  v_recent_attempts INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Rate limit: max 5 attempts per hour
  SELECT COUNT(*) INTO v_recent_attempts
    FROM public.invite_attempts
    WHERE user_id = v_user_id
      AND attempted_at > now() - interval '1 hour';

  -- Log this attempt
  INSERT INTO public.invite_attempts (user_id, success) VALUES (v_user_id, false);

  IF v_recent_attempts >= 5 THEN
    RETURN json_build_object('error', 'Too many attempts. Please try again in an hour.');
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

  -- Accept the invite
  UPDATE public.profiles
    SET org_id = v_invite.org_id, role = v_invite.role
    WHERE id = v_user_id;

  UPDATE public.invites
    SET status = 'accepted', accepted_by = v_user_id
    WHERE id = v_invite.id;

  -- Mark attempt as successful
  UPDATE public.invite_attempts
    SET success = true
    WHERE id = (
      SELECT id FROM public.invite_attempts
      WHERE user_id = v_user_id
      ORDER BY attempted_at DESC
      LIMIT 1
    );

  RETURN json_build_object(
    'success', true,
    'org_id', v_invite.org_id,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
