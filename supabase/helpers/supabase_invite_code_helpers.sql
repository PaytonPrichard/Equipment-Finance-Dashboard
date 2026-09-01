-- ============================================================
-- Signup invite code helpers — reference SQL for Joel.
-- Run the first section once. Use the rest as templates.
-- ============================================================

-- ----- 1. Run once: helper function to generate a 12-char code -----
-- Excludes ambiguous chars (I, O, 0, 1) so the code is easy to read out loud.

create or replace function public.gen_signup_invite_code()
returns text as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  i int;
begin
  for i in 1..12 loop
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  end loop;
  return v_code;
end;
$$ language plpgsql;


-- ============================================================
-- TEMPLATES — copy/paste, edit, run.
-- ============================================================

-- ----- A. Generate a new invite for a pilot firm (email-bound, 90-day pilot plan) -----
-- Fill in the placeholders, run, then send the code to the prospect.

with new_code as (
  select public.gen_signup_invite_code() as code
)
insert into public.signup_invites (code, email, org_name, plan, expires_at, notes)
select
  code,
  'jane@acmecapital.com',           -- recipient email (NULL = code works for any email)
  'Acme Capital Partners',          -- default org name
  'pilot',                          -- 'pilot' (90 days, 10 users), 'pro' (paid), 'free_trial' (14 days)
  now() + interval '30 days',       -- code expiry (when the code itself stops working)
  'LinkedIn outreach to Jane, May 2026' -- internal note for your own records
from new_code
returning code, email, org_name, plan, expires_at;


-- ----- B. Generate an open code (any email can use it) -----
-- Useful if you don't know the recipient's exact email yet.

with new_code as (
  select public.gen_signup_invite_code() as code
)
insert into public.signup_invites (code, email, org_name, plan, expires_at, notes)
select
  code,
  null,                             -- NULL email = any address can redeem
  'Acme Capital Partners',
  'pilot',
  now() + interval '30 days',
  'Open code, pilot outreach round 2'
from new_code
returning code, email, org_name, plan, expires_at;


-- ----- C. Build the signup link to email to the prospect -----
-- Replace BASE_URL and CODE.
-- Example: https://gettranche.app/?code=K9X2M7QR8VPN

select 'https://gettranche.app/?code=' || code as signup_link
  from public.signup_invites
  where code = 'PASTE_CODE_HERE';


-- ----- D. List active (unredeemed, unexpired) invites -----

select code, email, org_name, plan, expires_at::date as expires, notes, created_at::date as created
  from public.signup_invites
  where redeemed_at is null
    and expires_at > now()
  order by created_at desc;


-- ----- E. List recently redeemed invites (last 30 days) -----

select
  i.code,
  i.email                                                  as invited_email,
  o.name                                                   as org_name,
  o.plan                                                   as plan,
  au.email                                                 as redeemer_email,
  i.redeemed_at::date                                      as redeemed
from public.signup_invites i
left join auth.users          au on au.id = i.redeemed_by_user_id
left join public.organizations o on o.id  = i.redeemed_org_id
where i.redeemed_at > now() - interval '30 days'
order by i.redeemed_at desc;


-- ----- F. Revoke (expire) a code immediately -----
-- Use if you sent a code to the wrong person or want to cancel it.

update public.signup_invites
  set expires_at = now() - interval '1 second'
  where code = 'PASTE_CODE_HERE'
returning code, expires_at;


-- ----- G. Extend an expiring code -----

update public.signup_invites
  set expires_at = now() + interval '30 days'
  where code = 'PASTE_CODE_HERE'
returning code, expires_at;
