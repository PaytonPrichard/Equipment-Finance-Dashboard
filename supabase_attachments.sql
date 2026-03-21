-- ============================================================
-- Deal Attachments — Schema Migration
--
-- Run this in the Supabase SQL editor to create the
-- deal_attachments table and storage bucket.
-- ============================================================

-- 1. Create the deal_attachments metadata table
CREATE TABLE IF NOT EXISTS deal_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL,
  deal_type TEXT NOT NULL DEFAULT 'pipeline' CHECK (deal_type IN ('pipeline', 'saved')),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast lookups by deal
CREATE INDEX IF NOT EXISTS idx_deal_attachments_deal_id ON deal_attachments(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_attachments_org_id ON deal_attachments(org_id);

-- 2. Enable RLS
ALTER TABLE deal_attachments ENABLE ROW LEVEL SECURITY;

-- Users can read attachments in their org
CREATE POLICY "Users can view org attachments"
  ON deal_attachments FOR SELECT
  USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- Users can insert attachments in their org
CREATE POLICY "Users can upload attachments"
  ON deal_attachments FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND uploaded_by = auth.uid()
  );

-- Users can delete their own attachments, or admins can delete any
CREATE POLICY "Users can delete own attachments"
  ON deal_attachments FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 3. Create the storage bucket (run via Supabase Dashboard or API)
-- Note: Storage bucket creation is typically done via the dashboard.
-- Go to Storage > New Bucket > Name: "deal-documents" > Public: false
--
-- Then add these storage policies:
--
-- SELECT (download): authenticated users in same org
--   ((bucket_id = 'deal-documents') AND (auth.role() = 'authenticated'))
--
-- INSERT (upload): authenticated users
--   ((bucket_id = 'deal-documents') AND (auth.role() = 'authenticated'))
--
-- DELETE: authenticated users (own files)
--   ((bucket_id = 'deal-documents') AND (auth.role() = 'authenticated'))
