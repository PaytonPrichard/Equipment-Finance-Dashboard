-- user_preferences: columns the app writes but the original schema never had.
--
-- supabase_schema.sql created the table with scoring_weights, draft_inputs and
-- draft_active_deal. The app also writes tutorial_state (TutorialContext),
-- screening_criteria (ScreeningCriteria, SettingsPanel) and deal_templates
-- (App). Without the column the upsert fails and the client ignored the
-- error, so the welcome came back after every sign-in.
--
-- Safe to run more than once. RLS is unchanged: the existing "prefs_all"
-- policy (auth.uid() = user_id) covers the new columns.

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS tutorial_state JSONB,
  ADD COLUMN IF NOT EXISTS screening_criteria JSONB,
  ADD COLUMN IF NOT EXISTS deal_templates JSONB;

-- PostgREST caches the schema. Reload it so the API sees the new columns.
NOTIFY pgrst, 'reload schema';
