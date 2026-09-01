-- ============================================================
-- Migration verification
-- Read-only. Checks whether each migration file in the repo has
-- been applied to this database. Returns one row per check.
--
-- Run in Supabase SQL editor. Any row with status 'MISSING' is a
-- migration you still need to apply.
-- ============================================================

WITH checks AS (
  -- supabase_schema.sql (core)
  SELECT 'supabase_schema.sql' AS migration, 'table: public.organizations' AS object,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations') AS present
  UNION ALL SELECT 'supabase_schema.sql', 'table: public.profiles',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles')
  UNION ALL SELECT 'supabase_schema.sql', 'table: public.saved_deals',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='saved_deals')
  UNION ALL SELECT 'supabase_schema.sql', 'table: public.pipeline_deals',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pipeline_deals')
  UNION ALL SELECT 'supabase_schema.sql', 'table: public.audit_log',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_log')

  -- supabase_sessions.sql
  UNION ALL SELECT 'supabase_sessions.sql', 'table: public.active_sessions',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='active_sessions')

  -- supabase_phase6_schema.sql
  UNION ALL SELECT 'supabase_phase6_schema.sql', 'table: public.invites',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invites')
  UNION ALL SELECT 'supabase_phase6_schema.sql', 'table: public.discount_codes',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='discount_codes')
  UNION ALL SELECT 'supabase_phase6_schema.sql', 'function: public.redeem_discount_code',
    EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='redeem_discount_code')
  UNION ALL SELECT 'supabase_phase6_schema.sql', 'column: organizations.plan',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='plan')

  -- supabase_security_fixes.sql
  UNION ALL SELECT 'supabase_security_fixes.sql', 'table: public.invite_attempts',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invite_attempts')
  UNION ALL SELECT 'supabase_security_fixes.sql', 'function: public.redeem_invite',
    EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='redeem_invite')
  UNION ALL SELECT 'supabase_security_fixes.sql', 'policy: profiles_update_admin',
    EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_admin')

  -- supabase_attachments.sql
  UNION ALL SELECT 'supabase_attachments.sql', 'table: public.deal_attachments',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deal_attachments')

  -- supabase_branding.sql
  UNION ALL SELECT 'supabase_branding.sql', 'column: organizations.branding',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='branding')

  -- supabase_org_settings.sql
  UNION ALL SELECT 'supabase_org_settings.sql', 'column: organizations.org_settings',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organizations' AND column_name='org_settings')

  -- supabase_module_refactor.sql
  UNION ALL SELECT 'supabase_module_refactor.sql', 'table: public.org_modules',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='org_modules')

  -- supabase_fix_policies.sql
  UNION ALL SELECT 'supabase_fix_policies.sql', 'function: public.get_user_org_id',
    EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_user_org_id')
  UNION ALL SELECT 'supabase_fix_policies.sql', 'function: public.get_user_role',
    EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_user_role')

  -- supabase_fix_org_insert.sql
  UNION ALL SELECT 'supabase_fix_org_insert.sql', 'policy: organizations.org_insert',
    EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organizations' AND policyname='org_insert')

  -- supabase_integrations.sql
  UNION ALL SELECT 'supabase_integrations.sql', 'table: public.api_keys',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='api_keys')
  UNION ALL SELECT 'supabase_integrations.sql', 'table: public.webhooks',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='webhooks')
  UNION ALL SELECT 'supabase_integrations.sql', 'table: public.webhook_logs',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='webhook_logs')

  -- supabase_transfer_admin.sql
  UNION ALL SELECT 'supabase_transfer_admin.sql', 'function: public.transfer_admin',
    EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='transfer_admin')

  -- supabase_access_requests.sql
  UNION ALL SELECT 'supabase_access_requests.sql', 'table: public.access_requests',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='access_requests')

  -- supabase_discount_code_rate_limit.sql
  UNION ALL SELECT 'supabase_discount_code_rate_limit.sql', 'table: public.discount_code_attempts',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='discount_code_attempts')
)
SELECT
  migration,
  object,
  CASE WHEN present THEN 'OK' ELSE 'MISSING' END AS status
FROM checks
ORDER BY
  CASE WHEN present THEN 1 ELSE 0 END,  -- missing rows first
  migration,
  object;
