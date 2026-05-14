-- ============================================================
-- signup_invites: invite codes that create a new firm + admin user.
-- Distinct from `invites` table, which is for adding members to an
-- existing org. These codes provision an entirely new organization.
--
-- Single-use only. Optionally email-bound. Run in Supabase SQL Editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- ----- Table -----

create table if not exists public.signup_invites (
  code                  text primary key,
  email                 text,                                    -- optional: bind code to a specific email
  org_name              text not null,                           -- default org name on redemption (user can edit)
  plan                  text not null default 'pilot'
                          check (plan in ('free_trial', 'pilot', 'pro')),
  expires_at            timestamptz not null default (now() + interval '30 days'),
  redeemed_at           timestamptz,
  redeemed_by_user_id   uuid references auth.users(id) on delete set null,
  redeemed_org_id       uuid references public.organizations(id) on delete set null,
  notes                 text,
  created_by_user_id    uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists signup_invites_email_idx on public.signup_invites (lower(email));
create index if not exists signup_invites_redeemed_idx on public.signup_invites (redeemed_at);

alter table public.signup_invites enable row level security;
-- No SELECT / INSERT / UPDATE / DELETE policies for anon/authenticated.
-- The RPC below uses SECURITY DEFINER, and the API endpoint uses service role.
revoke all on public.signup_invites from anon, authenticated;

comment on table public.signup_invites is
  'Invite codes that provision a new org + admin user. Service-role only; no client access.';


-- ----- Helper: slug generation -----

create or replace function public.gen_org_slug(p_name text)
returns text as $$
declare
  v_base text;
  v_slug text;
  v_suffix int := 0;
begin
  v_base := lower(regexp_replace(trim(p_name), '[^a-z0-9]+', '-', 'gi'));
  v_base := regexp_replace(v_base, '(^-|-$)', '', 'g');
  if v_base = '' then v_base := 'org'; end if;
  v_slug := v_base;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix;
  end loop;
  return v_slug;
end;
$$ language plpgsql;


-- ----- Redeem RPC -----
-- Called by the server-side /api/signup-with-code endpoint (using service role)
-- AFTER the auth user has been created. Atomically:
--   1. validates the code
--   2. creates the org with the chosen plan
--   3. promotes the user to admin of that org
--   4. marks the invite redeemed
--
-- Returns JSON { success: true, org_id, slug } on success
-- Returns JSON { error: '...' } on failure (caller should delete the auth user).

create or replace function public.redeem_signup_invite(
  p_code         text,
  p_user_id      uuid,
  p_user_email   text,
  p_org_name     text
)
returns json
language plpgsql
security definer
as $$
declare
  v_invite      record;
  v_org_id      uuid;
  v_slug        text;
  v_plan        text;
  v_duration    int;
  v_max_users   int;
  v_org_name    text;
begin
  -- Lock the invite row to avoid race-condition double-redemption.
  select * into v_invite
    from public.signup_invites
    where code = p_code
    for update;

  if not found then
    return json_build_object('error', 'invalid_code');
  end if;

  if v_invite.redeemed_at is not null then
    return json_build_object('error', 'already_redeemed');
  end if;

  if v_invite.expires_at <= now() then
    return json_build_object('error', 'expired');
  end if;

  -- Email match check (case-insensitive). Only enforced if code is email-bound.
  if v_invite.email is not null and v_invite.email <> '' then
    if lower(v_invite.email) <> lower(p_user_email) then
      return json_build_object('error', 'email_mismatch');
    end if;
  end if;

  -- Pick org name: caller-supplied override (trimmed), or fall back to invite default.
  v_org_name := nullif(trim(coalesce(p_org_name, '')), '');
  if v_org_name is null then
    v_org_name := v_invite.org_name;
  end if;

  -- Plan defaults
  v_plan := v_invite.plan;
  if v_plan = 'pilot' then
    v_duration := 90;
    v_max_users := 10;
  elsif v_plan = 'pro' then
    v_duration := 30;
    v_max_users := 25;
  else
    v_duration := 14;
    v_max_users := 3;
  end if;

  -- Create the org
  v_slug := public.gen_org_slug(v_org_name);
  insert into public.organizations (name, slug, plan, plan_started_at, plan_expires_at, max_users)
    values (v_org_name, v_slug, v_plan, now(), now() + (v_duration || ' days')::interval, v_max_users)
    returning id into v_org_id;

  -- Promote user to admin of new org. handle_new_user trigger already
  -- created the profile row when the auth user was created.
  update public.profiles
    set org_id = v_org_id, role = 'admin', updated_at = now()
    where id = p_user_id;

  -- Mark invite redeemed
  update public.signup_invites
    set redeemed_at = now(),
        redeemed_by_user_id = p_user_id,
        redeemed_org_id = v_org_id
    where code = p_code;

  return json_build_object(
    'success', true,
    'org_id', v_org_id,
    'slug', v_slug,
    'plan', v_plan
  );
end;
$$;

comment on function public.redeem_signup_invite(text, uuid, text, text) is
  'Atomic: validates a signup invite, creates org, promotes user to admin, marks redeemed.';


-- ----- Read-only validation RPC (for pre-signup UI check) -----
-- Lets the signup form tell the user "this code is valid" before they
-- type their password. Does NOT redeem. Safe to call as authenticated
-- or anon; we don't expose any sensitive fields.

create or replace function public.validate_signup_invite(p_code text, p_email text default null)
returns json
language plpgsql
security definer
as $$
declare
  v_invite record;
begin
  select * into v_invite from public.signup_invites where code = p_code;

  if not found then
    return json_build_object('valid', false, 'reason', 'invalid_code');
  end if;
  if v_invite.redeemed_at is not null then
    return json_build_object('valid', false, 'reason', 'already_redeemed');
  end if;
  if v_invite.expires_at <= now() then
    return json_build_object('valid', false, 'reason', 'expired');
  end if;
  if v_invite.email is not null and v_invite.email <> '' and p_email is not null then
    if lower(v_invite.email) <> lower(p_email) then
      return json_build_object('valid', false, 'reason', 'email_mismatch');
    end if;
  end if;

  return json_build_object(
    'valid', true,
    'org_name', v_invite.org_name,
    'plan', v_invite.plan,
    'email_bound', (v_invite.email is not null and v_invite.email <> '')
  );
end;
$$;

-- Allow anon and authenticated to call validate (it's read-only and
-- only reveals org_name + plan, no security risk).
grant execute on function public.validate_signup_invite(text, text) to anon, authenticated;

comment on function public.validate_signup_invite(text, text) is
  'Read-only check that a signup invite is valid before showing the signup form.';
