-- ============================================================
-- Facility Attachments — documents for monitoring.
-- Reuses the existing 'deal-documents' storage bucket; this adds
-- only the metadata table. covenant_test_id null = facility-level doc
-- (credit agreement, appraisal); set = doc backs a specific test
-- (the BBC or compliance certificate behind a result).
-- Run AFTER supabase_monitoring_phase1.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facility_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id BIGINT NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  covenant_test_id BIGINT REFERENCES public.covenant_tests(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facility_attachments_facility ON public.facility_attachments(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_attachments_test ON public.facility_attachments(covenant_test_id);
CREATE INDEX IF NOT EXISTS idx_facility_attachments_org ON public.facility_attachments(org_id);

ALTER TABLE public.facility_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_attachments_select" ON public.facility_attachments
  FOR SELECT USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "facility_attachments_insert" ON public.facility_attachments
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND uploaded_by = auth.uid()
  );
CREATE POLICY "facility_attachments_delete" ON public.facility_attachments
  FOR DELETE USING (
    uploaded_by = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- No new storage bucket needed. Files go in the existing 'deal-documents'
-- bucket under paths like {org_id}/facility/{facility_id}/{timestamp}_{name}.
