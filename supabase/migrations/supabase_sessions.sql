-- Active sessions table for cross-device enforcement
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  device_info TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read and write their own sessions
CREATE POLICY "sessions_select_own" ON active_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "sessions_insert_own" ON active_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_update_own" ON active_sessions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "sessions_delete_own" ON active_sessions
  FOR DELETE USING (user_id = auth.uid());
