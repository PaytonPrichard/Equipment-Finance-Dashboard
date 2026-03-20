-- ============================================================
-- Transfer Admin: Atomically swap admin role to another member
-- Run in Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.transfer_admin(p_new_admin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_new_admin RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Verify caller is an admin
  SELECT org_id INTO v_org_id
    FROM public.profiles
    WHERE id = v_user_id AND role = 'admin';

  IF v_org_id IS NULL THEN
    RETURN json_build_object('error', 'Only admins can transfer admin rights');
  END IF;

  -- Verify target user exists in the same org
  SELECT * INTO v_new_admin
    FROM public.profiles
    WHERE id = p_new_admin_id AND org_id = v_org_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Target user not found in your organization');
  END IF;

  IF v_new_admin.id = v_user_id THEN
    RETURN json_build_object('error', 'You are already the admin');
  END IF;

  -- Atomic swap: promote target, demote self
  UPDATE public.profiles SET role = 'admin' WHERE id = p_new_admin_id;
  UPDATE public.profiles SET role = 'senior_analyst' WHERE id = v_user_id;

  RETURN json_build_object(
    'success', true,
    'new_admin_id', p_new_admin_id,
    'new_admin_name', v_new_admin.full_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
