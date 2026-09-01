# Database migrations

These are hand-applied through the Supabase SQL editor. There is no migration
runner and no `schema_migrations` table, so **the order below is the only
record of how the database was built.** It was previously implicit in 24 files
sitting loose in the repo root with no ordering at all (AUDIT.md P2-4).

Every file is idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`), so
re-running one is safe. Applying them out of order is not: several depend on
tables or columns an earlier file creates.

To check what is actually deployed, run `helpers/supabase_check_migrations.sql`.

## Apply order

| # | File | What it does |
|---|---|---|
| 1 | `supabase_schema.sql` | Baseline. `organizations`, `profiles`, `saved_deals`, `pipeline_deals`, `audit_log`, RLS. |
| 2 | `supabase_fix_policies.sql` | Fixes recursive RLS on `profiles`. |
| 3 | `supabase_phase6_schema.sql` | Invites, discount codes, plan management. |
| 4 | `supabase_module_refactor.sql` | Adds `asset_class` to `saved_deals` and `pipeline_deals`. |
| 5 | `supabase_security_fixes.sql` | Blocks role self-update, locks down discount codes. |
| 6 | `supabase_transfer_admin.sql` | Admin transfer RPC. |
| 7 | `supabase_attachments.sql` | `deal_attachments` + the `deal-documents` storage bucket. |
| 8 | `supabase_branding.sql` | Org branding fields. |
| 9 | `supabase_fix_org_insert.sql` | Org INSERT policy fix. |
| 10 | `supabase_org_settings.sql` | Per-org credit settings. |
| 11 | `supabase_integrations.sql` | API keys and webhooks. |
| 12 | `supabase_sessions.sql` | Cross-device session enforcement. |
| 13 | `supabase_access_requests.sql` | `access_requests` for the Request Access form. |
| 14 | `supabase_discount_code_rate_limit.sql` | Rate limits discount redemption. |
| 15 | `supabase_signup_invites.sql` | Org-creating invite codes + `redeem_signup_invite`. |
| 16 | `supabase_monitoring_phase1.sql` | `monitored_facilities`, `covenants`, `covenant_tests`. |
| 17 | `supabase_monitoring_facility_unique.sql` | Uniqueness constraint on facilities. |
| 18 | `supabase_facility_attachments.sql` | `facility_attachments`. |
| 19 | `supabase_fix_audit_org.sql` | Scopes `audit_log` INSERT to the caller's org; constrains `asset_class`. |
| 20 | `supabase_stage_entered_at.sql` | `pipeline_deals.stage_entered_at`, `deal_attachments.source`. |

Files 1 through 12 are dated 2026-03; 13 through 15 are 2026-05; 16 through 18
are 2026-06. Order within a date group is by dependency, not by timestamp.

## Helpers

Not migrations. Nothing here should be applied as part of a build.

| File | What it is |
|---|---|
| `supabase_check_migrations.sql` | Verification queries. Run this to see what is deployed. |
| `supabase_audit_users.sql` | Manual review query for the user table. |
| `supabase_invite_code_helpers.sql` | Reference SQL for issuing invite codes by hand. |
| `supabase_fix_score_column_OPTIONAL.sql` | **Unapplied and untrusted.** Narrows the `pipeline_deals` UPDATE policy so clients cannot write `score` directly. Carries its own "APPLY SECOND, AND TEST BEFORE YOU TRUST IT" warning. The server already ignores client-supplied scores (`api/score-deal.js` recomputes), so this is defence in depth rather than a live gap. Decide and either promote it to a migration or delete it. |
