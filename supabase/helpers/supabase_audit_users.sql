-- ============================================================
-- User & org audit — run in Supabase SQL editor, then review.
-- Read-only. No data is modified.
-- ============================================================

-- ----- 1. Every user, their org, their role, their activity -----
-- One row per auth user. Sorted by org name, then signup date.
-- Use this to decide who stays and who gets pruned.

select
  au.email                                              as user_email,
  coalesce(p.full_name, '(no name)')                    as full_name,
  p.role                                                as profile_role,
  o.name                                                as org_name,
  o.plan                                                as org_plan,
  o.plan_expires_at::date                               as plan_expires,
  (au.email_confirmed_at is not null)                   as email_verified,
  au.created_at::date                                   as signed_up,
  au.last_sign_in_at::date                              as last_signin,
  (select count(*) from public.saved_deals     sd where sd.user_id = au.id) as saved_deals,
  (select count(*) from public.pipeline_deals  pd where pd.org_id  = p.org_id) as org_pipeline_deals,
  au.id                                                 as user_id,
  p.org_id                                              as org_id
from auth.users au
left join public.profiles      p on p.id = au.id
left join public.organizations o on o.id = p.org_id
order by
  o.name nulls last,
  au.created_at asc;


-- ----- 2. Org-level summary — useful for spotting orphan orgs -----

select
  o.name                                       as org_name,
  o.plan                                       as plan,
  o.plan_expires_at::date                      as plan_expires,
  (select count(*) from public.profiles      p where p.org_id = o.id) as members,
  (select count(*) from public.pipeline_deals d where d.org_id = o.id) as pipeline_deals,
  o.created_at::date                           as created,
  o.id                                         as org_id
from public.organizations o
order by o.created_at asc;


-- ----- 3. Orphans: auth users with no profile, or profiles with no auth user -----
-- These are usually leftovers from failed signups. Generally safe to delete.

select
  au.email                          as orphan_user_email,
  au.id                             as orphan_user_id,
  au.created_at::date               as signed_up
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
order by au.created_at desc;
